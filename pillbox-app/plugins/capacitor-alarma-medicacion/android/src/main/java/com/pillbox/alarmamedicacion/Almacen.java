package com.pillbox.alarmamedicacion;

import android.content.Context;
import android.content.SharedPreferences;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Lo que debe sobrevivir a un reinicio o a una actualización de la app: las alarmas programadas (AlarmManager las
 * pierde en ambos casos) y las tomas que la persona confirmó desde la alarma, pendientes de enviarse al servidor.
 */
final class Almacen {
    private static final String PREFS = "alarma_medicacion";
    private static final String PROGRAMADAS = "programadas";
    private static final String CONFIRMACIONES = "confirmaciones";

    private Almacen() {}

    private static SharedPreferences prefs(Context contexto) {
        return contexto.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static synchronized List<Programada> programadas(Context contexto) {
        List<Programada> lista = new ArrayList<>();
        try {
            JSONArray arreglo = new JSONArray(prefs(contexto).getString(PROGRAMADAS, "[]"));
            for (int i = 0; i < arreglo.length(); i++) {
                lista.add(Programada.deJson(arreglo.getJSONObject(i)));
            }
        } catch (JSONException ignorada) {
            // Un dato corrupto no debe impedir que sigan sonando las demás alarmas.
        }
        return lista;
    }

    static synchronized void guardarProgramadas(Context contexto, List<Programada> lista) {
        JSONArray arreglo = new JSONArray();
        for (Programada p : lista) arreglo.put(p.aJson());
        prefs(contexto).edit().putString(PROGRAMADAS, arreglo.toString()).apply();
    }

    static synchronized void agregarConfirmacion(Context contexto, int horarioId, long instanteMs) {
        try {
            JSONArray arreglo = new JSONArray(prefs(contexto).getString(CONFIRMACIONES, "[]"));
            for (int i = 0; i < arreglo.length(); i++) {
                JSONObject o = arreglo.getJSONObject(i);
                if (o.getInt("horarioId") == horarioId && o.getLong("instanteMs") == instanteMs) return;
            }
            arreglo.put(new JSONObject().put("horarioId", horarioId).put("instanteMs", instanteMs));
            // commit(): la persona acaba de decir "ya lo tomé"; no se puede perder si el proceso muere ahora.
            prefs(contexto).edit().putString(CONFIRMACIONES, arreglo.toString()).commit();
        } catch (JSONException ignorada) {
            // Nada que hacer: el dato guardado no era un arreglo válido.
        }
    }

    static synchronized JSONArray confirmaciones(Context contexto) {
        try {
            return new JSONArray(prefs(contexto).getString(CONFIRMACIONES, "[]"));
        } catch (JSONException e) {
            return new JSONArray();
        }
    }

    static synchronized void limpiarConfirmaciones(Context contexto) {
        prefs(contexto).edit().remove(CONFIRMACIONES).commit();
    }
}
