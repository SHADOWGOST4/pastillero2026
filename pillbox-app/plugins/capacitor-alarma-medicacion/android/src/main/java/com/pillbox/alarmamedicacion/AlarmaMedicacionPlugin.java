package com.pillbox.alarmamedicacion;

import android.app.AlarmManager;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import androidx.core.app.NotificationManagerCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Alarma nativa de las tomas de medicación. La app calcula las próximas tomas y se las entrega; a partir de ahí la
 * alarma suena sin depender de la app ni de la red, y sobrevive a reinicios y a actualizaciones.
 *
 *  - programar: reemplaza las alarmas programadas.
 *  - detenerPorToma: la toma se resolvió; apaga y cancela sus alarmas.
 *  - confirmacionesPendientes / limpiarConfirmaciones: tomas que la persona confirmó desde la alarma ("Ya lo tomé")
 *    y que la app debe enviar al servidor.
 *  - estadoPermisos / abrirAjustes: lo que hace falta permitir en el teléfono para que la alarma sea fiable.
 */
@CapacitorPlugin(name = "AlarmaMedicacion")
public class AlarmaMedicacionPlugin extends Plugin {

    @PluginMethod
    public void programar(PluginCall call) {
        JSArray arreglo = call.getArray("alarmas");
        if (arreglo == null) {
            call.reject("Falta la lista de alarmas.");
            return;
        }
        Context contexto = getContext();
        try {
            Alarma.crearCanal(contexto);
            List<Programada> lista = new ArrayList<>();
            for (int i = 0; i < arreglo.length(); i++) {
                JSONObject o = arreglo.getJSONObject(i);
                long instante = o.getLong("instanteMs");
                lista.add(new Programada(
                    o.getInt("horarioId"), instante, instante, o.optString("titulo", ""), o.optString("cuerpo", ""), false
                ));
            }
            Programador.reemplazar(contexto, lista);
            call.resolve();
        } catch (JSONException e) {
            call.reject("Alarmas inválidas.", e);
        }
    }

    @PluginMethod
    public void detenerPorToma(PluginCall call) {
        try {
            JSObject datos = call.getData();
            Alarma.tomaConfirmada(getContext(), datos.getInt("horarioId"), datos.getLong("instanteMs"));
            call.resolve();
        } catch (JSONException e) {
            call.reject("Faltan horarioId e instanteMs.", e);
        }
    }

    @PluginMethod
    public void confirmacionesPendientes(PluginCall call) {
        JSObject respuesta = new JSObject();
        respuesta.put("confirmaciones", Almacen.confirmaciones(getContext()));
        call.resolve(respuesta);
    }

    @PluginMethod
    public void limpiarConfirmaciones(PluginCall call) {
        Almacen.limpiarConfirmaciones(getContext());
        call.resolve();
    }

    @PluginMethod
    public void estadoPermisos(PluginCall call) {
        Context contexto = getContext();
        JSObject estado = new JSObject();
        estado.put("notificaciones", NotificationManagerCompat.from(contexto).areNotificationsEnabled());
        AlarmManager am = contexto.getSystemService(AlarmManager.class);
        estado.put("alarmasExactas", Build.VERSION.SDK_INT < Build.VERSION_CODES.S || am.canScheduleExactAlarms());
        NotificationManager nm = contexto.getSystemService(NotificationManager.class);
        estado.put("pantallaCompleta", Build.VERSION.SDK_INT < 34 || nm.canUseFullScreenIntent());
        PowerManager pm = contexto.getSystemService(PowerManager.class);
        estado.put("sinOptimizacionBateria", pm.isIgnoringBatteryOptimizations(contexto.getPackageName()));
        call.resolve(estado);
    }

    @PluginMethod
    public void abrirAjustes(PluginCall call) {
        String tipo = call.getString("tipo", "");
        Context contexto = getContext();
        Uri paquete = Uri.parse("package:" + contexto.getPackageName());
        Intent intent;
        switch (tipo) {
            case "notificaciones":
                intent = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, contexto.getPackageName());
                break;
            case "alarmasExactas":
                intent = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S
                    ? new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, paquete)
                    : new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, paquete);
                break;
            case "pantallaCompleta":
                intent = Build.VERSION.SDK_INT >= 34
                    ? new Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, paquete)
                    : new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, paquete);
                break;
            case "bateria":
                intent = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
                break;
            default:
                call.reject("Tipo de ajuste desconocido: " + tipo);
                return;
        }
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            contexto.startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("No se pudo abrir el ajuste.", e);
        }
    }
}
