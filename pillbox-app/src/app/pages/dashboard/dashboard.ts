import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { Dashboard as DashboardService } from '../../services/dashboard';
import { Auth } from '../../services/auth';
import { Medicamento } from '../../services/medicamento';
import {
  MedicamentoCoberturaResponse,
  ProximaTomaItem,
} from '../../core/models/api.interfaces';

interface ModuleCard {
  label: string;
  medicamento: string;
  hora: string;
  estado: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
  providers: [DatePipe]
})
export class Dashboard implements OnInit {
  proximosHorarios: ProximaTomaItem[] = [];
  alertasStock: MedicamentoCoberturaResponse[] = [];
  usuario: any;
  isLoading = false;
  hasError = false;
  errorMessage = '';

  moduleCards: ModuleCard[] = [];

  constructor(
    private dashboardService: DashboardService,
    private medicamentoService: Medicamento,
    private auth: Auth,
    private router: Router,
    private datePipe: DatePipe
  ) {}

  ngOnInit() {
    this.usuario = this.auth.obtenerUsuario();
    this.cargarProximosHorarios();
    this.cargarAlertasStock();
  }

  cargarProximosHorarios() {
    this.isLoading = true;
    this.hasError = false;
    this.errorMessage = '';

    this.dashboardService.getProximosHorarios().subscribe({
      next: (data) => {
        this.proximosHorarios = (data || []).slice().sort((a, b) => {
          const at = a && a.proxima_toma ? new Date(a.proxima_toma).getTime() : Number.POSITIVE_INFINITY;
          const bt = b && b.proxima_toma ? new Date(b.proxima_toma).getTime() : Number.POSITIVE_INFINITY;
          return at - bt;
        });

        this.moduleCards = this.construirModuleCards(this.proximosHorarios);
        this.isLoading = false;
      },
      error: (err) => {
        this.isLoading = false;
        this.hasError = true;
        this.errorMessage = err?.message || 'No se pudieron cargar las próximas tomas.';
      }
    });
  }

  cargarAlertasStock(): void {
    this.medicamentoService.getPage(1).subscribe({
      next: (page) => {
        const medicamentos = page?.results ?? [];
        if (!medicamentos.length) {
          this.alertasStock = [];
          return;
        }

        forkJoin(medicamentos.map((med) => this.medicamentoService.getCobertura(med.id))).subscribe({
          next: (respuestas) => {
            this.alertasStock = respuestas
              .filter((respuesta) => this.debeMostrarseEnAlerta(respuesta))
              .sort((a, b) => this.prioridadAlerta(a) - this.prioridadAlerta(b));
          },
          error: () => {
            this.alertasStock = [];
          }
        });
      },
      error: () => {
        this.alertasStock = [];
      }
    });
  }

  debeMostrarseEnAlerta(respuesta: MedicamentoCoberturaResponse): boolean {
    const estado = respuesta.estado_stock;
    const insuficiente = respuesta.estado_tratamiento === 'INSUFICIENTE_TRATAMIENTO';
    return estado === 'AGOTADO' || insuficiente || estado === 'CRITICO' || estado === 'BAJO';
  }

  prioridadAlerta(respuesta: MedicamentoCoberturaResponse): number {
    if (respuesta.estado_stock === 'AGOTADO') return 1;
    if (respuesta.estado_tratamiento === 'INSUFICIENTE_TRATAMIENTO') return 2;
    if (respuesta.estado_stock === 'CRITICO') return 3;
    if (respuesta.estado_stock === 'BAJO') return 4;
    return 99;
  }

  descripcionAlerta(respuesta: MedicamentoCoberturaResponse): string {
    if (respuesta.estado_stock === 'AGOTADO') {
      return 'Agotado.';
    }

    if (respuesta.estado_tratamiento === 'INSUFICIENTE_TRATAMIENTO') {
      return `Faltan ${respuesta.faltantes} unidades para completar el tratamiento.`;
    }

    if (respuesta.estado_stock === 'CRITICO' || respuesta.estado_stock === 'BAJO') {
      const dias = respuesta.dias_cobertura == null ? 0 : Math.max(0, Math.round(Number(respuesta.dias_cobertura)));
      return `Quedan aproximadamente ${dias} días.`;
    }

    return 'Revisa el estado del stock.';
  }

  construirModuleCards(items: ProximaTomaItem[]): ModuleCard[] {
    const cards: ModuleCard[] = [];
    const lista = items.slice(0, 4);

    lista.forEach((item, index) => {
      const fecha = item.proxima_toma ? new Date(item.proxima_toma) : null;
      cards.push({
        label: `Módulo ${index + 1}`,
        medicamento: item.medicamento || 'Sin medicamento',
        hora: fecha ? this.datePipe.transform(fecha, 'dd/MM/yyyy HH:mm') || 'Sin hora' : 'Sin hora',
        estado: item.frecuencia ? `Cada ${item.frecuencia} h` : 'Toma diaria'
      });
    });

    while (cards.length < 4) {
      cards.push({
        label: `Módulo ${cards.length + 1}`,
        medicamento: 'Sin programación',
        hora: 'Sin horario',
        estado: 'Sin datos'
      });
    }

    return cards;
  }

  irA(ruta: string) {
    this.router.navigate([ruta]);
  }

  get proximaToma() {
    if (!this.proximosHorarios.length) {
      return 'Sin toma programada';
    }

    const next = this.proximosHorarios[0];
    const fecha = next.proxima_toma ? new Date(next.proxima_toma) : null;
    return fecha ? this.datePipe.transform(fecha, 'dd/MM/yyyy HH:mm') || 'Sin horario' : 'Sin horario';
  }

  get totalTomasProgramadas() {
    return this.proximosHorarios.length;
  }

  get estadoSistema() {
    return this.proximosHorarios.length ? 'Sistema activo' : 'Sin información disponible';
  }
}