import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Auth } from '../../services/auth';

@Component({
  selector: 'app-verificar-correo',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './verificar-correo.html',
  styleUrl: './verificar-correo.css'
})
export class VerificarCorreo implements OnInit {
  estado: 'cargando' | 'exito' | 'error' = 'cargando';
  mensaje = '';

  constructor(private route: ActivatedRoute, private auth: Auth) {}

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');

    if (!token) {
      this.estado = 'error';
      this.mensaje = 'El enlace de verificación no es válido.';
      return;
    }

    this.auth.verificarCorreo(token).subscribe({
      next: (respuesta) => {
        this.estado = 'exito';
        this.mensaje = respuesta.detail || 'Correo verificado correctamente.';
      },
      error: (err: any) => {
        this.estado = 'error';
        this.mensaje = err?.message || 'El enlace de verificación no es válido.';
      }
    });
  }
}
