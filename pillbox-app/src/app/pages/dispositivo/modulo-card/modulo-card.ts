import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { HorarioResponse, ModuloResponse } from '../../../core/models/api.interfaces';
import { horaCorta } from '../../../core/utils/pastillero';

/** Un módulo del pastillero: si la placa lo ve, el estado de su tapa y los horarios de su medicamento. */
@Component({
  selector: 'app-modulo-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './modulo-card.html',
  styleUrl: './modulo-card.css',
})
export class ModuloCard {
  @Input({ required: true }) modulo!: ModuloResponse;
  /** Todos los horarios del usuario; la tarjeta toma los de su medicamento. */
  @Input() horarios: HorarioResponse[] = [];
  @Output() asignar = new EventEmitter<ModuloResponse>();
  @Output() desasignar = new EventEmitter<ModuloResponse>();

  get textoTapa(): string | null {
    if (!this.modulo.detectado || this.modulo.tapa_abierta === null) return null;
    return this.modulo.tapa_abierta ? 'Tapa abierta' : 'Tapa cerrada';
  }

  get horasDelMedicamento(): string[] {
    if (this.modulo.id_medicamento === null) return [];
    return this.horarios
      .filter((h) => h.id_medicamento === this.modulo.id_medicamento && h.activo && !h.eliminado)
      .map((h) => horaCorta(h.hora_toma))
      .sort();
  }
}
