import { CommonModule } from '@angular/common';
import { Component, EventEmitter, HostListener, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';

export interface CredencialesWifi {
  ssid: string;
  password: string;
}

/** Modal con los datos de la red Wi‑Fi a la que se conectará el pastillero. */
@Component({
  selector: 'app-configurar-wifi-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './configurar-wifi-modal.html',
  styleUrl: './configurar-wifi-modal.css',
})
export class ConfigurarWifiModal implements OnChanges {
  @Input() visible = false;
  @Input() ssidInicial = '';
  @Output() closed = new EventEmitter<void>();
  @Output() submitted = new EventEmitter<CredencialesWifi>();

  ssid = '';
  password = '';
  mostrarPassword = false;
  intentado = false;

  ngOnChanges(cambios: SimpleChanges): void {
    if (cambios['visible'] && this.visible) {
      this.ssid = this.ssidInicial;
      this.password = '';
      this.mostrarPassword = false;
      this.intentado = false;
    }
  }

  get ssidValido(): boolean {
    return this.ssid.trim().length > 0;
  }

  get passwordValida(): boolean {
    return this.password.length >= 8;
  }

  conectar(): void {
    this.intentado = true;
    if (!this.ssidValido || !this.passwordValida) return;
    this.submitted.emit({ ssid: this.ssid.trim(), password: this.password });
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.visible) this.closed.emit();
  }
}
