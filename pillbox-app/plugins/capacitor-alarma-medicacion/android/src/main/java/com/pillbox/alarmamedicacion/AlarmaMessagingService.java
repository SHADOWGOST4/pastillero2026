package com.pillbox.alarmamedicacion;

import androidx.annotation.NonNull;
import com.capacitorjs.plugins.pushnotifications.MessagingService;
import com.google.firebase.messaging.RemoteMessage;
import java.util.Map;

/**
 * Atiende primero los mensajes de datos "toma_confirmada" que manda el servidor cuando una toma se confirma (en la app,
 * en la placa o en otro teléfono), para apagar la alarma aunque la app esté cerrada. Cualquier otro mensaje sigue su
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
        super.onMessageReceived(mensaje);
    }
}
