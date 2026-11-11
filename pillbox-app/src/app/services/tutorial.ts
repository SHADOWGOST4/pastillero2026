import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { Auth } from './auth';

/**
 * Un paso del recorrido guiado. `objetivo` es el valor de un atributo
 * `data-tour` en la pantalla de `ruta`: el tutorial oscurece todo menos ese
 * elemento. Sin objetivo (o si no aparece, p. ej. en modo solo lectura) la
 * tarjeta sale centrada.
 */
export interface PasoTutorial {
  ruta: string;
  objetivo?: string;
  titulo: string;
  texto: string;
}

export const PASOS_TUTORIAL: PasoTutorial[] = [
  {
    ruta: '/dashboard',
    titulo: 'Te damos la bienvenida a Pillbox',
    texto: 'Te mostramos en un minuto cómo se usa la app. Puedes saltar el recorrido cuando quieras y repetirlo desde tu perfil.',
  },
  {
    ruta: '/dashboard',
    objetivo: 'menu',
    titulo: 'Menú',
    texto: 'Desde aquí abres el menú para moverte entre las secciones de la app.',
  },
  {
    ruta: '/dashboard',
    objetivo: 'resumen',
    titulo: 'Tu día de un vistazo',
    texto: 'Cuántas tomas tienes programadas y cuál es la siguiente.',
  },
  {
    ruta: '/dashboard',
    objetivo: 'stock',
    titulo: 'Estado del stock',
    texto: 'Te avisa cuando un medicamento se está acabando, para que lo repongas a tiempo.',
  },
  {
    ruta: '/dashboard',
    objetivo: 'proximas',
    titulo: 'Próximas tomas',
    texto: 'La lista de las siguientes tomas, con la hora y la dosis de cada una.',
  },
  {
    ruta: '/dispositivo',
    objetivo: 'conectar',
    titulo: 'Conecta tu pastillero',
    texto: 'Empieza por aquí: escanea el código QR de la base y la app la conecta a tu wifi.',
  },
  {
    ruta: '/dispositivo',
    objetivo: 'estado-pastillero',
    titulo: 'Estado del pastillero',
    texto: 'Aquí ves si la base está en línea y gestionas sus módulos, los compartimentos donde van las pastillas.',
  },
  {
    ruta: '/medicamentos',
    objetivo: 'agregar-medicamento',
    titulo: 'Agrega tus medicamentos',
    texto: 'Registra cada medicamento con su dosis y cuántas pastillas tienes.',
  },
  {
    ruta: '/medicamentos',
    objetivo: 'lista-medicamentos',
    titulo: 'Tus medicamentos',
    texto: 'Con el menú de cada uno puedes editarlo, registrar una reposición o ajustar el stock.',
  },
  {
    ruta: '/horarios',
    objetivo: 'agregar-horario',
    titulo: 'Programa los horarios',
    texto: 'Indica a qué hora y cada cuánto tomas cada medicamento. A esa hora suenan la alarma del teléfono y la base.',
  },
  {
    ruta: '/horarios',
    objetivo: 'lista-horarios',
    titulo: 'Horarios programados',
    texto: 'Puedes editar, pausar o eliminar un horario sin perder el historial.',
  },
  {
    ruta: '/registros',
    objetivo: 'resumen-registros',
    titulo: 'Historial de tomas',
    texto: 'Cuántas tomas se realizaron y cuántas siguen pendientes.',
  },
  {
    ruta: '/registros',
    objetivo: 'lista-registros',
    titulo: 'Cada toma, registrada',
    texto: 'Cada vez que confirmas una toma en la app o en la base, queda anotada aquí con su hora.',
  },
  {
    ruta: '/cuentas-vinculadas',
    objetivo: 'invitar',
    titulo: 'Invita a un familiar o cuidador',
    texto: 'Comparte tu medicación en solo lectura con alguien de confianza, para que pueda seguir tu tratamiento.',
  },
  {
    ruta: '/cuentas-vinculadas',
    objetivo: 'cuenta',
    titulo: 'Tu cuenta',
    texto: 'Toca aquí para cambiar a una cuenta que monitoreas o ir a tu perfil.',
  },
  {
    ruta: '/perfil',
    objetivo: 'ficha',
    titulo: 'Tu ficha médica',
    texto: 'Anota tus alergias, condiciones y un contacto de emergencia. Desde tu perfil puedes llamarlo o mostrar la ficha en un QR.',
  },
  {
    ruta: '/perfil',
    objetivo: 'tutorial',
    titulo: '¡Listo!',
    texto: 'Ya conoces la app. Si quieres repetir este recorrido, lo encuentras aquí, en tu perfil.',
  },
];

@Injectable({ providedIn: 'root' })
export class Tutorial {
  readonly pasos = PASOS_TUTORIAL;
  /** Índice del paso visible, o null si el tutorial está cerrado. */
  readonly pasoActual$ = new BehaviorSubject<number | null>(null);

  constructor(
    private router: Router,
    private auth: Auth,
  ) {}

  get activo(): boolean {
    return this.pasoActual$.value !== null;
  }

  iniciar(): void {
    this.irAPaso(0);
  }

  siguiente(): void {
    const actual = this.pasoActual$.value;
    if (actual === null) return;
    if (actual >= this.pasos.length - 1) {
      this.cerrar();
      return;
    }
    this.irAPaso(actual + 1);
  }

  anterior(): void {
    const actual = this.pasoActual$.value;
    if (actual === null || actual === 0) return;
    this.irAPaso(actual - 1);
  }

  /** Terminar o saltar cuentan igual: el tutorial no vuelve a salir solo. */
  cerrar(): void {
    this.pasoActual$.next(null);
    if (this.auth.obtenerUsuario()?.tutorial_completado !== true) {
      this.auth.actualizarPerfil({ tutorial_completado: true }).subscribe({ error: () => {} });
    }
  }

  /** Cierra sin marcarlo como visto (p. ej. al cerrar sesión a mitad). */
  detener(): void {
    this.pasoActual$.next(null);
  }

  private irAPaso(indice: number): void {
    const paso = this.pasos[indice];
    const rutaActual = this.router.url.split('?')[0];
    if (rutaActual !== paso.ruta) {
      void this.router.navigateByUrl(paso.ruta);
    }
    this.pasoActual$.next(indice);
  }
}
