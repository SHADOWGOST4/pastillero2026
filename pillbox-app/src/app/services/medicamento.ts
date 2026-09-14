import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import {
  ActualizarMedicamentoRequest,
  CrearMedicamentoRequest,
  MedicamentoResponse,
  MedicamentoCoberturaResponse,
  MovimientoStockResponse,
  ReponerStockRequest,
  AjustarStockRequest,
  PaginatedResponse,
} from '../core/models/api.interfaces';

@Injectable({ providedIn: 'root' })
export class Medicamento {
  private apiUrl = `${environment.apiUrl}medicamentos/`;

  constructor(private http: HttpClient) {}

  getPage(page = 1): Observable<PaginatedResponse<MedicamentoResponse>> {
    return this.http.get<PaginatedResponse<MedicamentoResponse>>(this.apiUrl, {
      params: { page },
    });
  }

  /**
   * Obtiene la colección completa para selectores y procesos globales.
   * Las pantallas de listado deben usar getPage() para conservar la paginación.
   */
  getAll(): Observable<MedicamentoResponse[]> {
    return this.getAllPages(this.apiUrl, []);
  }

  private getAllPages(
    url: string,
    accumulated: MedicamentoResponse[],
  ): Observable<MedicamentoResponse[]> {
    return this.http.get<PaginatedResponse<MedicamentoResponse> | MedicamentoResponse[]>(url).pipe(
      switchMap((page) => {
        if (Array.isArray(page)) {
          return of([...accumulated, ...page]);
        }
        const items = [...accumulated, ...page.results];
        return page.next ? this.getAllPages(page.next, items) : of(items);
      }),
    );
  }

  getByUsuario(_id_usuario: number): Observable<MedicamentoResponse[]> {
    return this.getAll();
  }

  getById(id: number): Observable<MedicamentoResponse> {
    return this.http.get<MedicamentoResponse>(`${this.apiUrl}${id}/`);
  }

  getCobertura(id: number): Observable<MedicamentoCoberturaResponse> {
    return this.http.get<MedicamentoCoberturaResponse>(`${this.apiUrl}${id}/cobertura/`);
  }

  reponer(id: number, data: ReponerStockRequest): Observable<MovimientoStockResponse> {
    return this.http.post<MovimientoStockResponse>(`${this.apiUrl}${id}/reponer/`, data);
  }

  ajustarStock(id: number, data: AjustarStockRequest): Observable<MovimientoStockResponse> {
    return this.http.post<MovimientoStockResponse>(`${this.apiUrl}${id}/ajustar-stock/`, data);
  }

  getMovimientos(params: { page?: number; page_size?: number; medicamento?: number; tipo?: string } = {}): Observable<PaginatedResponse<MovimientoStockResponse>> {
    return this.http.get<PaginatedResponse<MovimientoStockResponse>>(
      `${environment.apiUrl}movimientos-stock/`,
      { params: params as Record<string, string | number> },
    );
  }

  create(data: CrearMedicamentoRequest): Observable<MedicamentoResponse> {
    return this.http.post<MedicamentoResponse>(this.apiUrl, data);
  }

  update(id: number, data: ActualizarMedicamentoRequest): Observable<MedicamentoResponse> {
    return this.http.put<MedicamentoResponse>(`${this.apiUrl}${id}/`, data);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}${id}/`);
  }
}
