import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Auth } from '../../services/auth';

@Component({
  selector: 'app-restablecer-contrasena',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, MatFormFieldModule, MatInputModule],
  templateUrl: './restablecer-contrasena.html',
  styleUrl: './restablecer-contrasena.css'
})
export class RestablecerContrasena implements OnInit {
  estado: 'formulario' | 'exito' | 'error' = 'formulario';
  mensaje = '';
  password = '';
  confirmarPassword = '';
  enviando = false;

  private token = '';

  constructor(private route: ActivatedRoute, private auth: Auth) {}

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');

    if (!token) {
      this.estado = 'error';
      this.mensaje = 'El enlace para restablecer la contraseña no es válido.';
      return;
    }

    this.token = token;
  }

  restablecer() {
    this.mensaje = '';

    if (!this.password || this.password !== this.confirmarPassword) {
      this.mensaje = 'Las contraseñas no coinciden.';
      return;
    }

    this.enviando = true;
    this.auth.restablecerContrasena(this.token, this.password).subscribe({
      next: (respuesta) => {
        this.enviando = false;
        this.estado = 'exito';
        this.mensaje = respuesta.detail || 'Contraseña actualizada correctamente.';
      },
      error: (err: any) => {
        this.enviando = false;
        this.mensaje = err?.message || 'El enlace no es válido o ya fue usado.';
      }
    });
  }
}
