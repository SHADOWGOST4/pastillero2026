import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import {
  ActualizarHorarioRequest,
  CrearHorarioRequest,
  HorarioResponse,
  PaginatedResponse,
} from '../core/models/api.interfaces';

@Injectable({
  providedIn: 'root',
})
export class Horario {
  private apiUrl = `${environment.apiUrl}horarios/`;

  constructor(private http: HttpClient) {}

  getPage(page = 1, titular?: number): Observable<PaginatedResponse<HorarioResponse>> {
    const params: Record<string, number> = { page };
    if (titular) params['titular'] = titular;
    return this.http.get<PaginatedResponse<HorarioResponse>>(this.apiUrl, { params });
  }

  getAll(titular?: number): Observable<HorarioResponse[]> {
    const url = titular ? `${this.apiUrl}?titular=${titular}` : this.apiUrl;
    return this.getAllPages(url, []);
  }

  private getAllPages(url: string, accumulated: HorarioResponse[]): Observable<HorarioResponse[]> {
    return this.http.get<PaginatedResponse<HorarioResponse> | HorarioResponse[]>(url).pipe(
      switchMap((page) => {
        if (Array.isArray(page)) {
          return of([...accumulated, ...page]);
        }
        const items = [...accumulated, ...page.results];
        return page.next ? this.getAllPages(page.next, items) : of(items);
      }),
    );
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

  activar(id: number): Observable<HorarioResponse> {
    return this.http.post<HorarioResponse>(`${this.apiUrl}${id}/activar/`, {});
  }

  deshabilitar(id: number): Observable<HorarioResponse> {
    return this.http.post<HorarioResponse>(`${this.apiUrl}${id}/deshabilitar/`, {});
  }
}
