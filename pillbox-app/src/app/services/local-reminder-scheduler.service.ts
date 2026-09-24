import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Capacitor } from '@capacitor/core';
import { HorarioResponse } from '../core/models/api.interfaces';
import { Horario } from './horario';

const VENTANA_DIAS = 3;
// Rango de IDs reservado para estas alarmas: siempre se cancela por completo
// antes de reprogramar, así nunca queda una huérfana acumulándose entre
// sesiones (Android tiene un límite duro de 500 alarmas concurrentes por
// app; MAX_ALARMAS se mantiene bien por debajo para dejar margen a otras
// notificaciones y evitar ese límite pase lo que pase, incluso con un
// horario mal cargado con una frecuencia de pocas horas).
const ID_BASE = 900_000;
const MAX_ALARMAS = 40;

/**
 * Programa las tomas próximas como alarmas exactas del sistema operativo
 * (@capacitor/local-notifications), independientes de FCM/red/servidor.
 * Es el canal más confiable para el dueño del teléfono: si Google Play
 * Services no está disponible, si no hay internet, o si el cron del
 * servidor se cae, esta alarma igual dispara a la hora programada. FCM
 * sigue siendo el único canal para avisarle a los monitores/cuidadores,
 * que ven el horario de otra cuenta.
 */
@Injectable({ providedIn: 'root' })
export class LocalReminderSchedulerService {
  private sincronizando = false;

  constructor(private readonly horarioService: Horario) {}

  isSupported(): boolean {
    return Capacitor.getPlatform() === 'android';
  }

  async sync(): Promise<void> {
    if (!this.isSupported() || this.sincronizando) {
      return;
    }

    this.sincronizando = true;
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');

      // Cancela siempre TODO el rango reservado, no solo lo que recordemos
      // haber programado nosotros mismos — así una sincronización previa
      // interrumpida (crash, cierre forzado) nunca deja alarmas huérfanas.
      await LocalNotifications.cancel({
        notifications: Array.from({ length: MAX_ALARMAS }, (_, i) => ({ id: ID_BASE + i })),
      });

      const horarios = await firstValueFrom(this.horarioService.getAll());
      const ahora = new Date();

      const candidatas: Array<{ fecha: Date; horario: HorarioResponse }> = [];
      for (const horario of horarios) {
        if (!horario.activo || horario.eliminado) {
          continue;
        }
        for (const ocurrencia of this.proximasOcurrencias(horario, ahora)) {
          candidatas.push({ fecha: ocurrencia, horario });
        }
      }

      candidatas.sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
      const seleccionadas = candidatas.slice(0, MAX_ALARMAS);

      const notificaciones = seleccionadas.map(({ fecha, horario }, indice) => ({
        id: ID_BASE + indice,
        title: 'Hora de tomar tu medicamento',
        body: `${horario.medicamento_nombre} · ${this.formatearHora(fecha)}`,
        schedule: { at: fecha, allowWhileIdle: true as const },
        extra: { horarioId: horario.id, targetUrl: '/dashboard' },
      }));

      if (notificaciones.length) {
        await LocalNotifications.schedule({ notifications: notificaciones });
      }

      console.log(`[RecordatorioLocal] ${notificaciones.length} alarmas programadas (de ${candidatas.length} candidatas en ${VENTANA_DIAS} días)`);
    } catch (error) {
      console.error(`[RecordatorioLocal] error sincronizando alarmas: ${String(error)}`);
    } finally {
      this.sincronizando = false;
    }
  }

  /** Calcula las próximas ocurrencias de un horario dentro de la ventana,
   * respetando el mismo criterio de frecuencia que usa el backend (horas
   * entre tomas) y el fin de tratamiento (fecha_fin/duracion_dias). */
  private proximasOcurrencias(horario: HorarioResponse, ahora: Date): Date[] {
    if (!horario.proxima_toma) {
      return [];
    }

    const primera = new Date(horario.proxima_toma);
    if (Number.isNaN(primera.getTime())) {
      return [];
    }

    const freqHoras = horario.frecuencia > 0 && horario.frecuencia < 24 ? horario.frecuencia : 24;
    const pasoMs = freqHoras * 3_600_000;
    const limiteVentana = ahora.getTime() + VENTANA_DIAS * 24 * 3_600_000;
    const limiteTratamiento = this.finDeTratamiento(horario);

    const ocurrencias: Date[] = [];
    // Tope defensivo por horario, además del tope global: ningún horario
    // individual (aunque tenga una frecuencia mal cargada de 1h) puede
    // generar por sí solo más que esto.
    const maxPorHorario = MAX_ALARMAS;
    for (
      let fecha = primera;
      fecha.getTime() <= limiteVentana && ocurrencias.length < maxPorHorario;
      fecha = new Date(fecha.getTime() + pasoMs)
    ) {
      if (limiteTratamiento && fecha.getTime() > limiteTratamiento.getTime()) {
        break;
      }
      ocurrencias.push(fecha);
    }

    return ocurrencias;
  }

  private finDeTratamiento(horario: HorarioResponse): Date | null {
    if (horario.tipo_duracion === 'FECHA' && horario.fecha_fin) {
      const fin = new Date(`${horario.fecha_fin}T23:59:59`);
      return Number.isNaN(fin.getTime()) ? null : fin;
    }

    if (horario.tipo_duracion === 'DIAS' && horario.duracion_dias) {
      const inicio = new Date(`${horario.fecha_inicio}T00:00:00`);
      if (Number.isNaN(inicio.getTime())) {
        return null;
      }
      return new Date(inicio.getTime() + horario.duracion_dias * 24 * 3_600_000);
    }

    return null;
  }

  private formatearHora(fecha: Date): string {
    return fecha.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  }
}
