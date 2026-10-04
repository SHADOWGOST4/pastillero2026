package com.pillbox.alarmamedicacion;

import androidx.annotation.NonNull;
import com.capacitorjs.plugins.pushnotifications.MessagingService;
import com.google.firebase.messaging.RemoteMessage;
import android.util.Log;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Atiende primero los mensajes de datos del servidor, aunque la app esté cerrada: "toma_confirmada" (la toma se confirmó
 * en la app, en la placa o en otro teléfono: apaga la alarma) y "sincronizar_alarmas" (cambió un horario: reprograma). Cualquier otro mensaje sigue su
 * camino normal por el servicio de @capacitor/push-notifications, del que hereda.
 */
public class AlarmaMessagingService extends MessagingService {
    @Override
    public void onMessageReceived(@NonNull RemoteMessage mensaje) {
        Map<String, String> datos = mensaje.getData();
        if ("toma_confirmada".equals(datos.get("tipo"))) {
            try {
                int horarioId = Integer.parseInt(datos.get("horario_id"));
                long instanteMs = Long.parseLong(datos.get("programada_ms"));
                Alarma.tomaConfirmada(getApplicationContext(), horarioId, instanteMs);
            } catch (NumberFormatException ignorada) {
                // Mensaje mal formado: no hay nada que apagar.
            }
            return;
        }
        if ("sincronizar_alarmas".equals(datos.get("tipo"))) {
            sincronizarAlarmas(datos.get("alarmas"));
            return;
        }
        super.onMessageReceived(mensaje);
    }

    /** El servidor avisa de un cambio de horarios y manda las próximas tomas: se reprograman sin abrir la app. */
    private void sincronizarAlarmas(String json) {
        if (json == null) return;
        try {
            JSONArray arreglo = new JSONArray(json);
            List<Programada> lista = new ArrayList<>();
            for (int i = 0; i < arreglo.length(); i++) {
                JSONObject o = arreglo.getJSONObject(i);
                long instante = o.getLong("i");
                lista.add(new Programada(o.getInt("h"), instante, instante, "Hora de tomar tu medicamento", o.optString("c", ""), false));
            }
            Alarma.crearCanal(getApplicationContext());
            Programador.reemplazar(getApplicationContext(), lista);
        } catch (JSONException e) {
            Log.e("AlarmaMedicacion", "Lista de alarmas inválida del servidor", e);
        }
    }
}
