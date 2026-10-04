package com.pillbox.alarmamedicacion;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Android borra las alarmas al reiniciar, al actualizar la app y al cambiar la hora: aquí se vuelven a crear. */
public class ArranqueReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context contexto, Intent intent) {
        String accion = intent.getAction();
        if (Intent.ACTION_BOOT_COMPLETED.equals(accion)
            || Intent.ACTION_MY_PACKAGE_REPLACED.equals(accion)
            || Intent.ACTION_TIME_CHANGED.equals(accion)
            || Intent.ACTION_TIMEZONE_CHANGED.equals(accion)) {
            Programador.restaurar(contexto);
        }
    }
}
