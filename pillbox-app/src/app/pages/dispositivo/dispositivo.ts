import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  DispositivoResponse,
  ActualizarModuloRequest,
  CrearModuloRequest,
  MedicamentoResponse,
  ModuloResponse,
  HorarioResponse,
} from '../../core/models/api.interfaces';
import { DispositivoService } from '../../services/dispositivo';
import { Horario } from '../../services/horario';
import { Medicamento } from '../../services/medicamento';
import { ModuloService } from '../../services/modulo';
import { ConfirmModal } from '../../shared/confirm-modal/confirm-modal';
import { ConectarEsp32 } from './conectar-esp32/conectar-esp32';
import { EditarDispositivoModal } from './editar-dispositivo-modal/editar-dispositivo-modal';

@Component({
  selector: 'app-dispositivo',
  standalone: true,
  imports: [CommonModule, FormsModule, ConfirmModal, ConectarEsp32, EditarDispositivoModal],
  templateUrl: './dispositivo.html',
  styleUrl: './dispositivo.css',
})
export class Dispositivo implements OnInit {
  dispositivos: DispositivoResponse[] = [];
  loading = false;
  errorMessage = '';
  successMessage = '';
  dispositivoEnEdicion: DispositivoResponse | null = null;
  guardandoEdicion = false;
  errorEdicion = '';
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
  mostrarFormModulo = false;
  horarios: HorarioResponse[] = [];
  asignaciones: Record<number, number | undefined> = {};
  asistenteAbierto = false;


  constructor(
    private dispositivoService: DispositivoService,
    private moduloService: ModuloService,
    private medicamentoService: Medicamento,
    private horarioService: Horario,
  ) {}

  ngOnInit(): void {
    this.cargarDispositivos();
    this.horarioService.getAll().subscribe({ next: (horarios) => (this.horarios = horarios) });
  }

  cargarDispositivos(): void {
    this.loading = true;
    this.errorMessage = '';

    this.dispositivoService.getAll().subscribe({
      next: (data) => {
        this.dispositivos = data;
        data.forEach((dispositivo) => this.cargarAsignacion(dispositivo.id));
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
    this.cancelarFormModulo();
  }

  get modulosDelDispositivo(): ModuloResponse[] {
    return this.modulos
      .filter((modulo) => modulo.id_dispositivo === this.selectedDeviceId)
      .sort((a, b) => a.numero_modulo - b.numero_modulo);
  }

  get resumenModulos(): string {
    const modulos = this.modulosDelDispositivo;
    const total = modulos.length;
    if (total === 0) return '0 módulos configurados';
    const ocupados = modulos.filter((modulo) => modulo.id_medicamento !== null).length;
    const disponibles = total - ocupados;
    return [
      `${total} ${total === 1 ? 'módulo configurado' : 'módulos configurados'}`,
      `${ocupados} ${ocupados === 1 ? 'ocupado' : 'ocupados'}`,
      `${disponibles} ${disponibles === 1 ? 'disponible' : 'disponibles'}`,
    ].join(' · ');
  }

  abrirFormModulo(): void {
    this.mostrarFormModulo = true;
    this.moduloErrorMessage = '';
    this.moduloSuccessMessage = '';
  }

  cancelarFormModulo(): void {
    this.mostrarFormModulo = false;
    this.newModuleNumber = null;
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
        this.cancelarFormModulo();
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

  editarDispositivo(dispositivo: DispositivoResponse): void {
    this.dispositivoEnEdicion = dispositivo;
    this.errorEdicion = '';
    this.errorMessage = '';
    this.successMessage = '';
  }

  cerrarEdicion(): void {
    if (this.guardandoEdicion) return;
    this.dispositivoEnEdicion = null;
    this.errorEdicion = '';
  }

  guardarEdicion(nombre: string): void {
    const dispositivo = this.dispositivoEnEdicion;
    if (!dispositivo || this.guardandoEdicion) return;
    this.guardandoEdicion = true;
    this.errorEdicion = '';
    this.dispositivoService.update(dispositivo.id, { nombre }).subscribe({
      next: () => {
        this.guardandoEdicion = false;
        this.dispositivoEnEdicion = null;
        this.successMessage = 'Dispositivo actualizado correctamente.';
        this.cargarDispositivos();
      },
      error: (err) => {
        this.guardandoEdicion = false;
        this.errorEdicion = this.extraerError(err, 'No se pudo guardar el dispositivo.');
      },
    });
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
        this.cargarDispositivos();
      },
      error: (err) => {
        this.eliminando = false;
        this.cancelarEliminacion();
        this.errorMessage = this.extraerError(err, 'No se pudo eliminar el dispositivo.');
      },
    });
  }

  asignarHorario(dispositivoId: number): void {
    const horarioId = this.asignaciones[dispositivoId];
    if (!horarioId) return;
    this.dispositivoService.asignarHorario(dispositivoId, horarioId).subscribe({
      next: () => (this.successMessage = 'Horario asignado al pastillero.'),
      error: (err) => (this.errorMessage = this.extraerError(err, 'No se pudo asignar el horario.')),
    });
  }

  onDispositivoConectado(): void {
    this.asistenteAbierto = false;
    this.successMessage = 'Pastillero conectado correctamente.';
    this.cargarDispositivos();
  }

  private cargarAsignacion(dispositivoId: number): void {
    this.dispositivoService.getAsignacion(dispositivoId).subscribe({
      next: (asignacion) => (this.asignaciones[dispositivoId] = asignacion.id_horario),
    });
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
