import { Inject, Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { firstValueFrom } from 'rxjs';
import { RegistroToma } from '../registro-toma';
import {
  ALARMA_MEDICACION,
  AjusteAlarma,
  AlarmaMedicacionPlugin,
  AlarmaProgramada,
  ConfirmacionPendiente,
  EstadoPermisosAlarma,
  detenerAlarmaDeToma,
} from './alarma-medicacion.plugin';

/** La alarma nativa de las tomas (sonido en bucle, pantalla completa y botones). Solo existe en Android. */
@Injectable({ providedIn: 'root' })
export class AlarmaMedicacionService {
  constructor(
    @Inject(ALARMA_MEDICACION) private readonly plugin: AlarmaMedicacionPlugin,
    private readonly registroService: RegistroToma,
  ) {}

  soportada(): boolean {
    return Capacitor.getPlatform() === 'android';
  }

  async programar(alarmas: AlarmaProgramada[]): Promise<void> {
    if (!this.soportada()) return;
    await this.plugin.programar({ alarmas });
  }

  detenerPorToma(horarioId: number, programada: string): Promise<void> {
    return detenerAlarmaDeToma(this.plugin, horarioId, programada);
  }

  /**
   * Envía al servidor las tomas que la persona confirmó con "Ya lo tomé" en la alarma. La alarma solo puede silenciar y
   * anotar; la sesión la tiene la app, así que esto corre cuando la app se abre. Devuelve cuántas envió.
   */
  async procesarConfirmacionesPendientes(): Promise<number> {
    if (!this.soportada()) return 0;
    let confirmaciones: ConfirmacionPendiente[];
    try {
      ({ confirmaciones } = await this.plugin.confirmacionesPendientes());
    } catch (error) {
      console.error(`[AlarmaMedicacion] no se pudieron leer las confirmaciones pendientes: ${String(error)}`);
      return 0;
    }
    if (confirmaciones.length === 0) return 0;
    let enviadas = 0;
    for (const pendiente of confirmaciones) {
      try {
        // El servidor crea cada toma una sola vez, así que esto la encuentra o la crea.
        const registro = await firstValueFrom(
          this.registroService.create({
            id_horario: pendiente.horarioId,
            fecha_hora_programada: new Date(pendiente.instanteMs).toISOString(),
          }),
        );
        if (!registro.fecha_hora_real) {
          await firstValueFrom(this.registroService.confirmar(registro.id));
        }
        enviadas++;
      } catch (error) {
        // Se conservan todas: la próxima vez se reintentan y las ya confirmadas se saltan.
        console.error(`[AlarmaMedicacion] no se pudo confirmar la toma: ${String(error)}`);
        return enviadas;
      }
    }
    await this.plugin.limpiarConfirmaciones();
    this.registroService.notificarActualizacion();
    return enviadas;
  }

  estadoPermisos(): Promise<EstadoPermisosAlarma> {
    return this.plugin.estadoPermisos();
  }

  abrirAjustes(tipo: AjusteAlarma): Promise<void> {
    return this.plugin.abrirAjustes({ tipo });
  }
}
