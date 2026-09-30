package com.pillbox.espprovisioning;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.le.ScanResult;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.ParcelUuid;
import com.espressif.provisioning.DeviceConnectionEvent;
import com.espressif.provisioning.ESPConstants;
import com.espressif.provisioning.ESPDevice;
import com.espressif.provisioning.ESPProvisionManager;
import com.espressif.provisioning.listeners.BleScanListener;
import com.espressif.provisioning.listeners.ProvisionListener;
import com.espressif.provisioning.listeners.ResponseListener;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;
import org.greenrobot.eventbus.EventBus;
import org.greenrobot.eventbus.Subscribe;
import org.greenrobot.eventbus.ThreadMode;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Aprovisiona un ESP32 por BLE con Security 2 y le entrega, por el canal cifrado,
 * el Wi-Fi y los datos de enrolamiento.
 *
 * Contrato con el firmware:
 *  - Security 2 con usuario {@link #USUARIO_SEC2} y el PoP del QR como contraseña.
 *  - Endpoint personalizado {@link #ENDPOINT_DATOS} que recibe un JSON UTF-8
 *    {"device_id", "enrollment_code", "api_url"} ANTES de las credenciales Wi-Fi.
 *
 * Errores (código de rechazo): permisos, bluetooth-apagado, no-encontrado,
 * pop-invalido, wifi y desconocido.
 */
@CapacitorPlugin(
    name = "EspProvisioning",
    permissions = {
        @Permission(alias = "bluetooth", strings = { Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_CONNECT }),
        @Permission(alias = "ubicacion", strings = { Manifest.permission.ACCESS_FINE_LOCATION })
    }
)
public class EspProvisioningPlugin extends Plugin {

    static final String USUARIO_SEC2 = "wifiprov";
    static final String ENDPOINT_DATOS = "custom-data";
    private static final long TIEMPO_MAXIMO_MS = 60_000;

    private final Handler main = new Handler(Looper.getMainLooper());

    private String aliasNecesario() {
        // Desde Android 12 el escaneo BLE usa permisos propios; antes exigía ubicación.
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ? "bluetooth" : "ubicacion";
    }

    @PluginMethod
    public void provision(PluginCall call) {
        BluetoothAdapter adaptador = BluetoothAdapter.getDefaultAdapter();
        if (adaptador == null || !adaptador.isEnabled()) {
            call.reject("El Bluetooth está apagado.", "bluetooth-apagado");
            return;
        }
        if (getPermissionState(aliasNecesario()) != PermissionState.GRANTED) {
            requestPermissionForAlias(aliasNecesario(), call, "resultadoPermisos");
            return;
        }
        ejecutar(call);
    }

    @PermissionCallback
    private void resultadoPermisos(PluginCall call) {
        if (getPermissionState(aliasNecesario()) == PermissionState.GRANTED) {
            ejecutar(call);
        } else {
            call.reject("Permisos de Bluetooth denegados.", "permisos");
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
        new Sesion(call, nombreBle, pop, ssid, password, datos).iniciar();
    }

    /** Una ejecución completa: buscar, conectar, sesión segura, datos de enrolamiento y Wi-Fi. */
    public class Sesion {

        private final PluginCall call;
        private final String nombreBle;
        private final String ssid;
        private final String password;
        private final byte[] datos;
        private final ESPProvisionManager manager;
        private final ESPDevice dispositivo;
        private final AtomicBoolean encontrado = new AtomicBoolean(false);
        private final AtomicBoolean terminada = new AtomicBoolean(false);
        private final Runnable limiteDeTiempo = () -> fallar("desconocido", "Se agotó el tiempo de espera.");

        Sesion(PluginCall call, String nombreBle, String pop, String ssid, String password, byte[] datos) {
            this.call = call;
            this.nombreBle = nombreBle;
            this.ssid = ssid;
            this.password = password;
            this.datos = datos;
            this.manager = ESPProvisionManager.getInstance(getContext().getApplicationContext());
            this.dispositivo = manager.createESPDevice(ESPConstants.TransportType.TRANSPORT_BLE, ESPConstants.SecurityType.SECURITY_2);
            this.dispositivo.setUserName(USUARIO_SEC2);
            this.dispositivo.setProofOfPossession(pop);
        }

        void iniciar() {
            EventBus.getDefault().register(this);
            main.postDelayed(limiteDeTiempo, TIEMPO_MAXIMO_MS);
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

        private void abrirSesion() {
            paso("enviando");
            // Con Security 2 un PoP incorrecto hace fallar aquí, antes de enviar nada.
            dispositivo.initSession(new ResponseListener() {
                @Override
                public void onSuccess(byte[] respuesta) {
                    enviarDatos();
                }

                @Override
                public void onFailure(Exception e) {
                    fallar("pop-invalido", "No se pudo abrir la sesión segura.");
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
            if (terminada.get()) return;
            JSObject datosPaso = new JSObject();
            datosPaso.put("paso", nombre);
            notifyListeners("paso", datosPaso);
        }

        private void fallar(String codigo, String mensaje) {
            if (!terminar()) return;
            call.reject(mensaje, codigo);
        }

        /** Libera recursos una sola vez. Devuelve false si la sesión ya había terminado. */
        private boolean terminar() {
            if (!terminada.compareAndSet(false, true)) return false;
            main.removeCallbacks(limiteDeTiempo);
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
