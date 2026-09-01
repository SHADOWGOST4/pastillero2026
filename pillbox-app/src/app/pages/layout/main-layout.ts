import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { Auth } from '../../services/auth';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.css'
})
export class MainLayout {
  sidebarAbierto = false;
  usuario: any;

  constructor(private auth: Auth, private router: Router) {
    this.usuario = this.auth.obtenerUsuario();
  }

  toggleSidebar() {
    this.sidebarAbierto = !this.sidebarAbierto;
  }

  cerrarSesion() {
    this.auth.cerrarSesion();
    this.router.navigate(['/login']);
  }
}
