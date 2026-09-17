import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  ActualizarVinculacionRequest,
  CrearVinculacionRequest,
  VinculacionResponse,
} from '../core/models/api.interfaces';

@Injectable({
  providedIn: 'root',
})
export class Vinculacion {
  private apiUrl = `${environment.apiUrl}vinculaciones/`;
  /** Se emite cada vez que una vinculación cambia de estado (crear, aceptar,
   * rechazar, eliminar), para que el selector de cuenta del topbar se
   * refresque sin depender de una recarga completa de la página. */
  readonly vinculacionActualizada$ = new Subject<void>();

  constructor(private http: HttpClient) {}

  getAll(): Observable<VinculacionResponse[]> {
    return this.http.get<VinculacionResponse[]>(this.apiUrl);
  }

  create(data: CrearVinculacionRequest): Observable<VinculacionResponse> {
    return this.http.post<VinculacionResponse>(this.apiUrl, data);
  }

  actualizarPermisos(id: number, data: ActualizarVinculacionRequest): Observable<VinculacionResponse> {
    return this.http.patch<VinculacionResponse>(`${this.apiUrl}${id}/`, data);
  }

  aceptar(id: number): Observable<VinculacionResponse> {
    return this.http
      .post<VinculacionResponse>(`${this.apiUrl}${id}/aceptar/`, {})
      .pipe(tap(() => this.vinculacionActualizada$.next()));
  }

  rechazar(id: number): Observable<VinculacionResponse> {
    return this.http
      .post<VinculacionResponse>(`${this.apiUrl}${id}/rechazar/`, {})
      .pipe(tap(() => this.vinculacionActualizada$.next()));
  }

  delete(id: number): Observable<void> {
    return this.http
      .delete<void>(`${this.apiUrl}${id}/`)
      .pipe(tap(() => this.vinculacionActualizada$.next()));
  }
}
