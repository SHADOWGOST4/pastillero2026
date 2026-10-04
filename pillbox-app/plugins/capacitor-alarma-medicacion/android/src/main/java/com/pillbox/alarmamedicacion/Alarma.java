package com.pillbox.alarmamedicacion;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.os.Build;
import android.service.notification.StatusBarNotification;

/** Constantes y utilidades compartidas por las piezas de la alarma. */
final class Alarma {
    static final String CANAL = "alarma_toma";

    static final String ACCION_SONAR = "com.pillbox.alarmamedicacion.SONAR";
    static final String ACCION_TOME = "com.pillbox.alarmamedicacion.TOME";
    static final String ACCION_POSPONER = "com.pillbox.alarmamedicacion.POSPONER";

    /** Una alarma sin atender se apaga sola a los 10 minutos, igual que la de la placa. */
    static final long DURACION_MAX_MS = 10L * 60L * 1000L;
    static final long POSPONER_MS = 5L * 60L * 1000L;
    static final long TOLERANCIA_MS = 60_000L;

    private Alarma() {}

    /** El canal no hace ruido por sí mismo: el sonido lo reproduce el servicio por el volumen de alarmas. */
    static void crearCanal(Context contexto) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = contexto.getSystemService(NotificationManager.class);
        if (nm.getNotificationChannel(CANAL) != null) return;
        NotificationChannel canal = new NotificationChannel(CANAL, "Alarma de medicación", NotificationManager.IMPORTANCE_HIGH);
        canal.setDescription("Suena cuando es hora de tomar un medicamento.");
        canal.setSound(null, null);
        canal.enableVibration(false);
        canal.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);
        nm.createNotificationChannel(canal);
    }

    /** Quita las notificaciones que Firebase publicó solas ("Hora de tomar tu medicamento") de una toma ya resuelta. */
    static void limpiarNotificacionesFcm(Context contexto) {
        NotificationManager nm = contexto.getSystemService(NotificationManager.class);
        for (StatusBarNotification n : nm.getActiveNotifications()) {
            String etiqueta = n.getTag();
            if (etiqueta != null && etiqueta.startsWith("FCM-Notification")) {
                nm.cancel(etiqueta, n.getId());
            }
        }
    }

    /** Una toma se confirmó (en la app, en la placa o por otro teléfono): ninguna alarma debe seguir sonando por ella. */
    static void tomaConfirmada(Context contexto, int horarioId, long instanteMs) {
        Programador.cancelarToma(contexto, horarioId, instanteMs);
        AlarmaService.quitarToma(horarioId, instanteMs);
        limpiarNotificacionesFcm(contexto);
    }
}
