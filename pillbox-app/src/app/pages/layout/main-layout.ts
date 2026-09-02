import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { Auth } from '../../services/auth';
import { filter } from 'rxjs';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.css'
})
export class MainLayout implements OnInit {
  sidebarAbierto = true;
  usuario: any;
  breadcrumbActual = 'Dashboard';

  constructor(private auth: Auth, private router: Router) {
    this.usuario = this.auth.obtenerUsuario();
  }

  ngOnInit() {
    this.sidebarAbierto = window.innerWidth >= 992;
    this.actualizarBreadcrumb(this.router.url);
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => this.actualizarBreadcrumb(event.urlAfterRedirects));
  }

  private actualizarBreadcrumb(url: string) {
    const ruta = url.split('?')[0].split('/').filter(Boolean)[0] || 'dashboard';
    const etiquetas: Record<string, string> = {
      dashboard: 'Dashboard',
      medicamentos: 'Medicamentos',
      horarios: 'Horarios',
      registros: 'Registros',
      contactos: 'Contactos',
      dispositivo: 'Dispositivo'
    };

    this.breadcrumbActual = etiquetas[ruta] || 'Dashboard';
  }

  toggleSidebar() {
    this.sidebarAbierto = !this.sidebarAbierto;
  }

  cerrarSesion() {
    this.auth.cerrarSesion();
    this.router.navigate(['/login']);
  }
}
