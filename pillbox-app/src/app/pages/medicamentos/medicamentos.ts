import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { forkJoin } from 'rxjs';
import {
  AjustarStockRequest,
  CrearMedicamentoRequest,
  MedicamentoCoberturaResponse,
  MedicamentoResponse,
} from '../../core/models/api.interfaces';
import { Medicamento } from '../../services/medicamento';
import { ConfirmModal } from '../../shared/confirm-modal/confirm-modal';

@Component({
  selector: 'app-medicamentos',
  standalone: true,
  imports: [CommonModule, FormsModule, MatFormFieldModule, MatInputModule, ConfirmModal],
  templateUrl: './medicamentos.html',
  styleUrls: ['./medicamentos.css'],
})
export class Medicamentos implements OnInit {
  medicamentos: MedicamentoResponse[] = [];
  coberturaPorMedicamento: Record<number, MedicamentoCoberturaResponse> = {};
  totalMedicamentos = 0;
  paginaActual = 1;
  totalPaginas = 1;
  private pageSize = 10;
  loading = false;
  submitting = false;
  isEditMode = false;
  editingId: number | null = null;
  errorMessage = '';
  successMessage = '';
  stockOperationId: number | null = null;
  stockOperationType: 'reponer' | 'ajustar' | null = null;
  stockOperationAmount = 0;
  stockOperationReason = '';
  stockOperationBusy = false;
  modalEliminarAbierto = false;
  eliminando = false;
  medicamentoPendienteEliminar: number | null = null;

  form: CrearMedicamentoRequest = {
    nombre: '',
    descripcion: '',
    dosis: '',
    stock: 0,
  };

  constructor(private medicamentoService: Medicamento) {}

  ngOnInit(): void {
    this.cargarMedicamentos();
  }

  cargarMedicamentos(pagina = this.paginaActual): void {
    this.loading = true;
    this.errorMessage = '';

    this.medicamentoService.getPage(pagina).subscribe({
      next: (data) => {
        if (data.results.length === 0 && data.count > 0 && pagina > 1) {
          this.cargarMedicamentos(pagina - 1);
          return;
        }
        this.medicamentos = data.results;
        this.totalMedicamentos = data.count;
        this.paginaActual = pagina;
        if (data.page_size || (data.next && data.results.length > 0)) {
          this.pageSize = data.page_size ?? data.results.length;
        }
        this.totalPaginas = Math.max(1, Math.ceil(data.count / this.pageSize));
        this.cargarCoberturaMedicamentos();
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = this.extraerError(err, 'No se pudieron cargar los medicamentos.');
      },
    });
  }

  paginaAnterior(): void {
    if (this.paginaActual > 1) {
      this.cargarMedicamentos(this.paginaActual - 1);
    }
  }

  paginaSiguiente(): void {
    if (this.paginaActual < this.totalPaginas) {
      this.cargarMedicamentos(this.paginaActual + 1);
    }
  }

