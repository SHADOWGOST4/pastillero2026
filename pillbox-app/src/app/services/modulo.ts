import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  ActualizarModuloRequest,
  CrearModuloRequest,
  ModuloResponse,
} from '../core/models/api.interfaces';

@Injectable({
  providedIn: 'root',
})
export class ModuloService {
  private apiUrl = `${environment.apiUrl}modulos/`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<ModuloResponse[]> {
    return this.http.get<ModuloResponse[]>(this.apiUrl);
  }

  getById(id: number): Observable<ModuloResponse> {
    return this.http.get<ModuloResponse>(`${this.apiUrl}${id}/`);
  }

  create(data: CrearModuloRequest): Observable<ModuloResponse> {
    return this.http.post<ModuloResponse>(this.apiUrl, data);
  }

  update(id: number, data: ActualizarModuloRequest): Observable<ModuloResponse> {
    return this.http.put<ModuloResponse>(`${this.apiUrl}${id}/`, data);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}${id}/`);
  }
}
