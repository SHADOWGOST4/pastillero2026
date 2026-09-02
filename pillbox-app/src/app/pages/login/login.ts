import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { Auth } from '../../services/auth';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, MatFormFieldModule, MatInputModule],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class Login {
 usuario = { correo: '', password: '' };
  error = '';

  constructor(private auth: Auth, private router: Router) {}

  login() {
    this.auth.login(this.usuario).subscribe({
      next: () => {
        this.router.navigate(['/dashboard']);
      },
      error: (err: any) => {
        this.error = err?.message || 'Correo o contraseña incorrectos';
      }
    });
  }
}
