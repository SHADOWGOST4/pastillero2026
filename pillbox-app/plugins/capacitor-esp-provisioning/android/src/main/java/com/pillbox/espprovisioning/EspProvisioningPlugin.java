package com.pillbox.espprovisioning;

import android.Manifest;
import android.app.Activity;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.le.ScanResult;
import android.content.Context;
import android.content.Intent;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.NetworkRequest;
import android.net.wifi.WifiInfo;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.ParcelUuid;
import android.provider.MediaStore;
import androidx.activity.result.ActivityResult;
import com.espressif.provisioning.DeviceConnectionEvent;
import com.espressif.provisioning.ESPConstants;
import com.espressif.provisioning.ESPDevice;
import com.espressif.provisioning.ESPProvisionManager;
import com.espressif.provisioning.WiFiAccessPoint;
import com.espressif.provisioning.listeners.BleScanListener;
import com.espressif.provisioning.listeners.ProvisionListener;
import com.espressif.provisioning.listeners.ResponseListener;
import com.espressif.provisioning.listeners.WiFiScanListener;
import com.espressif.provisioning.transport.BLETransport;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.lang.reflect.Field;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;
import org.greenrobot.eventbus.EventBus;
import org.greenrobot.eventbus.Subscribe;
import org.greenrobot.eventbus.ThreadMode;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Aprovisiona un ESP32 por BLE con Security 2 y le entrega, por el canal cifrado,
 * el Wi-Fi y los datos de enrolamiento. También puede pedirle las redes Wi-Fi que ve
 * ({@code scanNetworks}) para que el usuario elija en vez de escribir el nombre.
 *
 * Ayudas para rellenar el Wi-Fi: {@code currentNetwork} (la red del teléfono; Android exige
 * ubicación precisa para dar su nombre) y {@code pickImage} (una captura con el QR de la red,
 * que la app lee con ML Kit).
 *
 * Contrato con el firmware:
 *  - Security 2 con usuario {@link #USUARIO_SEC2} y el PoP del QR como contraseña.
 *  - Endpoint personalizado {@link #ENDPOINT_DATOS} que recibe un JSON UTF-8
 *    {"device_id", "enrollment_code", "api_url"} ANTES de las credenciales Wi-Fi.
 *
 * Errores (código de rechazo): permisos, bluetooth-apagado, no-encontrado,
 * pop-invalido, wifi, cancelado (empezó otra conexión) y desconocido.
 */
@CapacitorPlugin(
    name = "EspProvisioning",
    permissions = {
        @Permission(alias = "bluetooth", strings = { Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_CONNECT }),
        // Desde Android 12 la ubicación precisa solo se concede si se pide junto con la aproximada.
        @Permission(alias = "ubicacion", strings = { Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION })
    }
)
public class EspProvisioningPlugin extends Plugin {

    static final String USUARIO_SEC2 = "wifiprov";
    static final String ENDPOINT_DATOS = "custom-data";
    private static final long TIEMPO_MAXIMO_MS = 60_000;
    private static final long TIEMPO_MAXIMO_REDES_MS = 30_000;
    /** Margen para que el ESP32 vuelva a anunciarse tras cortar una conexión anterior. */
    private static final long ESPERA_RECONEXION_MS = 1_500;
    private static final long ESPERA_RED_ACTUAL_MS = 2_000;

    private final Handler main = new Handler(Looper.getMainLooper());
    /** Solo una conexión BLE a la vez: una nueva corta la anterior (p. ej. un escaneo de redes aún en curso). */
    private volatile Sesion sesionActiva;

    private String aliasNecesario() {
        // Desde Android 12 el escaneo BLE usa permisos propios; antes exigía ubicación.
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ? "bluetooth" : "ubicacion";
    }

    @PluginMethod
    public void provision(PluginCall call) {
        conPermisos(call);
    }

    /** Conecta con el pastillero, le pide las redes Wi-Fi que ve y se desconecta. Resuelve {redes: [{ssid, rssi, segura}]}. */
    @PluginMethod
    public void scanNetworks(PluginCall call) {
        conPermisos(call);
    }

    /**
     * La red Wi-Fi a la que está conectado el teléfono: {ssid, frecuenciaMhz}, o {} si no se puede saber
     * (sin Wi-Fi, ubicación apagada o permiso denegado). Nunca rechaza: el usuario siempre puede escribirla.
     */
    @PluginMethod
    public void currentNetwork(PluginCall call) {
        if (getPermissionState("ubicacion") != PermissionState.GRANTED) {
            requestPermissionForAlias("ubicacion", call, "resultadoUbicacion");
            return;
        }
        leerRedActual(call);
    }

    @PermissionCallback
    private void resultadoUbicacion(PluginCall call) {
        if (getPermissionState("ubicacion") == PermissionState.GRANTED) {
            leerRedActual(call);
        } else {
            call.resolve(new JSObject());
        }
    }

    private void leerRedActual(PluginCall call) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                leerRedActualConCallback(call);
            } else {
                WifiManager wifi = (WifiManager) getContext().getApplicationContext().getSystemService(Context.WIFI_SERVICE);
                responderRed(call, wifi != null ? wifi.getConnectionInfo() : null);
            }
        } catch (RuntimeException e) {
            call.resolve(new JSObject());
        }
    }

    /** Desde Android 12 el nombre de la red solo llega por un callback que pide la información de ubicación. */
    private void leerRedActualConCallback(PluginCall call) {
        ConnectivityManager conectividad = getContext().getSystemService(ConnectivityManager.class);
        AtomicBoolean respondida = new AtomicBoolean(false);
        NetworkRequest pedido = new NetworkRequest.Builder().addTransportType(NetworkCapabilities.TRANSPORT_WIFI).build();
        ConnectivityManager.NetworkCallback callback = new ConnectivityManager.NetworkCallback(
            ConnectivityManager.NetworkCallback.FLAG_INCLUDE_LOCATION_INFO
        ) {
            @Override
            public void onCapabilitiesChanged(Network red, NetworkCapabilities capacidades) {
                if (!(capacidades.getTransportInfo() instanceof WifiInfo) || !respondida.compareAndSet(false, true)) return;
                dejarDeEscuchar(conectividad, this);
                responderRed(call, (WifiInfo) capacidades.getTransportInfo());
            }
        };
        conectividad.registerNetworkCallback(pedido, callback);
        // Sin Wi-Fi el callback no llega nunca.
        main.postDelayed(() -> {
            if (!respondida.compareAndSet(false, true)) return;
            dejarDeEscuchar(conectividad, callback);
            call.resolve(new JSObject());
        }, ESPERA_RED_ACTUAL_MS);
    }

    private static void dejarDeEscuchar(ConnectivityManager conectividad, ConnectivityManager.NetworkCallback callback) {
        try {
            conectividad.unregisterNetworkCallback(callback);
        } catch (RuntimeException ignorada) {}
    }

    private static void responderRed(PluginCall call, WifiInfo info) {
        JSObject resultado = new JSObject();
        String ssid = info != null ? info.getSSID() : null;
        // Android entrecomilla los nombres UTF-8; sin comillas es "<unknown ssid>" o un nombre en hexadecimal.
        if (ssid != null && ssid.length() >= 2 && ssid.startsWith("\"") && ssid.endsWith("\"")) {
            resultado.put("ssid", ssid.substring(1, ssid.length() - 1));
            resultado.put("frecuenciaMhz", info.getFrequency());
        }
        call.resolve(resultado);
    }

    /** Abre el selector de imágenes del sistema. Resuelve {uri} (content://) o {} si el usuario cancela. */
    @PluginMethod
    public void pickImage(PluginCall call) {
        Intent intent;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            intent = new Intent(MediaStore.ACTION_PICK_IMAGES);
        } else {
            intent = new Intent(Intent.ACTION_GET_CONTENT);
            intent.addCategory(Intent.CATEGORY_OPENABLE);
        }
        intent.setType("image/*");
        startActivityForResult(call, intent, "imagenElegida");
    }

    @ActivityCallback
    private void imagenElegida(PluginCall call, ActivityResult resultado) {
        if (call == null) return;
        JSObject respuesta = new JSObject();
        Intent datos = resultado.getData();
        if (resultado.getResultCode() == Activity.RESULT_OK && datos != null && datos.getData() != null) {
            respuesta.put("uri", datos.getData().toString());
        }
        call.resolve(respuesta);
    }

    private void conPermisos(PluginCall call) {
        BluetoothAdapter adaptador = BluetoothAdapter.getDefaultAdapter();
        if (adaptador == null || !adaptador.isEnabled()) {
            call.reject("El Bluetooth está apagado.", "bluetooth-apagado");
            return;
        }
        if (getPermissionState(aliasNecesario()) != PermissionState.GRANTED) {
            requestPermissionForAlias(aliasNecesario(), call, "resultadoPermisos");
            return;
        }
        despachar(call);
    }

    @PermissionCallback
    private void resultadoPermisos(PluginCall call) {
        if (getPermissionState(aliasNecesario()) == PermissionState.GRANTED) {
            despachar(call);
        } else {
            call.reject("Permisos de Bluetooth denegados.", "permisos");
        }
    }

    private void despachar(PluginCall call) {
        if ("scanNetworks".equals(call.getMethodName())) {
            buscarRedes(call);
        } else {
            ejecutar(call);
        }
    }

    private void buscarRedes(PluginCall call) {
        String nombreBle = call.getString("nombreBle");
        String pop = call.getString("pop");
        if (nombreBle == null || pop == null) {
            call.reject("Faltan datos para buscar redes.", "desconocido");
            return;
        }
        arrancar(new Sesion(call, nombreBle, pop, null, null, null));
    }

    private void arrancar(Sesion sesion) {
        Sesion anterior = sesionActiva;
        sesionActiva = sesion;
        if (anterior != null && anterior.cancelar()) {
            main.postDelayed(sesion::iniciar, ESPERA_RECONEXION_MS);
        } else {
            sesion.iniciar();
        }
    }

    private void ejecutar(PluginCall call) {
        String nombreBle = call.getString("nombreBle");
        String pop = call.getString("pop");
        String ssid = call.getString("ssid");
        String password = call.getString("password");
        String deviceId = call.getString("deviceId");
        String codigo = call.getString("enrollmentCode");
        String apiUrl = call.getString("apiUrl");
        if (nombreBle == null || pop == null || ssid == null || password == null || deviceId == null || codigo == null || apiUrl == null) {
            call.reject("Faltan datos para aprovisionar.", "desconocido");
            return;
        }
        byte[] datos;
        try {
            datos = new JSONObject()
                .put("device_id", deviceId)
                .put("enrollment_code", codigo)
                .put("api_url", apiUrl)
                .toString()
                .getBytes(StandardCharsets.UTF_8);
        } catch (JSONException e) {
            call.reject("No se pudo preparar la configuración.", "desconocido");
            return;
        }
        arrancar(new Sesion(call, nombreBle, pop, ssid, password, datos));
    }

    /**
     * Una ejecución completa: buscar, conectar, sesión segura y, después, datos de enrolamiento y Wi-Fi;
     * o, sin credenciales ({@code soloRedes}), solo la lista de redes que ve el pastillero.
     */
    public class Sesion {

        private final PluginCall call;
        private final String nombreBle;
        private final String ssid;
        private final String password;
        private final byte[] datos;
        private final boolean soloRedes;
        private final ESPProvisionManager manager;
        private final ESPDevice dispositivo;
        private final AtomicBoolean encontrado = new AtomicBoolean(false);
        private final AtomicBoolean terminada = new AtomicBoolean(false);
        private final Runnable limiteDeTiempo = () -> fallar("desconocido", "Se agotó el tiempo de espera.");
        private volatile boolean registrada = false;

        Sesion(PluginCall call, String nombreBle, String pop, String ssid, String password, byte[] datos) {
            this.call = call;
            this.nombreBle = nombreBle;
            this.ssid = ssid;
            this.password = password;
            this.datos = datos;
            this.soloRedes = ssid == null;
            this.manager = ESPProvisionManager.getInstance(getContext().getApplicationContext());
            this.dispositivo = manager.createESPDevice(ESPConstants.TransportType.TRANSPORT_BLE, ESPConstants.SecurityType.SECURITY_2);
            this.dispositivo.setUserName(USUARIO_SEC2);
            this.dispositivo.setProofOfPossession(pop);
        }

        void iniciar() {
            if (terminada.get()) return;
            EventBus.getDefault().register(this);
            registrada = true;
            main.postDelayed(limiteDeTiempo, soloRedes ? TIEMPO_MAXIMO_REDES_MS : TIEMPO_MAXIMO_MS);
            paso("buscando");
            try {
                manager.searchBleEspDevices(nombreBle, new BleScanListener() {
                    @Override
                    public void scanStartFailed() {
                        fallar("bluetooth-apagado", "No se pudo iniciar el escaneo Bluetooth.");
                    }

                    @Override
                    public void onPeripheralFound(BluetoothDevice device, ScanResult resultado) {
                        if (!encontrado.compareAndSet(false, true)) return;
                        manager.stopBleScan();
                        List<ParcelUuid> servicios = resultado.getScanRecord() != null ? resultado.getScanRecord().getServiceUuids() : null;
                        if (servicios == null || servicios.isEmpty()) {
                            fallar("no-encontrado", "El dispositivo no anuncia el servicio de aprovisionamiento.");
                            return;
                        }
                        paso("conectando");
                        dispositivo.connectBLEDevice(device, servicios.get(0).toString());
                    }

                    @Override
                    public void scanCompleted() {
                        if (!encontrado.get()) fallar("no-encontrado", "No se encontró el pastillero.");
                    }

                    @Override
                    public void onFailure(Exception e) {
                        fallar(e instanceof SecurityException ? "permisos" : "no-encontrado", String.valueOf(e.getMessage()));
                    }
                });
            } catch (SecurityException e) {
                fallar("permisos", "Faltan permisos de Bluetooth.");
            }
        }

        @Subscribe(threadMode = ThreadMode.MAIN)
        public void onEvent(DeviceConnectionEvent evento) {
            switch (evento.getEventType()) {
                case ESPConstants.EVENT_DEVICE_CONNECTED:
                    abrirSesion();
                    break;
                case ESPConstants.EVENT_DEVICE_CONNECTION_FAILED:
                    fallar("no-encontrado", "No se pudo conectar con el pastillero.");
                    break;
                case ESPConstants.EVENT_DEVICE_DISCONNECTED:
                    fallar("desconocido", "El pastillero se desconectó.");
                    break;
            }
        }

        /**
         * El core Arduino-ESP32 3.3 cifra con nonce incremental (parche 1 de Security 2) pero no anuncia
         * "sec_patch_ver" en proto-ver, y la librería asume entonces el parche 0: el primer mensaje cifrado
         * funciona y el siguiente falla al descifrar. Se fija el parche 1 antes de abrir la sesión.
         */
        private void forzarParcheSeguridad() {
            try {
                for (Field campo : ESPDevice.class.getDeclaredFields()) {
                    campo.setAccessible(true);
                    Object valor = campo.get(dispositivo);
                    if (!(valor instanceof BLETransport)) continue;
                    BLETransport ble = (BLETransport) valor;
                    JSONObject info = new JSONObject(ble.versionInfo);
                    JSONObject prov = info.getJSONObject("prov");
                    if (prov.has("sec_patch_ver")) return;
                    prov.put("sec_patch_ver", 1);
                    ble.versionInfo = info.toString();
                    return;
                }
            } catch (ReflectiveOperationException | JSONException | RuntimeException ignorada) {}
        }

        private void abrirSesion() {
            paso("enviando");
            forzarParcheSeguridad();
            // Con Security 2 un PoP incorrecto hace fallar aquí, antes de enviar nada.
            dispositivo.initSession(new ResponseListener() {
                @Override
                public void onSuccess(byte[] respuesta) {
                    if (soloRedes) {
                        pedirRedes();
                    } else {
                        enviarDatos();
                    }
                }

                @Override
                public void onFailure(Exception e) {
                    fallar("pop-invalido", "No se pudo abrir la sesión segura.");
                }
            });
        }

        private void pedirRedes() {
            dispositivo.scanNetworks(new WiFiScanListener() {
                @Override
                public void onWifiListReceived(ArrayList<WiFiAccessPoint> redes) {
                    JSArray lista = new JSArray();
                    for (WiFiAccessPoint red : redes) {
                        JSObject item = new JSObject();
                        item.put("ssid", red.getWifiName());
                        item.put("rssi", red.getRssi());
                        item.put("segura", red.getSecurity() != ESPConstants.WIFI_OPEN);
                        lista.put(item);
                    }
                    if (!terminar()) return;
                    JSObject resultado = new JSObject();
                    resultado.put("redes", lista);
                    call.resolve(resultado);
                }

                @Override
                public void onWiFiScanFailed(Exception e) {
                    fallar("desconocido", "El pastillero no pudo buscar redes Wi-Fi.");
                }
            });
        }

        private void enviarDatos() {
            dispositivo.sendDataToCustomEndPoint(ENDPOINT_DATOS, datos, new ResponseListener() {
                @Override
                public void onSuccess(byte[] respuesta) {
                    enviarWifi();
                }

                @Override
                public void onFailure(Exception e) {
                    fallar("desconocido", "El pastillero rechazó los datos de enrolamiento.");
                }
            });
        }

        private void enviarWifi() {
            dispositivo.provision(ssid, password, new ProvisionListener() {
                @Override
                public void createSessionFailed(Exception e) {
                    fallar("pop-invalido", "No se pudo abrir la sesión segura.");
                }

                @Override
                public void wifiConfigSent() {
                    paso("wifi");
                }

                @Override
                public void wifiConfigFailed(Exception e) {
                    fallar("desconocido", "No se pudo enviar la configuración Wi-Fi.");
                }

                @Override
                public void wifiConfigApplied() {}

                @Override
                public void wifiConfigApplyFailed(Exception e) {
                    fallar("wifi", "El pastillero no pudo aplicar la configuración Wi-Fi.");
                }

                @Override
                public void provisioningFailedFromDevice(ESPConstants.ProvisionFailureReason motivo) {
                    boolean errorDeWifi =
                        motivo == ESPConstants.ProvisionFailureReason.AUTH_FAILED || motivo == ESPConstants.ProvisionFailureReason.NETWORK_NOT_FOUND;
                    fallar(errorDeWifi ? "wifi" : "desconocido", "El pastillero no pudo conectarse al Wi-Fi: " + motivo);
                }

                @Override
                public void deviceProvisioningSuccess() {
                    terminar();
                    call.resolve();
                }

                @Override
                public void onProvisioningFailed(Exception e) {
                    fallar("desconocido", "Falló el aprovisionamiento.");
                }
            });
        }

        private void paso(String nombre) {
            if (soloRedes || terminada.get()) return;
            JSObject datosPaso = new JSObject();
            datosPaso.put("paso", nombre);
            notifyListeners("paso", datosPaso);
        }

        private void fallar(String codigo, String mensaje) {
            if (!terminar()) return;
            call.reject(mensaje, codigo);
        }

        /** Corta la sesión porque empezó otra. Devuelve true si seguía en curso. */
        boolean cancelar() {
            if (!terminar()) return false;
            call.reject("Se inició otra conexión con el pastillero.", "cancelado");
            return true;
        }

        /** Libera recursos una sola vez. Devuelve false si la sesión ya había terminado. */
        private boolean terminar() {
            if (!terminada.compareAndSet(false, true)) return false;
            main.removeCallbacks(limiteDeTiempo);
            if (sesionActiva == this) sesionActiva = null;
            if (!registrada) return true;
            try {
                EventBus.getDefault().unregister(this);
            } catch (RuntimeException ignorada) {}
            try {
                manager.stopBleScan();
                dispositivo.disconnectDevice();
            } catch (RuntimeException ignorada) {}
            return true;
        }
    }
}
