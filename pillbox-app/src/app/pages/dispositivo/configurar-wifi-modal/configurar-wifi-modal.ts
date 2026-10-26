import { CommonModule } from '@angular/common';
import { Component, EventEmitter, HostListener, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { EscanerQrService } from '../../../services/aprovisionamiento/escaner-qr.service';
import { RedTelefono, RedWifi, esRedNo24GHz } from '../../../services/aprovisionamiento/provisioning.service';
import { parsearQrWifi } from '../../../services/aprovisionamiento/qr-wifi';
import { BloquearScroll } from '../../../shared/bloquear-scroll/bloquear-scroll';

export interface CredencialesWifi {
  ssid: string;
  password: string;
}

/** Modal con los datos de la red Wi‑Fi a la que se conectará el pastillero. */
@Component({
  selector: 'app-configurar-wifi-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, BloquearScroll],
  templateUrl: './configurar-wifi-modal.html',
  styleUrl: './configurar-wifi-modal.css',
})
export class ConfigurarWifiModal implements OnChanges {
  @Input() visible = false;
  @Input() ssidInicial = '';
  /** Redes que vio el pastillero; null si no se han pedido (entonces solo se escribe el nombre). */
  @Input() redes: RedWifi[] | null = null;
  @Input() buscandoRedes = false;
  @Input() errorRedes = false;
  /** La red del teléfono: se propone si el campo está vacío. */
  @Input() redTelefono: RedTelefono | null = null;
  @Output() buscarRedes = new EventEmitter<void>();
  @Output() closed = new EventEmitter<void>();
  @Output() submitted = new EventEmitter<CredencialesWifi>();

  ssid = '';
  password = '';
  mostrarPassword = false;
  intentado = false;
  /** Nombre tomado de la lista: se envía tal cual, sin recortar espacios. */
  private ssidElegido = '';
  leyendoQr = false;
  mensajeQr = '';
  errorQr = '';

  constructor(public escaner: EscanerQrService) {}

  ngOnChanges(cambios: SimpleChanges): void {
    if (cambios['visible'] && this.visible) {
      this.ssid = this.ssidInicial;
      this.ssidElegido = this.ssidInicial;
      this.password = '';
      this.mostrarPassword = false;
      this.intentado = false;
      this.mensajeQr = '';
      this.errorQr = '';
    }
    // La red del teléfono puede llegar con el modal ya abierto: solo se usa si aún no hay nombre.
    if ((cambios['visible'] || cambios['redTelefono']) && this.redTelefono && !this.ssid.trim()) {
      this.ssid = this.redTelefono.ssid;
      this.ssidElegido = this.redTelefono.ssid;
    }
  }

  get esRedDelTelefono(): boolean {
    return !!this.redTelefono && this.ssid === this.redTelefono.ssid;
  }

  /** Avisa si la red del teléfono es de 5 GHz y el pastillero no la vio en su escaneo. */
  get avisoBanda(): string | null {
    const red = this.redTelefono;
    if (!red || !this.esRedDelTelefono || !esRedNo24GHz(red) || this.buscandoRedes) return null;
    if (this.redes?.some((r) => r.ssid === red.ssid)) return null;
    return (
      `Tu teléfono está conectado a «${red.ssid}» en 5 GHz y el pastillero solo usa redes de 2,4 GHz. ` +
      'Si no logra conectarse, elige la red de 2,4 GHz de tu router.'
    );
  }

  /** Rellena nombre y contraseña desde un QR de Wi‑Fi (cámara o una captura de «Compartir»). */
  async leerQrWifi(origen: 'camara' | 'imagen'): Promise<void> {
    this.mensajeQr = '';
    this.errorQr = '';
    this.leyendoQr = true;
    try {
      const texto = origen === 'camara' ? await this.escaner.escanear() : await this.escaner.leerDeImagen();
      if (texto === null) return;
      const wifi = parsearQrWifi(texto);
      if (!wifi) {
        this.errorQr = texto === '' ? 'No encontramos ningún QR en esa imagen.' : 'Ese QR no es de una red Wi‑Fi.';
        return;
      }
      this.ssid = wifi.ssid;
      this.ssidElegido = wifi.ssid;
      this.password = wifi.password;
      this.mostrarPassword = false;
      this.mensajeQr = wifi.password ? 'Nombre y contraseña leídos del QR.' : 'Red leída del QR: no tiene contraseña.';
    } catch (err) {
      this.errorQr =
        (err as Error)?.message === 'permiso-camara'
          ? 'Activa el permiso de cámara de la app para escanear.'
          : 'No se pudo leer el QR. Inténtalo de nuevo.';
    } finally {
      this.leyendoQr = false;
    }
  }

  get ssidValido(): boolean {
    return this.ssid.trim().length > 0;
  }

  get passwordValida(): boolean {
    return this.password.length >= 8;
  }

  get mostrarRedes(): boolean {
    return this.buscandoRedes || this.redes !== null;
  }

  elegirRed(red: RedWifi): void {
    this.ssid = red.ssid;
    this.ssidElegido = red.ssid;
    (document.getElementById('wifi-password') as HTMLInputElement | null)?.focus();
  }

  iconoSenal(rssi: number): string {
    if (rssi >= -55) return 'signal_wifi_4_bar';
    if (rssi >= -67) return 'network_wifi_3_bar';
    if (rssi >= -78) return 'network_wifi_2_bar';
    return 'network_wifi_1_bar';
  }

  textoSenal(rssi: number): string {
    if (rssi >= -67) return 'señal buena';
    if (rssi >= -78) return 'señal media';
    return 'señal débil';
  }

  conectar(): void {
    this.intentado = true;
    if (!this.ssidValido || !this.passwordValida) return;
    // Lo tecleado se recorta solo en los extremos (el teclado suele añadir un espacio final).
    const ssid = this.ssid === this.ssidElegido ? this.ssid : this.ssid.trim();
    this.submitted.emit({ ssid, password: this.password });
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.visible) this.closed.emit();
  }
}
