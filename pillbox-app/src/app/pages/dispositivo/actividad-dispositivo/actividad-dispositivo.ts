import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { EventoDispositivoResponse } from '../../../core/models/api.interfaces';
import { describirEvento, tiempoRelativo } from '../../../core/utils/pastillero';

/** Lo último que informó la placa: tapas, botones, alarmas y módulos que se conectan o se van. */
@Component({
  selector: 'app-actividad-dispositivo',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './actividad-dispositivo.html',
  styleUrl: './actividad-dispositivo.css',
})
export class ActividadDispositivo {
  @Input() eventos: EventoDispositivoResponse[] = [];
  @Input() cargando = false;

  /** Eventos que merecen atención: algo que la persona hizo mal o dejó sin hacer. */
  private readonly avisos = new Set(['modulo_equivocado', 'alarma_omitida', 'modulo_desconectado']);

  descripcion(evento: EventoDispositivoResponse) {
    return describirEvento(evento);
  }

  hace(evento: EventoDispositivoResponse): string {
    return tiempoRelativo(evento.fecha_dispositivo);
  }

  esAviso(evento: EventoDispositivoResponse): boolean {
    return this.avisos.has(evento.tipo);
  }
}
