import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  ActualizarContactoRequest,
  ContactoResponse,
  CrearContactoRequest,
} from '../core/models/api.interfaces';

@Injectable({
  providedIn: 'root',
})
export class Contacto {
  private apiUrl = `${environment.apiUrl}contactos/`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<ContactoResponse[]> {
    return this.http.get<ContactoResponse[]>(this.apiUrl);
  }

  getById(id: number): Observable<ContactoResponse> {
    return this.http.get<ContactoResponse>(`${this.apiUrl}${id}/`);
  }

  create(data: CrearContactoRequest): Observable<ContactoResponse> {
    return this.http.post<ContactoResponse>(this.apiUrl, data);
  }

  update(id: number, data: ActualizarContactoRequest): Observable<ContactoResponse> {
    return this.http.put<ContactoResponse>(`${this.apiUrl}${id}/`, data);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}${id}/`);
  }
}
