import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { CommonModule } from '@angular/common';
import { HorarioResponse, RegistroTomaResponse } from '../../core/models/api.interfaces';
import { Horario } from '../../services/horario';
import { RegistroToma } from '../../services/registro-toma';

@Component({
  selector: 'app-registros',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './registros.html',
  styleUrl: './registros.css',
})
export class Registros implements OnDestroy, OnInit {
  registros: RegistroTomaResponse[] = [];
  horarios: HorarioResponse[] = [];
  totalRegistros = 0;
  paginaActual = 1;
  totalPaginas = 1;
  private pageSize = 10;
  loading = false;
  errorMessage = '';
  private readonly destroyed$ = new Subject<void>();

  constructor(
    private registroService: RegistroToma,
    private horarioService: Horario,
  ) {}

  ngOnInit(): void {
    this.cargarHorarios();
    this.cargarRegistros();
    this.registroService.registroActualizado$
      .pipe(takeUntil(this.destroyed$))
      .subscribe(() => this.cargarRegistros());
  }

  ngOnDestroy(): void {
    this.destroyed$.next();
    this.destroyed$.complete();
  }

  cargarHorarios(): void {
    this.horarioService.getAll().subscribe({
      next: (data) => {
        this.horarios = data;
      },
      error: () => {
        this.errorMessage = 'No se pudieron cargar los datos de los medicamentos.';
      },
    });
  }

  cargarRegistros(pagina = this.paginaActual): void {
    this.loading = true;
    this.errorMessage = '';

    this.registroService.getPage(pagina).subscribe({
      next: (data) => {
        if (data.results.length === 0 && data.count > 0 && pagina > 1) {
          this.cargarRegistros(pagina - 1);
          return;
        }
        this.registros = data.results;
        this.totalRegistros = data.count;
        this.paginaActual = pagina;
        if (data.page_size || (data.next && data.results.length > 0)) {
          this.pageSize = data.page_size ?? data.results.length;
        }
        this.totalPaginas = Math.max(1, Math.ceil(data.count / this.pageSize));
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = this.extraerError(err, 'No se pudieron cargar los registros de toma.');
      },
    });
  }

  paginaAnterior(): void {
    if (this.paginaActual > 1) {
      this.cargarRegistros(this.paginaActual - 1);
    }
  }

  paginaSiguiente(): void {
    if (this.paginaActual < this.totalPaginas) {
      this.cargarRegistros(this.paginaActual + 1);
    }
  }

  get tomasRealizadas(): number {
    return this.registros.filter((registro) => Boolean(registro.fecha_hora_real)).length;
  }

  get tomasPendientes(): number {
    return this.registros.filter((registro) => !registro.fecha_hora_real).length;
  }

  obtenerNombreMedicamento(idHorario: number): string {
    const horario = this.horarios.find((item) => item.id === idHorario);
    return horario?.medicamento_nombre || `Horario #${idHorario}`;
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
