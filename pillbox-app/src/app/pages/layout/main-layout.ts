import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { MatMenuModule } from '@angular/material/menu';
import { Auth } from '../../services/auth';
import { CuentaActiva } from '../../services/cuenta-activa';
import { NotificationService } from '../../services/notification.service';
import { filter, Subject, takeUntil } from 'rxjs';
import { MedicationReminderService } from '../../services/medication-reminder.service';
import { MedicationReminderModal } from '../../shared/medication-reminder-modal/medication-reminder-modal';
import { UsuarioResumenResponse, VinculacionResponse } from '../../core/models/api.interfaces';
import { Vinculacion } from '../../services/vinculacion';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, MatMenuModule, MedicationReminderModal],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.css'
})
export class MainLayout implements OnDestroy, OnInit {
  sidebarAbierto = true;
  usuario: any;
  breadcrumbActual = 'Dashboard';
  cuentaActiva: UsuarioResumenResponse | null = null;
  cuentasMonitoreadas: VinculacionResponse[] = [];
  private readonly destroyed$ = new Subject<void>();

  constructor(
    private auth: Auth,
    private router: Router,
    private notificationService: NotificationService,
    private medicationReminderService: MedicationReminderService,
    private cuentaActivaService: CuentaActiva,
    private vinculacionService: Vinculacion,
  ) {
    this.usuario = this.auth.obtenerUsuario();
  }

  ngOnInit() {
    void this.notificationService.initializeWebNotifications();
    this.medicationReminderService.start();
    this.sidebarAbierto = window.innerWidth >= 992;
    this.actualizarBreadcrumb(this.router.url);
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => {
        this.actualizarBreadcrumb(event.urlAfterRedirects);

        if (window.innerWidth < 992) {
          this.sidebarAbierto = false;
        }
      });

    this.cuentaActivaService.cuentaActiva$
      .pipe(takeUntil(this.destroyed$))
      .subscribe((cuenta) => {
        this.cuentaActiva = cuenta;
      });

    this.cargarCuentasMonitoreadas();
    this.vinculacionService.vinculacionActualizada$
      .pipe(takeUntil(this.destroyed$))
      .subscribe(() => this.cargarCuentasMonitoreadas());
  }

  ngOnDestroy(): void {
    this.medicationReminderService.stop();
    this.destroyed$.next();
    this.destroyed$.complete();
  }

  private cargarCuentasMonitoreadas(): void {
    this.vinculacionService.getAll().subscribe({
      next: (data) => {
        this.cuentasMonitoreadas = data.filter(
          (v) => v.estado === 'ACEPTADA' && v.monitor.id === this.usuario?.id,
        );
        if (this.cuentaActiva && !this.cuentasMonitoreadas.some((v) => v.titular.id === this.cuentaActiva?.id)) {
          this.cuentaActivaService.volverAMiCuenta();
        }
      },
      error: () => {
        this.cuentasMonitoreadas = [];
      },
    });
  }

  private actualizarBreadcrumb(url: string) {
    const ruta = url.split('?')[0].split('/').filter(Boolean)[0] || 'dashboard';
    const etiquetas: Record<string, string> = {
      dashboard: 'Dashboard',
      medicamentos: 'Medicamentos',
      horarios: 'Horarios',
      registros: 'Registros',
      'cuentas-vinculadas': 'Cuentas vinculadas',
      dispositivo: 'Dispositivo'
    };

    this.breadcrumbActual = etiquetas[ruta] || 'Dashboard';
  }

  toggleSidebar() {
    this.sidebarAbierto = !this.sidebarAbierto;
  }

  verComo(titular: UsuarioResumenResponse) {
    this.cuentaActivaService.verComo(titular);
  }

  volverAMiCuenta() {
    this.cuentaActivaService.volverAMiCuenta();
  }

  cerrarSesion() {
    this.auth.cerrarSesion();
    this.router.navigate(['/login']);
  }
}
