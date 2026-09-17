import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { UsuarioResumenResponse } from '../core/models/api.interfaces';

const STORAGE_KEY = 'pillbox_cuenta_activa';

/**
 * Cuenta que el usuario autenticado está "viendo" en este momento: `null`
 * significa su propia cuenta. Cuando no es null, las páginas de
 * Medicamentos/Horarios/Registros deben consultar los datos de esa cuenta
 * (solo lectura) en vez de los propios. Puramente del lado del cliente: el
 * backend revalida el acceso en cada petición vía el parámetro `?titular=`.
 */
@Injectable({
  providedIn: 'root',
})
export class CuentaActiva {
  private cuentaSubject = new BehaviorSubject<UsuarioResumenResponse | null>(this.leerAlmacenada());
  cuentaActiva$ = this.cuentaSubject.asObservable();

  obtenerCuentaActiva(): UsuarioResumenResponse | null {
    return this.cuentaSubject.value;
  }

  verComo(usuario: UsuarioResumenResponse): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(usuario));
    this.cuentaSubject.next(usuario);
  }

  volverAMiCuenta(): void {
    localStorage.removeItem(STORAGE_KEY);
    this.cuentaSubject.next(null);
  }

  private leerAlmacenada(): UsuarioResumenResponse | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
}
