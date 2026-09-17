import { Component, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { VinculacionResponse } from '../../core/models/api.interfaces';
import { Vinculacion } from '../../services/vinculacion';
import { Auth } from '../../services/auth';
import { CuentaActiva } from '../../services/cuenta-activa';
import { ConfirmModal } from '../../shared/confirm-modal/confirm-modal';

@Component({
  selector: 'app-cuentas-vinculadas',
  standalone: true,
  imports: [CommonModule, FormsModule, MatFormFieldModule, MatInputModule, MatMenuModule, ConfirmModal],
  templateUrl: './cuentas-vinculadas.html',
  styleUrl: './cuentas-vinculadas.css',
})
export class CuentasVinculadas implements OnInit {
  vinculaciones: VinculacionResponse[] = [];
  miId: number | null = null;
  loading = false;
  submitting = false;
  errorMessage = '';
  successMessage = '';

  modalFormularioAbierto = false;
  correoMonitor = '';

  modalEliminarAbierto = false;
  eliminando = false;
  vinculacionPendienteEliminar: number | null = null;

  constructor(
    private vinculacionService: Vinculacion,
    private auth: Auth,
    private cuentaActivaService: CuentaActiva,
  ) {}

  @HostListener('document:keydown.escape')
  cerrarModalConEscape(): void {
    if (this.modalFormularioAbierto && !this.submitting) {
      this.cancelarInvitacion();
    }
  }

  ngOnInit(): void {
    this.miId = this.auth.obtenerUsuario()?.id ?? null;
    this.cargarVinculaciones();
  }

  get enviadas(): VinculacionResponse[] {
    return this.vinculaciones.filter((v) => v.titular.id === this.miId);
  }

  get recibidas(): VinculacionResponse[] {
    return this.vinculaciones.filter((v) => v.monitor.id === this.miId);
  }

  cargarVinculaciones(): void {
    this.loading = true;
    this.errorMessage = '';

    this.vinculacionService.getAll().subscribe({
      next: (data) => {
        this.vinculaciones = data;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = this.extraerError(err, 'No se pudieron cargar las cuentas vinculadas.');
      },
    });
  }

  abrirFormularioInvitar(): void {
    this.correoMonitor = '';
    this.errorMessage = '';
    this.successMessage = '';
    this.modalFormularioAbierto = true;
  }

  cancelarInvitacion(): void {
    this.modalFormularioAbierto = false;
    this.correoMonitor = '';
  }

  onSubmitInvitacion(): void {
    const correo = this.correoMonitor.trim();
    if (!correo) {
      this.errorMessage = 'Escribe el correo de la persona que quieres invitar.';
      return;
    }

    this.submitting = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.vinculacionService.create({ correo_monitor: correo }).subscribe({
      next: () => {
        this.submitting = false;
        this.successMessage = 'Invitación enviada correctamente.';
        this.modalFormularioAbierto = false;
        this.correoMonitor = '';
        this.cargarVinculaciones();
      },
      error: (err) => {
        this.submitting = false;
        this.errorMessage = this.extraerError(err, 'No se pudo enviar la invitación.');
      },
    });
  }

  aceptar(vinculacion: VinculacionResponse): void {
    this.errorMessage = '';
    this.successMessage = '';
    this.vinculacionService.aceptar(vinculacion.id).subscribe({
      next: () => {
        this.successMessage = `Ahora monitoreas la cuenta de ${vinculacion.titular.nombre}.`;
        this.cargarVinculaciones();
      },
      error: (err) => {
        this.errorMessage = this.extraerError(err, 'No se pudo aceptar la invitación.');
      },
    });
  }

  rechazar(vinculacion: VinculacionResponse): void {
    this.errorMessage = '';
    this.successMessage = '';
    this.vinculacionService.rechazar(vinculacion.id).subscribe({
      next: () => {
        this.successMessage = 'Invitación rechazada.';
        this.cargarVinculaciones();
      },
      error: (err) => {
        this.errorMessage = this.extraerError(err, 'No se pudo rechazar la invitación.');
      },
    });
  }

  togglePermiso(
    vinculacion: VinculacionResponse,
    campo: 'puede_ver_medicamentos' | 'puede_ver_horarios' | 'puede_ver_registros',
  ): void {
    const valor = !vinculacion[campo];
    this.errorMessage = '';
    this.vinculacionService.actualizarPermisos(vinculacion.id, { [campo]: valor }).subscribe({
      next: (actualizada) => {
        const idx = this.vinculaciones.findIndex((v) => v.id === actualizada.id);
        if (idx !== -1) this.vinculaciones[idx] = actualizada;
      },
      error: (err) => {
        this.errorMessage = this.extraerError(err, 'No se pudo actualizar el permiso.');
      },
    });
  }

  solicitarEliminar(id: number): void {
    this.vinculacionPendienteEliminar = id;
    this.modalEliminarAbierto = true;
  }

  cancelarEliminacion(): void {
    this.modalEliminarAbierto = false;
    this.vinculacionPendienteEliminar = null;
  }

  confirmarEliminacion(): void {
    if (this.vinculacionPendienteEliminar === null || this.eliminando) return;
    const id = this.vinculacionPendienteEliminar;
    const eraCuentaActiva = this.cuentaActivaService.obtenerCuentaActiva()?.id ===
      this.vinculaciones.find((v) => v.id === id)?.titular.id;
    this.eliminando = true;

    this.vinculacionService.delete(id).subscribe({
      next: () => {
        this.eliminando = false;
        this.cancelarEliminacion();
        this.successMessage = 'Vinculación eliminada correctamente.';
        if (eraCuentaActiva) {
          this.cuentaActivaService.volverAMiCuenta();
        }
        this.cargarVinculaciones();
      },
      error: (err) => {
        this.eliminando = false;
        this.cancelarEliminacion();
        this.errorMessage = this.extraerError(err, 'No se pudo eliminar la vinculación.');
      },
    });
  }

  obtenerIniciales(nombre: string): string {
    return nombre
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((parte) => parte.charAt(0).toUpperCase())
      .join('');
  }

  private extraerError(error: any, fallback: string): string {
    const apiError = error?.error;

    if (typeof apiError?.detail === 'string') {
      return apiError.detail;
    }

    if (typeof apiError?.message === 'string') {
      return apiError.message;
    }

    if (apiError && typeof apiError === 'object') {
      const valores = Object.values(apiError)
        .flatMap((value) => (Array.isArray(value) ? value : [value]))
        .filter((value) => typeof value === 'string');

      if (valores.length > 0) {
        return valores.join(' ');
      }
    }

    if (error?.status === 401) {
      return 'La sesión ha expirado. Inicia sesión nuevamente.';
    }
    if (error?.status === 403) {
      return 'No tienes permisos para realizar esta acción.';
    }
    if (error?.status === 404) {
      return 'No se encontró la vinculación solicitada.';
    }
    if (error?.status === 400) {
      return 'Los datos enviados no son válidos para el backend.';
    }

    return fallback;
  }
}