  onSubmit(medicamentoForm: NgForm): void {
    const payload = this.normalizarFormulario();
    const stockValido = Number.isInteger(payload.stock) && payload.stock >= 0;

    if (medicamentoForm.invalid || !payload.nombre || !payload.dosis || !stockValido) {
      medicamentoForm.form.markAllAsTouched();
      this.errorMessage = 'Completa los campos obligatorios con valores válidos.';
      this.successMessage = '';
      return;
    }

    this.submitting = true;
    this.errorMessage = '';
    this.successMessage = '';

    const request$ =
      this.isEditMode && this.editingId !== null
        ? this.medicamentoService.update(this.editingId, {
            nombre: payload.nombre,
            descripcion: payload.descripcion,
            dosis: payload.dosis,
          })
        : this.medicamentoService.create(payload);

    request$.subscribe({
      next: () => {
        this.submitting = false;
        this.successMessage = this.isEditMode
          ? 'Medicamento actualizado correctamente.'
          : 'Medicamento creado correctamente.';
        this.resetForm();
        this.cargarMedicamentos(this.paginaActual);
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
      stock: medicamento.stock,
    };
  }

  cancelEdit(): void {
    this.resetForm();
  }

  eliminarMedicamento(id: number): void {
    this.medicamentoPendienteEliminar = id;
    this.modalEliminarAbierto = true;
  }

  cancelarEliminacion(): void {
    this.modalEliminarAbierto = false;
    this.medicamentoPendienteEliminar = null;
  }

  confirmarEliminacion(): void {
    if (this.medicamentoPendienteEliminar === null || this.eliminando) return;
    const id = this.medicamentoPendienteEliminar;
    this.eliminando = true;

    this.errorMessage = '';
    this.successMessage = '';

    this.medicamentoService.delete(id).subscribe({
      next: () => {
        this.eliminando = false;
        this.cancelarEliminacion();
        this.successMessage = 'Medicamento eliminado correctamente.';
        this.cargarMedicamentos(this.paginaActual);
        if (this.editingId === id) {
          this.resetForm();
        }
      },
      error: (err) => {
        this.eliminando = false;
        this.cancelarEliminacion();
        this.errorMessage = this.extraerError(err, 'No se pudo eliminar el medicamento.');
      },
    });
  }

  abrirOperacionStock(
    medicamento: MedicamentoResponse,
    tipo: 'reponer' | 'ajustar',
  ): void {
    this.stockOperationId = medicamento.id;
    this.stockOperationType = tipo;
    this.stockOperationAmount = tipo === 'reponer' ? 1 : 0;
    this.stockOperationReason = '';
    this.errorMessage = '';
    this.successMessage = '';
  }

  cancelarOperacionStock(): void {
    this.stockOperationId = null;
    this.stockOperationType = null;
    this.stockOperationAmount = 0;
    this.stockOperationReason = '';
  }

  guardarOperacionStock(): void {
    if (this.stockOperationId === null || this.stockOperationType === null || this.stockOperationBusy) {
      return;
    }

    const cantidad = Number(this.stockOperationAmount);
    if (!Number.isInteger(cantidad) || (this.stockOperationType === 'reponer' ? cantidad < 1 : cantidad === 0)) {
      this.errorMessage = this.stockOperationType === 'reponer'
        ? 'La reposición debe ser un entero positivo.'
        : 'El ajuste debe ser un entero distinto de cero.';
      return;
    }
    if (this.stockOperationType === 'ajustar' && !this.stockOperationReason.trim()) {
      this.errorMessage = 'Indica el motivo del ajuste.';
      return;
    }

    this.stockOperationBusy = true;
    const request$ = this.stockOperationType === 'reponer'
      ? this.medicamentoService.reponer(this.stockOperationId, { cantidad })
      : this.medicamentoService.ajustarStock(this.stockOperationId, {
          cantidad,
          motivo: this.stockOperationReason.trim(),
        } satisfies AjustarStockRequest);

    request$.subscribe({
      next: () => {
        this.stockOperationBusy = false;
        this.successMessage = this.stockOperationType === 'reponer'
          ? 'Reposición registrada correctamente.'
          : 'Ajuste registrado correctamente.';
        this.cancelarOperacionStock();
        this.cargarMedicamentos(this.paginaActual);
      },
      error: (err) => {
        this.stockOperationBusy = false;
        this.errorMessage = this.extraerError(err, 'No se pudo actualizar el inventario.');
      },
    });
  }

  private normalizarFormulario(): CrearMedicamentoRequest {
    const payload: CrearMedicamentoRequest = {
      nombre: this.form.nombre.trim(),
      descripcion: this.form.descripcion?.trim() ?? '',
      dosis: this.form.dosis.trim(),
      stock: this.form.stock,
    };
    return payload;
  }

  private cargarCoberturaMedicamentos(): void {
    if (!this.medicamentos.length) {
      this.coberturaPorMedicamento = {};
      return;
    }

    forkJoin(this.medicamentos.map((med) => this.medicamentoService.getCobertura(med.id))).subscribe({
      next: (respuestas) => {
        this.coberturaPorMedicamento = {};
        respuestas.forEach((respuesta) => {
          this.coberturaPorMedicamento[respuesta.id_medicamento] = respuesta;
        });
      },
      error: () => {
        this.coberturaPorMedicamento = {};
      },
    });
  }

  getEstadoStockLabel(id: number): string {
    const cobertura = this.coberturaPorMedicamento[id];
    if (!cobertura) {
      return 'NORMAL';
    }
    return cobertura.estado_tratamiento ?? cobertura.estado_stock ?? 'NORMAL';
  }

  getCoberturaTexto(id: number): string {
    const cobertura = this.coberturaPorMedicamento[id];
    if (!cobertura) {
      return 'Sin datos';
    }
    if (cobertura.estado_tratamiento === 'INSUFICIENTE_TRATAMIENTO') {
      return `Faltan ${cobertura.faltantes} unidades`;
    }
    if (cobertura.estado_stock === 'AGOTADO') {
      return 'Agotado';
    }
    if (cobertura.dias_cobertura == null) {
      return 'Sin cobertura prevista';
    }
    return `Cobertura: ${Math.max(0, Math.round(Number(cobertura.dias_cobertura)))} días`;
  }

  getEstadoStockClass(id: number): string {
    const estado = this.getEstadoStockLabel(id);
    return `stock-status-${estado.toLowerCase()}`;
  }

  resetForm(): void {
    this.isEditMode = false;
    this.editingId = null;
    this.form = { nombre: '', descripcion: '', dosis: '', stock: 0 };
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
