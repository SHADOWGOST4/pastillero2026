import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ActualizarContactoRequest,
  ContactoResponse,
  CrearContactoRequest,
} from '../../core/models/api.interfaces';
import { Contacto } from '../../services/contacto';

@Component({
  selector: 'app-contactos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './contactos.html',
  styleUrl: './contactos.css',
})
export class Contactos implements OnInit {
  contactos: ContactoResponse[] = [];
  loading = false;
  submitting = false;
  errorMessage = '';
  successMessage = '';
  isEditMode = false;
  editingId: number | null = null;

  form: CrearContactoRequest = {
    nombre: '',
    correo: '',
    telefono: '',
  };

  constructor(private contactoService: Contacto) {}

  ngOnInit(): void {
    this.cargarContactos();
  }

  cargarContactos(): void {
    this.loading = true;
    this.errorMessage = '';

    this.contactoService.getAll().subscribe({
      next: (data) => {
        this.contactos = data;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = this.extraerError(err, 'No se pudieron cargar los contactos.');
      },
    });
  }

  onSubmit(): void {
    if (!this.form.nombre.trim() || !this.form.correo.trim() || !this.form.telefono.trim()) {
      this.errorMessage = 'Todos los campos son obligatorios.';
      this.successMessage = '';
      return;
    }

    const payload: CrearContactoRequest & ActualizarContactoRequest = {
      nombre: this.form.nombre.trim(),
      correo: this.form.correo.trim(),
      telefono: this.form.telefono.trim(),
    };

    this.submitting = true;
    this.errorMessage = '';
    this.successMessage = '';

    const request$ =
      this.isEditMode && this.editingId !== null
        ? this.contactoService.update(this.editingId, payload)
        : this.contactoService.create(payload);

    request$.subscribe({
      next: () => {
        this.submitting = false;
        this.successMessage = this.isEditMode
          ? 'Contacto actualizado correctamente.'
          : 'Contacto creado correctamente.';
        this.resetForm();
        this.cargarContactos();
      },
      error: (err) => {
        this.submitting = false;
        this.errorMessage = this.extraerError(err, 'No se pudo guardar el contacto.');
      },
    });
  }

  editarContacto(contacto: ContactoResponse): void {
    this.isEditMode = true;
    this.editingId = contacto.id;
    this.form = {
      nombre: contacto.nombre,
      correo: contacto.correo,
      telefono: contacto.telefono,
    };
    this.errorMessage = '';
    this.successMessage = '';
  }

  eliminarContacto(id: number): void {
    const confirmado = window.confirm('¿Seguro que deseas eliminar este contacto?');
    if (!confirmado) {
      return;
    }

    this.contactoService.delete(id).subscribe({
      next: () => {
        this.successMessage = 'Contacto eliminado correctamente.';
        if (this.editingId === id) {
          this.resetForm();
        }
        this.cargarContactos();
      },
      error: (err) => {
        this.errorMessage = this.extraerError(err, 'No se pudo eliminar el contacto.');
      },
    });
  }

  resetForm(): void {
    this.isEditMode = false;
    this.editingId = null;
    this.form = {
      nombre: '',
      correo: '',
      telefono: '',
    };
  }

  private extraerError(error: any, fallback: string): string {
    const apiError = error?.error;

    if (typeof apiError?.detail === 'string') {
      return apiError.detail;
    }

    if (typeof apiError?.message === 'string') {
      return apiError.message;
    }

    if (apiError && typeof apiError === 'object') {
      const valores = Object.values(apiError)
        .flatMap((value) => (Array.isArray(value) ? value : [value]))
        .filter((value) => typeof value === 'string');

      if (valores.length > 0) {
        return valores.join(' ');
      }
    }

    if (error?.status === 401) {
      return 'La sesión ha expirado. Inicia sesión nuevamente.';
    }
    if (error?.status === 403) {
      return 'No tienes permisos para realizar esta acción.';
    }
    if (error?.status === 404) {
      return 'No se encontró el contacto solicitado.';
    }
    if (error?.status === 400) {
      return 'Los datos enviados no son válidos para el backend.';
    }

    return fallback;
  }
}
