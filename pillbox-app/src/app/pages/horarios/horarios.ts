import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ActualizarHorarioRequest,
  CrearHorarioRequest,
  HorarioResponse,
  MedicamentoResponse,
} from '../../core/models/api.interfaces';
import { Medicamento } from '../../services/medicamento';
import { Horario } from '../../services/horario';

@Component({
  selector: 'app-horarios',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './horarios.html',
  styleUrl: './horarios.css',
})
export class Horarios implements OnInit {
  horarios: HorarioResponse[] = [];
  medicamentos: MedicamentoResponse[] = [];
  loading = false;
  submitting = false;
  errorMessage = '';
  successMessage = '';
  isEditMode = false;
  editingId: number | null = null;

  form: CrearHorarioRequest = {
    id_medicamento: 0,
    hora_toma: '',
    frecuencia: 0,
  };

  constructor(
    private horarioService: Horario,
    private medicamentoService: Medicamento,
  ) {}

  ngOnInit(): void {
    this.cargarMedicamentos();
    this.cargarHorarios();
  }

  cargarMedicamentos(): void {
    this.medicamentoService.getAll().subscribe({
      next: (data) => {
        this.medicamentos = data;
      },
      error: (err) => {
        this.errorMessage = this.extraerError(err, 'No se pudieron cargar los medicamentos.');
      },
    });
  }

  cargarHorarios(): void {
    this.loading = true;
    this.errorMessage = '';

    this.horarioService.getAll().subscribe({
      next: (data) => {
        this.horarios = data;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = this.extraerError(err, 'No se pudieron cargar los horarios.');
      },
    });
  }

  onSubmit(): void {
    const payload = this.normalizarFormulario();

    if (!payload.id_medicamento || !payload.hora_toma || payload.frecuencia === null || payload.frecuencia === undefined) {
      this.errorMessage = 'Debes seleccionar medicamento, hora y frecuencia válidas.';
      this.successMessage = '';
      return;
    }

    if (payload.frecuencia < 0 || !Number.isFinite(payload.frecuencia)) {
      this.errorMessage = 'La frecuencia debe ser un número válido.';
      this.successMessage = '';
      return;
    }

    this.submitting = true;
    this.errorMessage = '';
    this.successMessage = '';

    const request$ =
      this.isEditMode && this.editingId !== null
        ? this.horarioService.update(this.editingId, payload)
        : this.horarioService.create(payload);

    request$.subscribe({
      next: () => {
        this.submitting = false;
        this.successMessage = this.isEditMode
          ? 'Horario actualizado correctamente.'
          : 'Horario creado correctamente.';
        this.resetForm();
        this.cargarHorarios();
      },
      error: (err) => {
        this.submitting = false;
        this.errorMessage = this.extraerError(err, 'No se pudo guardar el horario.');
      },
    });
  }

  editarHorario(horario: HorarioResponse): void {
    this.isEditMode = true;
    this.editingId = horario.id;
    this.form = {
      id_medicamento: horario.id_medicamento,
      hora_toma: this.toTimeInputValue(horario.hora_toma),
      frecuencia: horario.frecuencia,
    };
    this.errorMessage = '';
    this.successMessage = '';
  }

  eliminarHorario(id: number): void {
    const confirmado = window.confirm('¿Seguro que deseas eliminar este horario?');
    if (!confirmado) {
      return;
    }

    this.errorMessage = '';
    this.successMessage = '';

    this.horarioService.delete(id).subscribe({
      next: () => {
        this.successMessage = 'Horario eliminado correctamente.';
        if (this.editingId === id) {
          this.resetForm();
        }
        this.cargarHorarios();
      },
      error: (err) => {
        this.errorMessage = this.extraerError(err, 'No se pudo eliminar el horario.');
      },
    });
  }

  resetForm(): void {
    this.isEditMode = false;
    this.editingId = null;
    this.form = {
      id_medicamento: 0,
      hora_toma: '',
      frecuencia: 0,
    };
  }

  private normalizarFormulario(): CrearHorarioRequest & ActualizarHorarioRequest {
    const hora = this.form.hora_toma?.trim();
    const frecuencia = Number(this.form.frecuencia);

    return {
      id_medicamento: Number(this.form.id_medicamento),
      hora_toma: hora && hora.length === 5 ? `${hora}:00` : hora,
      frecuencia,
    };
  }

  private toTimeInputValue(value: string): string {
    if (!value) return '';
    return value.length > 5 ? value.slice(0, 5) : value;
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
      return 'No se encontró el horario solicitado.';
    }
    if (error?.status === 400) {
      return 'Los datos enviados no son válidos para el backend.';
    }

    return fallback;
  }
}
