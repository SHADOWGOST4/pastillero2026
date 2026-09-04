import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import {
  ActualizarDispositivoRequest,
  CrearDispositivoRequest,
  DispositivoResponse,
  ActualizarModuloRequest,
  CrearModuloRequest,
  MedicamentoResponse,
  ModuloResponse,
} from '../../core/models/api.interfaces';
import { DispositivoService } from '../../services/dispositivo';
import { Medicamento } from '../../services/medicamento';
import { ModuloService } from '../../services/modulo';
import { ConfirmModal } from '../../shared/confirm-modal/confirm-modal';

@Component({
  selector: 'app-dispositivo',
  standalone: true,
  imports: [CommonModule, FormsModule, MatFormFieldModule, MatInputModule, ConfirmModal],
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
  modalEliminarAbierto = false;
  eliminando = false;
  dispositivoPendienteEliminar: number | null = null;
  modulos: ModuloResponse[] = [];
  medicamentos: MedicamentoResponse[] = [];
  modulosLoading = false;
  moduloErrorMessage = '';
  moduloSuccessMessage = '';
  selectedDeviceId: number | null = null;
  selectedModuleId: number | null = null;
  selectedMedicationId: number | null = null;
  newModuleNumber: number | null = null;

  form: CrearDispositivoRequest = {
    nombre: '',
    ip_esp32: '',
    estado_conexion: false,
  };

  constructor(  private dispositivoService: DispositivoService,
  private moduloService: ModuloService,
  private medicamentoService: Medicamento,) {}

  ngOnInit(): void {
    this.cargarDispositivos();
  }

  cargarDispositivos(): void {
    this.loading = true;
    this.errorMessage = '';

    this.dispositivoService.getAll().subscribe({
      next: (data) => {
        this.dispositivos = data;
        if (!data.some((dispositivo) => dispositivo.id === this.selectedDeviceId)) {
          this.selectedDeviceId = data.length > 0 ? data[0].id : null;
          this.selectedModuleId = null;
          this.selectedMedicationId = null;
        }
        this.loading = false;
        this.cargarMedicamentos();
        this.cargarModulos();
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = this.extraerError(err, 'No se pudieron cargar los dispositivos.');
      },
    });
  }

  cargarMedicamentos(): void {
    this.medicamentoService.getAll().subscribe({
      next: (data) => {
        this.medicamentos = data;
      },
      error: (err) => {
        this.moduloErrorMessage = this.extraerError(err, 'No se pudieron cargar los medicamentos.');
      },
    });
  }

  cargarModulos(): void {
    this.modulosLoading = true;
    this.moduloErrorMessage = '';

    this.moduloService.getAll().subscribe({
      next: (data) => {
        this.modulos = data;
        this.modulosLoading = false;
      },
      error: (err) => {
        this.modulosLoading = false;
        this.moduloErrorMessage = this.extraerError(err, 'No se pudieron cargar los módulos.');
      },
    });
  }

  seleccionarDispositivo(id: number): void {
    this.selectedDeviceId = id;
    this.selectedModuleId = null;
    this.selectedMedicationId = null;
    this.moduloErrorMessage = '';
    this.moduloSuccessMessage = '';
  }

  get modulosDelDispositivo(): ModuloResponse[] {
    return this.modulos
      .filter((modulo) => modulo.id_dispositivo === this.selectedDeviceId)
      .sort((a, b) => a.numero_modulo - b.numero_modulo);
  }

  get medicamentosDisponibles(): MedicamentoResponse[] {
    const asignados = new Set(
      this.modulos
        .filter((modulo) => modulo.id_medicamento !== null && modulo.id !== this.selectedModuleId)
        .map((modulo) => modulo.id_medicamento),
    );
    return this.medicamentos.filter((medicamento) => !asignados.has(medicamento.id));
  }

  seleccionarModuloParaAsignar(modulo: ModuloResponse): void {
    if (modulo.id_medicamento !== null) return;
    this.selectedModuleId = modulo.id;
    this.selectedMedicationId = null;
    this.moduloErrorMessage = '';
    this.moduloSuccessMessage = '';
  }

  asignarMedicamento(): void {
    const modulo = this.modulos.find((item) => item.id === this.selectedModuleId);
    if (!modulo || modulo.id_medicamento !== null || this.selectedMedicationId === null) {
      this.moduloErrorMessage = 'Selecciona un módulo disponible y un medicamento.';
      this.moduloSuccessMessage = '';
      return;
    }

    this.actualizarModulo(modulo, this.selectedMedicationId, 'Medicamento asignado correctamente.');
  }

  desasignarMedicamento(modulo: ModuloResponse): void {
    if (modulo.id_medicamento === null) return;
    this.actualizarModulo(modulo, null, 'Medicamento desasignado correctamente.');
  }

  crearModulo(): void {
    const moduleNumber = this.newModuleNumber;
    if (
      this.selectedDeviceId === null ||
      typeof moduleNumber !== 'number' ||
      !Number.isInteger(moduleNumber) ||
      moduleNumber < 1
    ) {
      this.moduloErrorMessage = 'Indica un número de módulo entero mayor o igual a 1.';
      this.moduloSuccessMessage = '';
      return;
    }

    const payload: CrearModuloRequest = {
      id_dispositivo: this.selectedDeviceId,
      numero_modulo: moduleNumber,
      id_medicamento: null,
    };
    this.moduloService.create(payload).subscribe({
      next: () => {
        this.newModuleNumber = null;
        this.moduloSuccessMessage = 'Módulo creado correctamente.';
        this.moduloErrorMessage = '';
        this.cargarModulos();
      },
      error: (err) => {
        this.moduloErrorMessage = this.extraerError(err, 'No se pudo crear el módulo.');
        this.moduloSuccessMessage = '';
      },
    });
  }

  private actualizarModulo(modulo: ModuloResponse, idMedicamento: number | null, successMessage: string): void {
    const payload: ActualizarModuloRequest = {
      id_dispositivo: modulo.id_dispositivo,
      numero_modulo: modulo.numero_modulo,
      id_medicamento: idMedicamento,
    };

    this.moduloService.update(modulo.id, payload).subscribe({
      next: () => {
        this.selectedModuleId = null;
        this.selectedMedicationId = null;
        this.moduloSuccessMessage = successMessage;
        this.moduloErrorMessage = '';
        this.cargarModulos();
      },
      error: (err) => {
        this.moduloErrorMessage = this.extraerError(err, 'No se pudo actualizar la asignación del módulo.');
        this.moduloSuccessMessage = '';
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
    this.dispositivoPendienteEliminar = id;
    this.modalEliminarAbierto = true;
  }

  cancelarEliminacion(): void {
    this.modalEliminarAbierto = false;
    this.dispositivoPendienteEliminar = null;
  }

  confirmarEliminacion(): void {
    if (this.dispositivoPendienteEliminar === null || this.eliminando) return;
    const id = this.dispositivoPendienteEliminar;
    this.eliminando = true;

    this.dispositivoService.delete(id).subscribe({
      next: () => {
        this.eliminando = false;
        this.cancelarEliminacion();
        this.successMessage = 'Dispositivo eliminado correctamente.';
        if (this.editingId === id) {
          this.resetForm();
        }
        this.cargarDispositivos();
      },
      error: (err) => {
        this.eliminando = false;
        this.cancelarEliminacion();
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
