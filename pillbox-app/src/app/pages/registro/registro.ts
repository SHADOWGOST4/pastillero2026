import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { Auth } from '../../services/auth';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

@Component({
  selector: 'app-registro',
  standalone: true,
  imports: [CommonModule, FormsModule, MatFormFieldModule, MatInputModule],
  templateUrl: './registro.html',
  styleUrl: './registro.css'
})
export class Registro {

  nuevoUsuario = { nombre: '', correo: '', password: '', telefono: '' };
  mensaje = '';
  error = '';

  constructor(private auth: Auth, private router: Router) {}

  registrar() {
    this.error = '';
    this.auth.registrar(this.nuevoUsuario).subscribe({
      next: () => {
        this.mensaje = 'Usuario registrado correctamente';
        this.auth.login({
          correo: this.nuevoUsuario.correo,
          password: this.nuevoUsuario.password
        }).subscribe({
          next: () => this.router.navigate(['/dashboard']),
          error: () => this.router.navigate(['/login'])
        });
      },
      error: (err: any) => (this.error = err?.message || 'Error al registrar el usuario')
    });
  }

}
