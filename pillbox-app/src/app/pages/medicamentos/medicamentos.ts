import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ActualizarMedicamentoRequest,
  CrearMedicamentoRequest,
  MedicamentoResponse,
} from '../../core/models/api.interfaces';
import { Medicamento } from '../../services/medicamento';

@Component({
  selector: 'app-medicamentos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './medicamentos.html',
  styleUrls: ['./medicamentos.css'],
})
export class Medicamentos implements OnInit {
  medicamentos: MedicamentoResponse[] = [];
  loading = false;
  submitting = false;
  isEditMode = false;
  editingId: number | null = null;
  errorMessage = '';
  successMessage = '';

  form: CrearMedicamentoRequest = {
    nombre: '',
    descripcion: '',
    dosis: '',
  };

  constructor(private medicamentoService: Medicamento) {}

  ngOnInit(): void {
    this.cargarMedicamentos();
  }

  cargarMedicamentos(): void {
    this.loading = true;
    this.errorMessage = '';

    this.medicamentoService.getAll().subscribe({
      next: (data) => {
        this.medicamentos = data;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = this.extraerError(err, 'No se pudieron cargar los medicamentos.');
      },
    });
  }

  onSubmit(): void {
    const payload = this.normalizarFormulario();

    if (!payload.nombre || !payload.dosis) {
      this.errorMessage = 'Nombre y dosis son obligatorios.';
      this.successMessage = '';
      return;
    }

    this.submitting = true;
    this.errorMessage = '';
    this.successMessage = '';

    const request$ =
      this.isEditMode && this.editingId !== null
        ? this.medicamentoService.update(this.editingId, payload)
        : this.medicamentoService.create(payload);

    request$.subscribe({
      next: () => {
        this.submitting = false;
        this.successMessage = this.isEditMode
          ? 'Medicamento actualizado correctamente.'
          : 'Medicamento creado correctamente.';
        this.resetForm();
        this.cargarMedicamentos();
      },
      error: (err) => {
        this.submitting = false;
        this.errorMessage = this.extraerError(err, 'No se pudo guardar el medicamento.');
      },
    });
  }

  editarMedicamento(medicamento: MedicamentoResponse): void {
    this.isEditMode = true;
    this.editingId = medicamento.id;
    this.errorMessage = '';
    this.successMessage = '';
    this.form = {
      nombre: medicamento.nombre,
      descripcion: medicamento.descripcion ?? '',
      dosis: medicamento.dosis,
    };
  }

  cancelEdit(): void {
    this.resetForm();
  }

  eliminarMedicamento(id: number): void {
    const confirmado = window.confirm('¿Seguro que deseas eliminar este medicamento?');
    if (!confirmado) {
      return;
    }

    this.errorMessage = '';
    this.successMessage = '';

    this.medicamentoService.delete(id).subscribe({
      next: () => {
        this.successMessage = 'Medicamento eliminado correctamente.';
        this.cargarMedicamentos();
        if (this.editingId === id) {
          this.resetForm();
        }
      },
      error: (err) => {
        this.errorMessage = this.extraerError(err, 'No se pudo eliminar el medicamento.');
      },
    });
  }

  private normalizarFormulario(): CrearMedicamentoRequest & ActualizarMedicamentoRequest {
    return {
      nombre: this.form.nombre.trim(),
      descripcion: this.form.descripcion?.trim() ?? '',
      dosis: this.form.dosis.trim(),
    };
  }

  resetForm(): void {
    this.isEditMode = false;
    this.editingId = null;
    this.form = { nombre: '', descripcion: '', dosis: '' };
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
      return 'No se encontró el medicamento solicitado.';
    }

    if (error?.status === 409) {
      return 'Existe un conflicto con el recurso actual.';
    }

    return fallback;
  }
}
