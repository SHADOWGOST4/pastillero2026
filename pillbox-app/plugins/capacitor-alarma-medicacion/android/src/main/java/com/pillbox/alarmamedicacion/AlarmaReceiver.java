package com.pillbox.alarmamedicacion;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import androidx.core.content.ContextCompat;

/** AlarmManager lo despierta a la hora de la toma y arranca el servicio que hace sonar la alarma. */
public class AlarmaReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context contexto, Intent intent) {
        if (!Alarma.ACCION_SONAR.equals(intent.getAction())) return;
        Programada p = new Programada(
            intent.getIntExtra("horarioId", -1),
            intent.getLongExtra("instanteMs", 0),
            intent.getLongExtra("disparoMs", System.currentTimeMillis()),
            intent.getStringExtra("titulo"),
            intent.getStringExtra("cuerpo"),
            intent.getBooleanExtra("pospuesta", false)
        );
        Programador.olvidar(contexto, p);
        Intent servicio = new Intent(contexto, AlarmaService.class)
            .setAction(Alarma.ACCION_SONAR)
            .putExtras(intent);
        ContextCompat.startForegroundService(contexto, servicio);
    }
}
