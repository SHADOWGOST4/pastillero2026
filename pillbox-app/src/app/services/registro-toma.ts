import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  CrearRegistroTomaRequest,
  PaginatedResponse,
  RegistroTomaResponse,
} from '../core/models/api.interfaces';
import { of } from 'rxjs';
import { switchMap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class RegistroToma {
  private apiUrl = `${environment.apiUrl}registros/`;
  readonly registroActualizado$ = new Subject<void>();

  constructor(private http: HttpClient) {}

  getPage(page = 1): Observable<PaginatedResponse<RegistroTomaResponse>> {
    return this.http.get<PaginatedResponse<RegistroTomaResponse>>(this.apiUrl, {
      params: { page },
    });
  }

  getAll(): Observable<RegistroTomaResponse[]> {
    return this.getAllPages(this.apiUrl, []);
  }

  private getAllPages(
    url: string,
    accumulated: RegistroTomaResponse[],
  ): Observable<RegistroTomaResponse[]> {
    return this.http.get<PaginatedResponse<RegistroTomaResponse> | RegistroTomaResponse[]>(url).pipe(
      switchMap((page) => {
        if (Array.isArray(page)) {
          return of([...accumulated, ...page]);
        }
        const items = [...accumulated, ...page.results];
        return page.next ? this.getAllPages(page.next, items) : of(items);
      }),
    );
  }

  getById(id: number): Observable<RegistroTomaResponse> {
    return this.http.get<RegistroTomaResponse>(`${this.apiUrl}${id}/`);
  }

  create(data: CrearRegistroTomaRequest): Observable<RegistroTomaResponse> {
    return this.http.post<RegistroTomaResponse>(this.apiUrl, data);
  }

  confirmar(id: number, fechaHoraReal = new Date().toISOString()): Observable<RegistroTomaResponse> {
    return this.http.patch<RegistroTomaResponse>(`${this.apiUrl}${id}/`, {
      fecha_hora_real: fechaHoraReal,
    });
  }

  notificarActualizacion(): void {
    this.registroActualizado$.next();
  }
}
