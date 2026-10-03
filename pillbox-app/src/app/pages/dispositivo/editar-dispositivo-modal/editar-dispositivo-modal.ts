import { CommonModule } from '@angular/common';
import { Component, EventEmitter, HostListener, Input, OnChanges, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DispositivoResponse } from '../../../core/models/api.interfaces';

/** Modal para editar lo único que el usuario puede cambiar de un pastillero: su nombre. */
@Component({
  selector: 'app-editar-dispositivo-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './editar-dispositivo-modal.html',
  styleUrl: './editar-dispositivo-modal.css',
})
export class EditarDispositivoModal implements OnChanges {
  @Input() visible = false;
  @Input() dispositivo: DispositivoResponse | null = null;
  @Input() busy = false;
  @Input() error = '';
  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<string>();

  nombre = '';
  intentado = false;

  ngOnChanges(): void {
    if (this.visible && this.dispositivo) {
      this.nombre = this.dispositivo.nombre;
      this.intentado = false;
    }
  }

  get nombreValido(): boolean {
    return this.nombre.trim().length > 0 && this.nombre.trim().length <= 100;
  }

  get sinCambios(): boolean {
    return this.nombre.trim() === this.dispositivo?.nombre;
  }

  guardar(): void {
    this.intentado = true;
    if (!this.nombreValido || this.busy) return;
    if (this.sinCambios) {
      this.closed.emit();
      return;
    }
    this.saved.emit(this.nombre.trim());
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.visible && !this.busy) this.closed.emit();
  }
}
