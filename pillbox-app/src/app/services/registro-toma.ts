import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  ConfirmarRegistroTomaRequest,
  CrearRegistroTomaRequest,
  RegistroTomaResponse,
} from '../core/models/api.interfaces';

@Injectable({
  providedIn: 'root',
})
export class RegistroToma {
  private apiUrl = `${environment.apiUrl}registros/`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<RegistroTomaResponse[]> {
    return this.http.get<RegistroTomaResponse[]>(this.apiUrl);
  }

  getById(id: number): Observable<RegistroTomaResponse> {
    return this.http.get<RegistroTomaResponse>(`${this.apiUrl}${id}/`);
  }

  create(data: CrearRegistroTomaRequest): Observable<RegistroTomaResponse> {
    return this.http.post<RegistroTomaResponse>(this.apiUrl, data);
  }

  confirm(id: number, data: ConfirmarRegistroTomaRequest): Observable<RegistroTomaResponse> {
    return this.http.patch<RegistroTomaResponse>(`${this.apiUrl}${id}/`, data);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}${id}/`);
  }
}
