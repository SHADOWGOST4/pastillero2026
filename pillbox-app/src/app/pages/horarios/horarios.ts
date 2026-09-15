import { Component, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatRadioModule } from '@angular/material/radio';
import {
  ActualizarHorarioRequest,
  CrearHorarioRequest,
  HorarioResponse,
  MedicamentoResponse,
  TipoDuracion,
} from '../../core/models/api.interfaces';
import { Medicamento } from '../../services/medicamento';
import { Horario } from '../../services/horario';
import { ConfirmModal } from '../../shared/confirm-modal/confirm-modal';

@Component({
  selector: 'app-horarios',
  standalone: true,
  imports: [CommonModule, FormsModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatRadioModule, ConfirmModal],
  templateUrl: './horarios.html',
  styleUrl: './horarios.css',
})
export class Horarios implements OnInit {
  horarios: HorarioResponse[] = [];
  medicamentos: MedicamentoResponse[] = [];
  totalHorarios = 0;
  paginaActual = 1;
  totalPaginas = 1;
  private pageSize = 10;
  loading = false;
  submitting = false;
  errorMessage = '';
  successMessage = '';
  isEditMode = false;
  modalFormularioAbierto = false;
  editingId: number | null = null;
  modalEliminarAbierto = false;
  eliminando = false;
  horarioPendienteEliminar: number | null = null;
  accionModal: 'deshabilitar' | 'eliminar' = 'deshabilitar';

  form: CrearHorarioRequest = {
    id_medicamento: 0,
    hora_toma: '',
    frecuencia: 0,
    cantidad_por_toma: 1,
    fecha_inicio: this.fechaActual(),
    tipo_duracion: 'INDEFINIDO',
    duracion_dias: null,
    fecha_fin: null,
  };

  constructor(
    private horarioService: Horario,
    private medicamentoService: Medicamento,
  ) {}

  @HostListener('document:keydown.escape')
  cerrarModalConEscape(): void {
    if (this.modalFormularioAbierto && !this.submitting) {
      this.resetForm();
    }
  }

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

  cargarHorarios(pagina = this.paginaActual): void {
    this.loading = true;
    this.errorMessage = '';

    this.horarioService.getPage(pagina).subscribe({
      next: (data) => {
        if (data.results.length === 0 && data.count > 0 && pagina > 1) {
          this.cargarHorarios(pagina - 1);
          return;
        }
        this.horarios = data.results;
        this.totalHorarios = data.count;
        this.paginaActual = pagina;
        if (data.page_size || (data.next && data.results.length > 0)) {
          this.pageSize = data.page_size ?? data.results.length;
        }
        this.totalPaginas = Math.max(1, Math.ceil(data.count / this.pageSize));
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = this.extraerError(err, 'No se pudieron cargar los horarios.');
      },
    });
  }

  paginaAnterior(): void {
    if (this.paginaActual > 1) {
      this.cargarHorarios(this.paginaActual - 1);
    }
  }

