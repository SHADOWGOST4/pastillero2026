package com.pillbox.alarmamedicacion;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import java.util.ArrayList;
import java.util.List;

/** Programa las alarmas con AlarmManager.setAlarmClock: exacta, no se retrasa en Doze y se ve como alarma del sistema. */
final class Programador {
    private Programador() {}

    /** Reemplaza todas las alarmas programadas por las de la lista. */
    static synchronized void reprogramar(Context contexto, List<Programada> nuevas) {
        AlarmManager am = contexto.getSystemService(AlarmManager.class);
        for (Programada anterior : Almacen.programadas(contexto)) {
            am.cancel(intentSonar(contexto, anterior));
        }
        long ahora = System.currentTimeMillis();
        List<Programada> vigentes = new ArrayList<>();
        for (Programada p : nuevas) {
            if (p.disparoMs <= ahora) continue;
            programar(contexto, am, p);
            vigentes.add(p);
        }
        Almacen.guardarProgramadas(contexto, vigentes);
    }

    /** Tras un reinicio, una actualización o un cambio de hora Android borra las alarmas: se vuelven a crear. */
    static void restaurar(Context contexto) {
        reprogramar(contexto, Almacen.programadas(contexto));
    }

    /** Ya sonó: deja de figurar como pendiente. */
    static synchronized void olvidar(Context contexto, Programada p) {
        List<Programada> resto = new ArrayList<>();
        for (Programada otra : Almacen.programadas(contexto)) {
            if (!otra.clave().equals(p.clave())) resto.add(otra);
        }
        Almacen.guardarProgramadas(contexto, resto);
    }

    /** La toma se resolvió antes de sonar (o mientras estaba pospuesta): se cancelan sus alarmas. */
    static synchronized void cancelarToma(Context contexto, int horarioId, long instanteMs) {
        AlarmManager am = contexto.getSystemService(AlarmManager.class);
        List<Programada> resto = new ArrayList<>();
        for (Programada p : Almacen.programadas(contexto)) {
            if (p.esDeLaToma(horarioId, instanteMs)) {
                am.cancel(intentSonar(contexto, p));
            } else {
                resto.add(p);
            }
        }
        Almacen.guardarProgramadas(contexto, resto);
    }

    static synchronized void posponer(Context contexto, Programada original, long milisegundos) {
        Programada pospuesta = new Programada(
            original.horarioId, original.instanteMs, System.currentTimeMillis() + milisegundos,
            original.titulo, original.cuerpo, true
        );
        List<Programada> lista = Almacen.programadas(contexto);
        lista.add(pospuesta);
        programar(contexto, contexto.getSystemService(AlarmManager.class), pospuesta);
        Almacen.guardarProgramadas(contexto, lista);
    }

    private static void programar(Context contexto, AlarmManager am, Programada p) {
        PendingIntent sonar = intentSonar(contexto, p);
        try {
            am.setAlarmClock(new AlarmManager.AlarmClockInfo(p.disparoMs, intentAbrirApp(contexto)), sonar);
        } catch (SecurityException sinPermiso) {
            // Sin el permiso de alarmas exactas suena igual, con la imprecisión que Android permita.
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, p.disparoMs, sonar);
        }
    }

    static PendingIntent intentSonar(Context contexto, Programada p) {
        Intent intent = new Intent(contexto, AlarmaReceiver.class)
            .setAction(Alarma.ACCION_SONAR)
            .putExtra("horarioId", p.horarioId)
            .putExtra("instanteMs", p.instanteMs)
            .putExtra("disparoMs", p.disparoMs)
            .putExtra("titulo", p.titulo)
            .putExtra("cuerpo", p.cuerpo)
            .putExtra("pospuesta", p.pospuesta);
        return PendingIntent.getBroadcast(
            contexto, p.codigoPeticion(), intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }

    static PendingIntent intentAbrirApp(Context contexto) {
        Intent abrir = contexto.getPackageManager().getLaunchIntentForPackage(contexto.getPackageName());
        if (abrir == null) abrir = new Intent();
        return PendingIntent.getActivity(contexto, 4, abrir, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
