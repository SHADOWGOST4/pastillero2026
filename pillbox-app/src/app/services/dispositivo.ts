import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  ActualizarDispositivoRequest,
  AsignacionDispositivoResponse,
  CredencialDispositivoResponse,
  CrearDispositivoRequest,
  DispositivoResponse,
} from '../core/models/api.interfaces';

@Injectable({
  providedIn: 'root',
})
export class DispositivoService {
  private apiUrl = `${environment.apiUrl}dispositivos/`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<DispositivoResponse[]> {
    return this.http.get<DispositivoResponse[]>(this.apiUrl);
  }

  getById(id: number): Observable<DispositivoResponse> {
    return this.http.get<DispositivoResponse>(`${this.apiUrl}${id}/`);
  }

  create(data: CrearDispositivoRequest): Observable<DispositivoResponse> {
    return this.http.post<DispositivoResponse>(this.apiUrl, data);
  }

  update(id: number, data: ActualizarDispositivoRequest): Observable<DispositivoResponse> {
    return this.http.put<DispositivoResponse>(`${this.apiUrl}${id}/`, data);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}${id}/`);
  }

  getAsignacion(id: number): Observable<AsignacionDispositivoResponse> {
    return this.http.get<AsignacionDispositivoResponse>(`${this.apiUrl}${id}/asignacion/`);
  }

  asignarHorario(id: number, id_horario: number): Observable<AsignacionDispositivoResponse> {
    return this.http.put<AsignacionDispositivoResponse>(`${this.apiUrl}${id}/asignacion/`, { id_horario });
  }

  generarCredencial(id: number): Observable<CredencialDispositivoResponse> {
    return this.http.post<CredencialDispositivoResponse>(`${this.apiUrl}${id}/generar-credencial/`, {});
  }
}
