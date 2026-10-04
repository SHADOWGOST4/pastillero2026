package com.pillbox.alarmamedicacion;

import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.util.Log;
import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * Hace sonar la alarma: sonido en bucle por el volumen de alarmas, vibración, notificación a pantalla completa y
 * dos botones. Corre en primer plano para que Android no la mate, y se apaga sola a los 10 minutos.
 */
public class AlarmaService extends Service {
    private static final String TAG = "AlarmaMedicacion";
    private static final int ID_NOTIFICACION = 7101;
    private static final List<Programada> SONANDO = new CopyOnWriteArrayList<>();
    private static volatile AlarmaService instancia;

    private final Handler manejador = new Handler(Looper.getMainLooper());
    private MediaPlayer reproductor;
    private Vibrator vibrador;
    private PowerManager.WakeLock wakeLock;
    private boolean sonidoIniciado = false;

    /** Las alarmas que están sonando ahora mismo. */
    static List<Programada> sonando() {
        return new ArrayList<>(SONANDO);
    }

    static void detenerTodo() {
        AlarmaService servicio = instancia;
        if (servicio != null) servicio.manejador.post(servicio::terminar);
    }

    static void quitarToma(int horarioId, long instanteMs) {
        AlarmaService servicio = instancia;
        if (servicio != null) servicio.manejador.post(() -> servicio.quitar(horarioId, instanteMs));
    }

    @Override
    public void onCreate() {
        super.onCreate();
        instancia = this;
        Alarma.crearCanal(this);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null || !Alarma.ACCION_SONAR.equals(intent.getAction())) {
            stopSelf();
            return START_NOT_STICKY;
        }
        Programada nueva = new Programada(
            intent.getIntExtra("horarioId", -1),
            intent.getLongExtra("instanteMs", 0),
            intent.getLongExtra("disparoMs", System.currentTimeMillis()),
            intent.getStringExtra("titulo"),
            intent.getStringExtra("cuerpo"),
            intent.getBooleanExtra("pospuesta", false)
        );
        boolean repetida = false;
        for (Programada p : SONANDO) {
            if (p.esDeLaToma(nueva.horarioId, nueva.instanteMs)) repetida = true;
        }
        if (!repetida) SONANDO.add(nueva);

        // Debe llamarse enseguida tras startForegroundService, aunque ya estuviera sonando otra alarma.
        mostrarEnPrimerPlano();
        if (!sonidoIniciado) {
            iniciarSonido();
            manejador.postDelayed(this::terminar, Alarma.DURACION_MAX_MS);
        }
        return START_NOT_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        instancia = null;
        manejador.removeCallbacksAndMessages(null);
        liberar();
        super.onDestroy();
    }

    private void mostrarEnPrimerPlano() {
        Notification notificacion = construirNotificacion();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(ID_NOTIFICACION, notificacion, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
        } else {
            startForeground(ID_NOTIFICACION, notificacion);
        }
    }

    private Notification construirNotificacion() {
        List<Programada> lista = sonando();
        String titulo = lista.size() == 1 ? lista.get(0).titulo : "Hora de tomar tus medicamentos";
        StringBuilder cuerpo = new StringBuilder();
        for (Programada p : lista) {
            if (cuerpo.length() > 0) cuerpo.append('\n');
            cuerpo.append(p.cuerpo);
        }
        int banderas = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        Intent pantalla = new Intent(this, AlarmaActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        Intent tome = new Intent(this, AlarmaActivity.class).setAction(Alarma.ACCION_TOME).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        Intent posponer = new Intent(this, AlarmaActivity.class).setAction(Alarma.ACCION_POSPONER).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        return new NotificationCompat.Builder(this, Alarma.CANAL)
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setContentTitle(titulo)
            .setContentText(cuerpo.toString().split("\n")[0])
            .setStyle(new NotificationCompat.BigTextStyle().bigText(cuerpo.toString()))
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setAutoCancel(false)
            .setContentIntent(Programador.intentAbrirApp(this))
            .setFullScreenIntent(PendingIntent.getActivity(this, 1, pantalla, banderas), true)
            .addAction(0, "Ya lo tomé", PendingIntent.getActivity(this, 2, tome, banderas))
            .addAction(0, "Posponer 5 min", PendingIntent.getActivity(this, 3, posponer, banderas))
            .build();
    }

    private void iniciarSonido() {
        sonidoIniciado = true;
        PowerManager pm = getSystemService(PowerManager.class);
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "pillbox:alarma");
        wakeLock.acquire(Alarma.DURACION_MAX_MS + 5_000L);
        try {
            Uri sonido = RingtoneManager.getActualDefaultRingtoneUri(this, RingtoneManager.TYPE_ALARM);
            if (sonido == null) sonido = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            reproductor = new MediaPlayer();
            reproductor.setAudioAttributes(new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build());
            reproductor.setDataSource(this, sonido);
            reproductor.setLooping(true);
            reproductor.prepare();
            reproductor.start();
        } catch (Exception e) {
            // Sin sonido sigue habiendo vibración y notificación a pantalla completa.
            Log.e(TAG, "No se pudo reproducir el sonido de la alarma", e);
        }
        vibrador = (Vibrator) getSystemService(VIBRATOR_SERVICE);
        if (vibrador != null && vibrador.hasVibrator()) {
            long[] patron = {0, 700, 500};
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrador.vibrate(VibrationEffect.createWaveform(patron, 0));
            } else {
                vibrador.vibrate(patron, 0);
            }
        }
    }

    private void quitar(int horarioId, long instanteMs) {
        for (Programada p : SONANDO) {
            if (p.esDeLaToma(horarioId, instanteMs)) SONANDO.remove(p);
        }
        if (SONANDO.isEmpty()) {
            terminar();
        } else {
            getSystemService(NotificationManager.class).notify(ID_NOTIFICACION, construirNotificacion());
        }
    }

    private void terminar() {
        manejador.removeCallbacksAndMessages(null);
        liberar();
        SONANDO.clear();
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE);
        stopSelf();
        Alarma.limpiarNotificacionesFcm(this);
    }

    private void liberar() {
        if (reproductor != null) {
            try {
                if (reproductor.isPlaying()) reproductor.stop();
            } catch (IllegalStateException ignorada) {
                // El reproductor ya estaba detenido.
            }
            reproductor.release();
            reproductor = null;
        }
        if (vibrador != null) {
            vibrador.cancel();
            vibrador = null;
        }
        if (wakeLock != null && wakeLock.isHeld()) {
            wakeLock.release();
        }
        wakeLock = null;
        sonidoIniciado = false;
    }
}
