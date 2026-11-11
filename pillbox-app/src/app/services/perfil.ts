import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AdherenciaResponse, FichaMedicaResponse } from '../core/models/api.interfaces';

@Injectable({ providedIn: 'root' })
export class Perfil {
  private apiUrl = `${environment.apiUrl}perfil/`;

  constructor(private http: HttpClient) {}

  adherencia(): Observable<AdherenciaResponse> {
    return this.http.get<AdherenciaResponse>(`${this.apiUrl}adherencia/`);
  }

  fichaMedica(): Observable<FichaMedicaResponse> {
    return this.http.get<FichaMedicaResponse>(`${this.apiUrl}ficha-medica/`);
  }
}

/** Edad cumplida a partir de una fecha `AAAA-MM-DD`. */
export function calcularEdad(fechaNacimiento?: string | null, hoy = new Date()): number | null {
  if (!fechaNacimiento) return null;
  const [anio, mes, dia] = fechaNacimiento.split('-').map(Number);
  if (!anio || !mes || !dia) return null;
  const cumplio = hoy.getMonth() + 1 > mes || (hoy.getMonth() + 1 === mes && hoy.getDate() >= dia);
  return hoy.getFullYear() - anio - (cumplio ? 0 : 1);
}

/**
 * Recorta la imagen al centro en un cuadrado de `lado` px y la comprime en
 * JPEG: queda en unos 20-40 KB, que el servidor guarda tal cual.
 */
export function prepararFoto(archivo: File, lado = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(archivo);
    const imagen = new Image();
    imagen.onload = () => {
      const recorte = Math.min(imagen.naturalWidth, imagen.naturalHeight);
      const lienzo = document.createElement('canvas');
      lienzo.width = lado;
      lienzo.height = lado;
      const ctx = lienzo.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error('No se pudo procesar la imagen.'));
        return;
      }
      ctx.drawImage(
        imagen,
        (imagen.naturalWidth - recorte) / 2,
        (imagen.naturalHeight - recorte) / 2,
        recorte,
        recorte,
        0,
        0,
        lado,
        lado,
      );
      URL.revokeObjectURL(url);
      resolve(lienzo.toDataURL('image/jpeg', 0.82));
    };
    imagen.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('No se pudo leer la imagen.'));
    };
    imagen.src = url;
  });
}
