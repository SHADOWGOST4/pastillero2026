import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { Auth } from '../../services/auth';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-registro',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './registro.html',
  styleUrl: './registro.css'
})
export class Registro {

  nuevoUsuario = { nombre: '', correo: '', password: '', telefono: '' };
  mensaje = '';
  error = '';

  constructor(private auth: Auth, private router: Router) {}

  registrar() {
    this.auth.registrar(this.nuevoUsuario).subscribe({
      next: (res) => {
        this.mensaje = 'Usuario registrado correctamente';
        setTimeout(() => this.router.navigate(['/login']), 1500);
      },
      error: () => (this.error = 'Error al registrar el usuario')
    });
  }

}
