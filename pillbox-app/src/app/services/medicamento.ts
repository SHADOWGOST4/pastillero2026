import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  ActualizarMedicamentoRequest,
  CrearMedicamentoRequest,
  MedicamentoResponse,
} from '../core/models/api.interfaces';

@Injectable({ providedIn: 'root' })
export class Medicamento {
  private apiUrl = `${environment.apiUrl}medicamentos/`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<MedicamentoResponse[]> {
    return this.http.get<MedicamentoResponse[]>(this.apiUrl);
  }

  getByUsuario(_id_usuario: number): Observable<MedicamentoResponse[]> {
    return this.getAll();
  }

  getById(id: number): Observable<MedicamentoResponse> {
    return this.http.get<MedicamentoResponse>(`${this.apiUrl}${id}/`);
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