  paginaSiguiente(): void {
    if (this.paginaActual < this.totalPaginas) {
      this.cargarHorarios(this.paginaActual + 1);
    }
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

    if (!Number.isInteger(payload.cantidad_por_toma) || payload.cantidad_por_toma < 1) {
      this.errorMessage = 'La cantidad por toma debe ser un entero mayor o igual a 1.';
      this.successMessage = '';
      return;
    }

    if (!payload.fecha_inicio) {
      this.errorMessage = 'Debes indicar la fecha de inicio.';
      this.successMessage = '';
      return;
    }

    if (payload.tipo_duracion === 'DIAS' &&
      (!Number.isInteger(payload.duracion_dias) || (payload.duracion_dias ?? 0) < 1)) {
      this.errorMessage = 'La duración debe ser un número entero mayor o igual a 1.';
      this.successMessage = '';
      return;
    }

    if (payload.tipo_duracion === 'FECHA' &&
      (!payload.fecha_fin || payload.fecha_fin < payload.fecha_inicio)) {
      this.errorMessage = 'La fecha de finalización debe ser igual o posterior al inicio.';
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
        this.modalFormularioAbierto = false;
        this.resetForm();
        this.cargarHorarios(this.paginaActual);
      },
      error: (err) => {
        this.submitting = false;
        this.errorMessage = this.extraerError(err, 'No se pudo guardar el horario.');
      },
    });
  }

  editarHorario(horario: HorarioResponse): void {
    this.isEditMode = true;
    this.modalFormularioAbierto = true;
    this.editingId = horario.id;
    this.form = {
      id_medicamento: horario.id_medicamento,
      hora_toma: this.toTimeInputValue(horario.hora_toma),
      frecuencia: horario.frecuencia,
      cantidad_por_toma: horario.cantidad_por_toma,
      fecha_inicio: horario.fecha_inicio,
      tipo_duracion: horario.tipo_duracion,
      duracion_dias: horario.duracion_dias,
      fecha_fin: horario.fecha_fin,
    };
    this.errorMessage = '';
    this.successMessage = '';
  }

  deshabilitarHorario(id: number): void {
    this.horarioPendienteEliminar = id;
    this.accionModal = 'deshabilitar';
    this.modalEliminarAbierto = true;
  }

  eliminarHorario(id: number): void {
    this.horarioPendienteEliminar = id;
    this.accionModal = 'eliminar';
    this.modalEliminarAbierto = true;
  }

  cancelarEliminacion(): void {
    this.modalEliminarAbierto = false;
    this.horarioPendienteEliminar = null;
  }

  confirmarEliminacion(): void {
    if (this.horarioPendienteEliminar === null || this.eliminando) return;
    const id = this.horarioPendienteEliminar;
    this.eliminando = true;

    this.errorMessage = '';
    this.successMessage = '';

    const request$: Observable<void> = this.accionModal === 'eliminar'
      ? this.horarioService.delete(id)
      : this.horarioService.deshabilitar(id).pipe(map(() => undefined));

    request$.subscribe({
      next: () => {
        this.eliminando = false;
        this.cancelarEliminacion();
        this.successMessage = this.accionModal === 'eliminar'
          ? 'Horario eliminado correctamente.'
          : 'Horario deshabilitado correctamente.';
        if (this.editingId === id) {
          this.resetForm();
        }
        this.cargarHorarios(this.paginaActual);
      },
      error: (err) => {
        this.eliminando = false;
        this.cancelarEliminacion();
        this.errorMessage = this.extraerError(
          err,
          this.accionModal === 'eliminar'
            ? 'No se pudo eliminar el horario.'
            : 'No se pudo deshabilitar el horario.',
        );
      },
    });
  }

  activarHorario(id: number): void {
    this.errorMessage = '';
    this.successMessage = '';
    this.horarioService.activar(id).subscribe({
      next: () => {
        this.successMessage = 'Horario habilitado correctamente.';
        this.cargarHorarios(this.paginaActual);
      },
      error: (err) => {
        this.errorMessage = this.extraerError(err, 'No se pudo habilitar el horario.');
      },
    });
  }

  resetForm(): void {
    this.modalFormularioAbierto = false;
    this.isEditMode = false;
    this.editingId = null;
    this.form = {
      id_medicamento: 0,
      hora_toma: '',
      frecuencia: 0,
      cantidad_por_toma: 1,
      fecha_inicio: this.fechaActual(),
      tipo_duracion: 'INDEFINIDO',
      duracion_dias: null,
      fecha_fin: null,
    };
  }

  abrirFormularioNuevo(): void {
    this.resetForm();
    this.errorMessage = '';
    this.successMessage = '';
    this.modalFormularioAbierto = true;
  }

  private normalizarFormulario(): CrearHorarioRequest & ActualizarHorarioRequest {
    const hora = this.form.hora_toma?.trim();
    const frecuencia = Number(this.form.frecuencia);
    const cantidad = Number(this.form.cantidad_por_toma);
    const duracion = this.form.tipo_duracion === 'DIAS' ? Number(this.form.duracion_dias) : null;
    const fechaFin = this.form.tipo_duracion === 'FECHA' ? this.form.fecha_fin || null : null;

    return {
      id_medicamento: Number(this.form.id_medicamento),
      hora_toma: hora && hora.length === 5 ? `${hora}:00` : hora,
      frecuencia,
      cantidad_por_toma: cantidad,
      fecha_inicio: this.form.fecha_inicio,
      tipo_duracion: this.form.tipo_duracion,
      duracion_dias: duracion,
      fecha_fin: fechaFin,
    };
  }

  cambiarTipoDuracion(tipo: TipoDuracion): void {
    this.form.tipo_duracion = tipo;
    if (tipo !== 'DIAS') this.form.duracion_dias = null;
    if (tipo !== 'FECHA') this.form.fecha_fin = null;
  }

  private fechaActual(): string {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().slice(0, 10);
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
