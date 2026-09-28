import { Component } from '@angular/core';
import { Auth } from '../../services/auth';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

@Component({
  selector: 'app-olvide-contrasena',
  standalone: true,
  imports: [CommonModule, FormsModule, MatFormFieldModule, MatInputModule],
  templateUrl: './olvide-contrasena.html',
  styleUrl: './olvide-contrasena.css'
})
export class OlvideContrasena {
  correo = '';
  mensaje = '';
  error = '';
  enviando = false;

  constructor(private auth: Auth) {}

  enviar() {
    this.error = '';
    this.mensaje = '';
    this.enviando = true;
    this.auth.olvidarContrasena(this.correo).subscribe({
      next: (respuesta) => {
        this.enviando = false;
        this.mensaje = respuesta.detail || 'Si el correo existe, te enviamos instrucciones para restablecer tu contraseña.';
      },
      error: (err: any) => {
        this.enviando = false;
        this.error = err?.message || 'No se pudo enviar el correo. Intenta nuevamente.';
      }
    });
  }
}
