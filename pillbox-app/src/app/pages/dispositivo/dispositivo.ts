import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ActualizarDispositivoRequest,
  CrearDispositivoRequest,
  DispositivoResponse,
} from '../../core/models/api.interfaces';
import { DispositivoService } from '../../services/dispositivo';

@Component({
  selector: 'app-dispositivo',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dispositivo.html',
  styleUrl: './dispositivo.css',
})
export class Dispositivo implements OnInit {
  dispositivos: DispositivoResponse[] = [];
  loading = false;
  submitting = false;
  errorMessage = '';
  successMessage = '';
  isEditMode = false;
  editingId: number | null = null;

  form: CrearDispositivoRequest = {
    nombre: '',
    ip_esp32: '',
    estado_conexion: false,
  };

  constructor(private dispositivoService: DispositivoService) {}

  ngOnInit(): void {
    this.cargarDispositivos();
  }

  cargarDispositivos(): void {
    this.loading = true;
    this.errorMessage = '';

    this.dispositivoService.getAll().subscribe({
      next: (data) => {
        this.dispositivos = data;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = this.extraerError(err, 'No se pudieron cargar los dispositivos.');
      },
    });
  }

  onSubmit(): void {
    if (!this.form.nombre.trim() || !this.form.ip_esp32.trim()) {
      this.errorMessage = 'El nombre y la IP del dispositivo son obligatorios.';
      this.successMessage = '';
      return;
    }

    const payload: CrearDispositivoRequest & ActualizarDispositivoRequest = {
      nombre: this.form.nombre.trim(),
      ip_esp32: this.form.ip_esp32.trim(),
      estado_conexion: Boolean(this.form.estado_conexion),
    };

    this.submitting = true;
    this.errorMessage = '';
    this.successMessage = '';

    const request$ =
      this.isEditMode && this.editingId !== null
        ? this.dispositivoService.update(this.editingId, payload)
        : this.dispositivoService.create(payload);

    request$.subscribe({
      next: () => {
        this.submitting = false;
        this.successMessage = this.isEditMode
          ? 'Dispositivo actualizado correctamente.'
          : 'Dispositivo registrado correctamente.';
        this.resetForm();
        this.cargarDispositivos();
      },
      error: (err) => {
        this.submitting = false;
        this.errorMessage = this.extraerError(err, 'No se pudo guardar el dispositivo.');
      },
    });
  }

  editarDispositivo(dispositivo: DispositivoResponse): void {
    this.isEditMode = true;
    this.editingId = dispositivo.id;
    this.form = {
      nombre: dispositivo.nombre,
      ip_esp32: dispositivo.ip_esp32,
      estado_conexion: dispositivo.estado_conexion,
    };
    this.errorMessage = '';
    this.successMessage = '';
  }

  eliminarDispositivo(id: number): void {
    const confirmado = window.confirm('¿Seguro que deseas desvincular este dispositivo?');
    if (!confirmado) {
      return;
    }

    this.dispositivoService.delete(id).subscribe({
      next: () => {
        this.successMessage = 'Dispositivo eliminado correctamente.';
        if (this.editingId === id) {
          this.resetForm();
        }
        this.cargarDispositivos();
      },
      error: (err) => {
        this.errorMessage = this.extraerError(err, 'No se pudo eliminar el dispositivo.');
      },
    });
  }

  resetForm(): void {
    this.isEditMode = false;
    this.editingId = null;
    this.form = {
      nombre: '',
      ip_esp32: '',
      estado_conexion: false,
    };
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
      return 'No se encontró el dispositivo solicitado.';
    }
    if (error?.status === 400) {
      return 'Los datos enviados no son válidos para el backend.';
    }

    return fallback;
  }
}
