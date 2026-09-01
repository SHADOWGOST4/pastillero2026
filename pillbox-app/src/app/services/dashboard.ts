import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';
import { ProximaTomaItem } from '../core/models/api.interfaces';

@Injectable({
  providedIn: 'root'
})
export class Dashboards {
  private apiUrl = `${environment.apiUrl}proximos-horarios/`;

  constructor(private http: HttpClient) {}

  getProximosHorarios(): Observable<ProximaTomaItem[]> {
    return this.http.get<ProximaTomaItem[]>(this.apiUrl);
  }
}
