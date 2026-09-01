import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { Dashboards } from '../../services/dashboard';
import { Auth } from '../../services/auth';
import { ProximaTomaItem } from '../../core/models/api.interfaces';

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
  usuario: any;
  isLoading = false;
  hasError = false;
  errorMessage = '';

  moduleCards: ModuleCard[] = [];

  constructor(
    private dashboardService: Dashboards,
    private auth: Auth,
    private router: Router,
    private datePipe: DatePipe
  ) {}

  ngOnInit() {
    this.usuario = this.auth.obtenerUsuario();
    this.cargarProximosHorarios();
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