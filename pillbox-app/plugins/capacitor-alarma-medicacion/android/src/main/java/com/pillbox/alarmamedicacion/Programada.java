package com.pillbox.alarmamedicacion;

import org.json.JSONException;
import org.json.JSONObject;

/** Una alarma de toma: a qué horario y a qué instante pertenece, y cuándo debe sonar (distinto si se pospuso). */
final class Programada {
    final int horarioId;
    /** Instante programado de la toma: junto con el horario, es su identidad. */
    final long instanteMs;
    /** Cuándo suena. Igual al instante de la toma, salvo que se haya pospuesto. */
    final long disparoMs;
    final String titulo;
    final String cuerpo;
    final boolean pospuesta;

    Programada(int horarioId, long instanteMs, long disparoMs, String titulo, String cuerpo, boolean pospuesta) {
        this.horarioId = horarioId;
        this.instanteMs = instanteMs;
        this.disparoMs = disparoMs;
        this.titulo = titulo;
        this.cuerpo = cuerpo;
        this.pospuesta = pospuesta;
    }

    String clave() {
        return horarioId + "|" + instanteMs + (pospuesta ? "|p" : "");
    }

    int codigoPeticion() {
        return clave().hashCode();
    }

    /** Las horas del servidor y del teléfono pueden diferir unos segundos: se acepta un minuto de margen. */
    boolean esDeLaToma(int otroHorarioId, long otroInstanteMs) {
        return horarioId == otroHorarioId && Math.abs(instanteMs - otroInstanteMs) <= Alarma.TOLERANCIA_MS;
    }

    JSONObject aJson() {
        try {
            return new JSONObject()
                .put("horarioId", horarioId)
                .put("instanteMs", instanteMs)
                .put("disparoMs", disparoMs)
                .put("titulo", titulo)
                .put("cuerpo", cuerpo)
                .put("pospuesta", pospuesta);
        } catch (JSONException e) {
            throw new IllegalStateException(e);
        }
    }

    static Programada deJson(JSONObject o) throws JSONException {
        long instante = o.getLong("instanteMs");
        return new Programada(
            o.getInt("horarioId"),
            instante,
            o.optLong("disparoMs", instante),
            o.optString("titulo", ""),
            o.optString("cuerpo", ""),
            o.optBoolean("pospuesta", false)
        );
    }
}
