import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { UsuarioResponse } from '../../core/models/api.interfaces';
import { Auth } from '../../services/auth';
import { Tutorial } from '../../services/tutorial';

/** Configuración de la propia cuenta: datos personales y el tutorial. */
@Component({
  selector: 'app-mi-cuenta',
  standalone: true,
  imports: [CommonModule, FormsModule, MatFormFieldModule, MatInputModule],
  templateUrl: './mi-cuenta.html',
  styleUrl: './mi-cuenta.css',
})
export class MiCuenta implements OnInit {
  usuario: UsuarioResponse | null = null;
  nombre = '';
  telefono = '';
  guardando = false;
  errorMessage = '';
  successMessage = '';

  constructor(
    private auth: Auth,
    private tutorial: Tutorial,
  ) {}

  ngOnInit(): void {
    this.cargarFormulario(this.auth.obtenerUsuario());
    this.auth.refrescarUsuario().subscribe({
      next: (usuario) => this.cargarFormulario(usuario),
      error: () => {},
    });
  }

  get hayCambios(): boolean {
    return (
      !!this.usuario &&
      (this.nombre.trim() !== this.usuario.nombre || this.telefono.trim() !== this.usuario.telefono)
    );
  }

  guardar(): void {
    if (this.guardando || !this.hayCambios) return;
    this.errorMessage = '';
    this.successMessage = '';

    const nombre = this.nombre.trim();
    const telefono = this.telefono.trim();
    if (!nombre) {
      this.errorMessage = 'Escribe tu nombre.';
      return;
    }
    if (!/^\d{7,15}$/.test(telefono)) {
      this.errorMessage = 'El teléfono debe tener entre 7 y 15 números, sin espacios ni símbolos.';
      return;
    }

    this.guardando = true;
    this.auth.actualizarPerfil({ nombre, telefono }).subscribe({
      next: (usuario) => {
        this.guardando = false;
        this.cargarFormulario(usuario);
        this.successMessage = 'Guardamos los cambios de tu cuenta.';
      },
      error: (err: Error) => {
        this.guardando = false;
        this.errorMessage = err.message || 'No se pudieron guardar los cambios.';
      },
    });
  }

  verTutorial(): void {
    this.tutorial.iniciar();
  }

  private cargarFormulario(usuario: UsuarioResponse | null): void {
    if (!usuario) return;
    this.usuario = usuario;
    this.nombre = usuario.nombre ?? '';
    this.telefono = usuario.telefono ?? '';
  }
}
