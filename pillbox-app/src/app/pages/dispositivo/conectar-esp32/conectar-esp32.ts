import { CommonModule } from '@angular/common';
import { Component, EventEmitter, OnDestroy, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { DispositivoResponse, EnrolamientoResponse } from '../../../core/models/api.interfaces';
import { EscanerQrService } from '../../../services/aprovisionamiento/escaner-qr.service';
import { QrDispositivo, parsearQrDispositivo } from '../../../services/aprovisionamiento/qr-dispositivo';
import {
  AprovisionamientoError,
  PasoAprovisionamiento,
  ProvisioningService,
} from '../../../services/aprovisionamiento/provisioning.service';
import { DispositivoService } from '../../../services/dispositivo';

export type EtapaConexion = 'inicio' | 'wifi' | 'progreso' | 'exito' | 'error';

export const ESPERA_LATIDO_MS = 90_000;
const INTERVALO_LATIDO_MS = 3_000;

const PASOS: { id: PasoAprovisionamiento | 'latido'; texto: string }[] = [
  { id: 'buscando', texto: 'Buscando tu pastillero' },
  { id: 'conectando', texto: 'Conectando de forma segura' },
  { id: 'enviando', texto: 'Enviando la configuración' },
  { id: 'wifi', texto: 'Conectando a tu Wi‑Fi' },
  { id: 'latido', texto: 'Verificando la conexión' },
];

@Component({
  selector: 'app-conectar-esp32',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './conectar-esp32.html',
  styleUrl: './conectar-esp32.css',
})
export class ConectarEsp32 implements OnDestroy {
  @Output() conectado = new EventEmitter<DispositivoResponse>();
  @Output() cancelado = new EventEmitter<void>();

  readonly pasos = PASOS;
  etapa: EtapaConexion = 'inicio';
  qr: QrDispositivo | null = null;
  ssid = '';
  password = '';
  mostrarPassword = false;
  qrManual = '';
  pasoActual = 0;
  mensajeError = '';
  escaneando = false;
  dispositivo: DispositivoResponse | null = null;

  private suscripcion?: Subscription;
  private temporizador?: ReturnType<typeof setTimeout>;

  constructor(
    public escaner: EscanerQrService,
    private provisioning: ProvisioningService,
    private dispositivoService: DispositivoService,
  ) {}

  ngOnDestroy(): void {
    this.detener();
  }

  async escanear(): Promise<void> {
    this.mensajeError = '';
    this.escaneando = true;
    try {
      const texto = await this.escaner.escanear();
      if (texto !== null) this.usarQr(texto);
    } catch {
      this.mensajeError = 'No se pudo usar la cámara. Revisa el permiso de cámara de la app.';
    } finally {
      this.escaneando = false;
    }
  }

  usarQr(texto: string): void {
    const qr = parsearQrDispositivo(texto);
    if (!qr) {
      this.mensajeError = 'Ese código QR no es de un pastillero.';
      return;
    }
    this.mensajeError = '';
    this.qr = qr;
    this.etapa = 'wifi';
  }

  get wifiValido(): boolean {
    return this.ssid.trim().length > 0 && this.password.length >= 8;
  }

  conectar(): void {
    if (!this.qr || !this.wifiValido) return;
    this.etapa = 'progreso';
    this.pasoActual = 0;
    this.mensajeError = '';
    const qr = this.qr;
    // Cada intento pide un código nuevo: el anterior pudo vencer o consumirse.
    this.dispositivoService.reclamar(qr.deviceId).subscribe({
      next: (r) => {
        this.dispositivo = r.dispositivo;
        this.iniciarAprovisionamiento(qr, r);
      },
      error: (err) => this.fallar(this.mensajeReclamo(err)),
    });
  }

  reintentar(): void {
    this.etapa = this.qr ? 'wifi' : 'inicio';
  }

  cancelar(): void {
    this.detener();
    this.cancelado.emit();
  }

  finalizar(): void {
    if (this.dispositivo) this.conectado.emit(this.dispositivo);
  }

  private iniciarAprovisionamiento(qr: QrDispositivo, r: EnrolamientoResponse): void {
    this.suscripcion = this.provisioning
      .aprovisionar({
        nombreBle: qr.nombreBle,
        pop: qr.pop,
        ssid: this.ssid.trim(),
        password: this.password,
        deviceId: r.device_id,
        enrollmentCode: r.enrollment_code,
        apiUrl: `${environment.apiUrl}iot`,
      })
      .subscribe({
        next: (paso) => (this.pasoActual = PASOS.findIndex((p) => p.id === paso)),
        error: (err) => this.fallar(this.mensajeAprovisionamiento(err)),
        complete: () => this.esperarLatido(Date.now()),
      });
  }

  private esperarLatido(inicio: number): void {
    this.pasoActual = PASOS.length - 1;
    const id = this.dispositivo?.id;
    if (id === undefined) return;
    this.dispositivoService.getById(id).subscribe({
      next: (d) => {
        const latido = d.ultimo_latido ? Date.parse(d.ultimo_latido) : 0;
        if (latido >= inicio) {
          this.dispositivo = d;
          this.password = '';
          this.etapa = 'exito';
        } else this.reprogramar(inicio);
      },
      error: () => this.reprogramar(inicio),
    });
  }

  private reprogramar(inicio: number): void {
    if (Date.now() - inicio > ESPERA_LATIDO_MS) {
      this.fallar('El pastillero no llegó a conectarse. Revisa el nombre y la contraseña del Wi‑Fi e inténtalo de nuevo.');
      return;
    }
    this.temporizador = setTimeout(() => this.esperarLatido(inicio), INTERVALO_LATIDO_MS);
  }

  private fallar(mensaje: string): void {
    this.detener();
    this.mensajeError = mensaje;
    this.etapa = 'error';
  }

  private detener(): void {
    this.suscripcion?.unsubscribe();
    if (this.temporizador) clearTimeout(this.temporizador);
  }

  private mensajeReclamo(err: { status?: number }): string {
    if (err?.status === 404) {
      return 'Este pastillero no está disponible. Verifica que el QR sea de tu equipo o que no esté vinculado a otra cuenta.';
    }
    if (err?.status === 401) return 'La sesión ha expirado. Inicia sesión nuevamente.';
    return 'No se pudo vincular el pastillero. Revisa tu conexión a Internet.';
  }

  private mensajeAprovisionamiento(err: unknown): string {
    const tipo = err instanceof AprovisionamientoError ? err.tipo : 'desconocido';
    switch (tipo) {
      case 'no-encontrado':
        return 'No encontramos el pastillero. Mantén presionado su botón 5 segundos hasta que el LED parpadee y acércate.';
      case 'pop-invalido':
        return 'No se pudo verificar que estés junto al pastillero. Comprueba que escaneaste el QR de esa placa.';
      case 'wifi':
        return 'El pastillero no pudo conectarse al Wi‑Fi. Revisa el nombre y la contraseña.';
      case 'bluetooth-apagado':
        return 'Activa el Bluetooth del teléfono e inténtalo de nuevo.';
      case 'permisos':
        return 'Faltan permisos de Bluetooth. Actívalos en los ajustes de la app.';
      default:
        return 'Ocurrió un error al configurar el pastillero. Inténtalo de nuevo.';
    }
  }
}
