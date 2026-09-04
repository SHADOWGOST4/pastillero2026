import { CommonModule } from '@angular/common';
import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core';

@Component({
  selector: 'app-confirm-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './confirm-modal.html',
  styleUrl: './confirm-modal.css',
})
export class ConfirmModal {
  @Input() visible = false;
  @Input() title = 'Confirmar acción';
  @Input() message = '¿Deseas continuar con esta acción?';
  @Input() confirmLabel = 'Confirmar';
  @Input() busy = false;
  @Input() icon = 'warning_amber';
  @Input() variant: 'default' | 'device' = 'default';
  @Output() closed = new EventEmitter<void>();
  @Output() confirmed = new EventEmitter<void>();

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.visible && !this.busy) this.closed.emit();
  }
}
