import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';

export type TamanoLetra = 'normal' | 'grande' | 'muy-grande';

export const TAMANOS_LETRA: { valor: TamanoLetra; etiqueta: string; escala: number }[] = [
  { valor: 'normal', etiqueta: 'Normal', escala: 100 },
  { valor: 'grande', etiqueta: 'Grande', escala: 112.5 },
  { valor: 'muy-grande', etiqueta: 'Muy grande', escala: 125 },
];

const CLAVE_TAMANO = 'pillbox_tamano_letra';

/**
 * Preferencias de este teléfono. El tamaño de letra escala el `font-size`
 * raíz: los estilos usan `rem`, así que crece toda la app.
 */
@Injectable({ providedIn: 'root' })
export class Preferencias {
  private readonly document = inject(DOCUMENT);

  get tamanoLetra(): TamanoLetra {
    try {
      const guardado = localStorage.getItem(CLAVE_TAMANO) as TamanoLetra | null;
      return TAMANOS_LETRA.some((t) => t.valor === guardado) ? (guardado as TamanoLetra) : 'normal';
    } catch {
      return 'normal';
    }
  }

  cambiarTamanoLetra(valor: TamanoLetra): void {
    try {
      localStorage.setItem(CLAVE_TAMANO, valor);
    } catch {
      // sin almacenamiento: se aplica solo en esta sesión
    }
    this.aplicar(valor);
  }

  /** Se llama al arrancar la app. */
  aplicarGuardadas(): void {
    this.aplicar(this.tamanoLetra);
  }

  private aplicar(valor: TamanoLetra): void {
    const escala = TAMANOS_LETRA.find((t) => t.valor === valor)?.escala ?? 100;
    this.document.documentElement.style.fontSize = escala === 100 ? '' : `${escala}%`;
  }
}
