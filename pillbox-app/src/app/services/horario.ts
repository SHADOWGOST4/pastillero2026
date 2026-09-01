import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  ActualizarHorarioRequest,
  CrearHorarioRequest,
  HorarioResponse,
} from '../core/models/api.interfaces';

@Injectable({
  providedIn: 'root',
})
export class Horario {
  private apiUrl = `${environment.apiUrl}horarios/`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<HorarioResponse[]> {
    return this.http.get<HorarioResponse[]>(this.apiUrl);
  }

  getByUsuario(_id_usuario: number): Observable<HorarioResponse[]> {
    return this.getAll();
  }

  getById(id: number): Observable<HorarioResponse> {
    return this.http.get<HorarioResponse>(`${this.apiUrl}${id}/`);
  }

  create(data: CrearHorarioRequest): Observable<HorarioResponse> {
    return this.http.post<HorarioResponse>(this.apiUrl, data);
  }

  update(id: number, data: ActualizarHorarioRequest): Observable<HorarioResponse> {
    return this.http.put<HorarioResponse>(`${this.apiUrl}${id}/`, data);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}${id}/`);
  }
}
