import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import {
  ActualizarUsuarioRequest,
  AdherenciaResponse,
  GrupoSanguineo,
  UsuarioResponse,
} from '../../core/models/api.interfaces';
import { Auth } from '../../services/auth';
import { Perfil as PerfilService, calcularEdad, prepararFoto } from '../../services/perfil';
import { Preferencias, TAMANOS_LETRA, TamanoLetra } from '../../services/preferencias';
import { Tutorial } from '../../services/tutorial';
import { BloquearScroll } from '../../shared/bloquear-scroll/bloquear-scroll';

type Modal = 'datos' | 'ficha' | 'qr' | null;

/** Perfil propio: datos personales, ficha médica de emergencia, adherencia y preferencias. */
@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, MatFormFieldModule, MatInputModule, MatSelectModule, BloquearScroll],
  templateUrl: './perfil.html',
  styleUrl: './perfil.css',
})
export class Perfil implements OnInit {
  readonly gruposSanguineos: GrupoSanguineo[] = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
  readonly tamanosLetra = TAMANOS_LETRA;

  usuario: UsuarioResponse | null = null;
  adherencia: AdherenciaResponse | null = null;
  adherenciaError = false;
  tamanoLetra: TamanoLetra;

  modal: Modal = null;
  guardando = false;
  errorModal = '';
  mensaje = '';

  datos = { foto: '', nombre: '', telefono: '', fecha_nacimiento: '', grupo_sanguineo: '' as GrupoSanguineo | '' };
  ficha = { alergias: '', condiciones: '', contacto_emergencia_nombre: '', contacto_emergencia_telefono: '' };

  qrSrc = '';
  qrCargando = false;
  qrError = '';

  constructor(
    private auth: Auth,
    private perfilService: PerfilService,
    private preferencias: Preferencias,
    private tutorial: Tutorial,
  ) {
    this.tamanoLetra = this.preferencias.tamanoLetra;
  }

  ngOnInit(): void {
    this.usuario = this.auth.obtenerUsuario();
    this.auth.refrescarUsuario().subscribe({
      next: (usuario) => (this.usuario = usuario),
      error: () => {},
    });
    this.cargarAdherencia();
  }

  get edad(): number | null {
    return calcularEdad(this.usuario?.fecha_nacimiento);
  }

  get inicial(): string {
    return this.usuario?.nombre?.trim().charAt(0).toUpperCase() || 'U';
  }

  get tieneFicha(): boolean {
    const u = this.usuario;
    return !!(u?.alergias || u?.condiciones || u?.contacto_emergencia_nombre || u?.contacto_emergencia_telefono);
  }

  /** Para el anillo de cumplimiento (circunferencia de r=42). */
  get trazoAnillo(): string {
    const porcentaje = this.adherencia?.porcentaje ?? 0;
    const circunferencia = 2 * Math.PI * 42;
    return `${(porcentaje / 100) * circunferencia} ${circunferencia}`;
  }

  get claseAdherencia(): string {
    const p = this.adherencia?.porcentaje;
    if (p === null || p === undefined) return '';
    return p >= 90 ? 'nivel-alto' : p >= 70 ? 'nivel-medio' : 'nivel-bajo';
  }

  cargarAdherencia(): void {
    this.adherenciaError = false;
    this.perfilService.adherencia().subscribe({
      next: (adherencia) => (this.adherencia = adherencia),
      error: () => (this.adherenciaError = true),
    });
  }

  abrirDatos(): void {
    const u = this.usuario;
    this.datos = {
      foto: u?.foto || '',
      nombre: u?.nombre || '',
      telefono: u?.telefono || '',
      fecha_nacimiento: u?.fecha_nacimiento || '',
      grupo_sanguineo: u?.grupo_sanguineo || '',
    };
    this.abrir('datos');
  }

  abrirFicha(): void {
    const u = this.usuario;
    this.ficha = {
      alergias: u?.alergias || '',
      condiciones: u?.condiciones || '',
      contacto_emergencia_nombre: u?.contacto_emergencia_nombre || '',
      contacto_emergencia_telefono: u?.contacto_emergencia_telefono || '',
    };
    this.abrir('ficha');
  }

  abrirQr(): void {
    this.abrir('qr');
    this.qrCargando = true;
    this.qrError = '';
    this.perfilService.fichaMedica().subscribe({
      next: ({ qr_svg }) => {
        this.qrCargando = false;
        this.qrSrc = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qr_svg)}`;
      },
      error: () => {
        this.qrCargando = false;
        this.qrError = 'No se pudo generar el código. Revisa tu conexión.';
      },
    });
  }

  cerrarModal(): void {
    if (this.guardando) return;
    this.modal = null;
  }

  async elegirFoto(evento: Event): Promise<void> {
    const input = evento.target as HTMLInputElement;
    const archivo = input.files?.[0];
    input.value = '';
    if (!archivo) return;
    if (!archivo.type.startsWith('image/')) {
      this.errorModal = 'Elige una imagen.';
      return;
    }
    try {
      this.datos.foto = await prepararFoto(archivo);
      this.errorModal = '';
    } catch (err) {
      this.errorModal = (err as Error).message;
    }
  }

  quitarFoto(): void {
    this.datos.foto = '';
  }

  guardarDatos(): void {
    const nombre = this.datos.nombre.trim();
    const telefono = this.datos.telefono.trim();
    if (!nombre) {
      this.errorModal = 'Escribe tu nombre.';
      return;
    }
    if (!/^\d{7,15}$/.test(telefono)) {
      this.errorModal = 'El teléfono debe tener entre 7 y 15 números, sin espacios ni símbolos.';
      return;
    }
    this.guardar(
      {
        foto: this.datos.foto,
        nombre,
        telefono,
        fecha_nacimiento: this.datos.fecha_nacimiento || null,
        grupo_sanguineo: this.datos.grupo_sanguineo,
      },
      'Guardamos tus datos personales.',
    );
  }

  guardarFicha(): void {
    const telefono = this.ficha.contacto_emergencia_telefono.trim();
    if (telefono && !/^\d{7,15}$/.test(telefono)) {
      this.errorModal = 'El teléfono del contacto debe tener entre 7 y 15 números, sin espacios ni símbolos.';
      return;
    }
    this.guardar(
      {
        alergias: this.ficha.alergias.trim(),
        condiciones: this.ficha.condiciones.trim(),
        contacto_emergencia_nombre: this.ficha.contacto_emergencia_nombre.trim(),
        contacto_emergencia_telefono: telefono,
      },
      'Guardamos tu ficha médica.',
    );
  }

  cambiarTamanoLetra(valor: TamanoLetra): void {
    this.tamanoLetra = valor;
    this.preferencias.cambiarTamanoLetra(valor);
  }

  verTutorial(): void {
    this.tutorial.iniciar();
  }

  private abrir(modal: Modal): void {
    this.errorModal = '';
    this.mensaje = '';
    this.modal = modal;
  }

  private guardar(cambios: ActualizarUsuarioRequest, mensaje: string): void {
    if (this.guardando) return;
    this.guardando = true;
    this.errorModal = '';
    this.auth.actualizarPerfil(cambios).subscribe({
      next: (usuario) => {
        this.guardando = false;
        this.usuario = usuario;
        this.modal = null;
        this.mensaje = mensaje;
      },
      error: (err: Error) => {
        this.guardando = false;
        this.errorModal = err.message || 'No se pudieron guardar los cambios.';
      },
    });
  }
}
