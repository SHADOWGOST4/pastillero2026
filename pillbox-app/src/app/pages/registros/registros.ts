import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  CrearRegistroTomaRequest,
  HorarioResponse,
  RegistroTomaResponse,
} from '../../core/models/api.interfaces';
import { Horario } from '../../services/horario';
import { RegistroToma } from '../../services/registro-toma';

@Component({
  selector: 'app-registros',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './registros.html',
  styleUrl: './registros.css',
})
export class Registros implements OnInit {
  registros: RegistroTomaResponse[] = [];
  horarios: HorarioResponse[] = [];
  loading = false;
  submitting = false;
  errorMessage = '';
  successMessage = '';

  form = {
    id_horario: 0,
    fecha_hora_programada: '',
  };

  constructor(
    private registroService: RegistroToma,
    private horarioService: Horario,
  ) {}

  ngOnInit(): void {
    this.cargarHorarios();
    this.cargarRegistros();
  }

  cargarHorarios(): void {
    this.horarioService.getAll().subscribe({
      next: (data) => {
        this.horarios = data;
      },
      error: () => {
        this.errorMessage = 'No se pudieron cargar los horarios disponibles para crear registros.';
      },
    });
  }

  cargarRegistros(): void {
    this.loading = true;
    this.errorMessage = '';

    this.registroService.getAll().subscribe({
      next: (data) => {
        this.registros = data;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = this.extraerError(err, 'No se pudieron cargar los registros de toma.');
      },
    });
  }

  onSubmit(): void {
    if (!this.form.id_horario || !this.form.fecha_hora_programada) {
      this.errorMessage = 'Debes seleccionar un horario y una fecha/hora programada.';
      this.successMessage = '';
      return;
    }

    const payload: CrearRegistroTomaRequest = {
      id_horario: Number(this.form.id_horario),
      fecha_hora_programada: this.toISOString(this.form.fecha_hora_programada),
      fecha_hora_real: null,
    };

    this.submitting = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.registroService.create(payload).subscribe({
      next: () => {
        this.submitting = false;
        this.successMessage = 'Registro de toma creado correctamente.';
        this.resetForm();
        this.cargarRegistros();
      },
      error: (err) => {
        this.submitting = false;
        this.errorMessage = this.extraerError(err, 'No se pudo crear el registro de toma.');
      },
    });
  }

  confirmarRegistro(id: number): void {
    const momento = new Date().toISOString();

    this.registroService.confirm(id, { fecha_hora_real: momento }).subscribe({
      next: () => {
        this.successMessage = 'Toma confirmada correctamente.';
        this.cargarRegistros();
      },
      error: (err) => {
        this.errorMessage = this.extraerError(err, 'No se pudo confirmar la toma.');
      },
    });
  }

  eliminarRegistro(id: number): void {
    const confirmado = window.confirm('¿Seguro que deseas eliminar este registro de toma?');
    if (!confirmado) {
      return;
    }

    this.registroService.delete(id).subscribe({
      next: () => {
        this.successMessage = 'Registro eliminado correctamente.';
        this.cargarRegistros();
      },
      error: (err) => {
        this.errorMessage = this.extraerError(err, 'No se pudo eliminar el registro.');
      },
    });
  }

  resetForm(): void {
    this.form = {
      id_horario: 0,
      fecha_hora_programada: '',
    };
  }

  private toISOString(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString();
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
      return 'No se encontró el registro solicitado.';
    }
    if (error?.status === 400) {
      return 'Los datos enviados no son válidos para el backend.';
    }

    return fallback;
  }
}
