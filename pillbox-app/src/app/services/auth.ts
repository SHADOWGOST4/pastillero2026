import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import {
  ApiErrorResponse,
  LoginRequest,
  LoginResponse,
  RefreshTokenRequest,
  RefreshTokenResponse,
  RegistroRequest,
  UsuarioResponse
} from '../core/models/api.interfaces';

const STORAGE_KEYS = {
  usuario: 'pillbox_usuario',
  accessToken: 'pillbox_access_token',
  refreshToken: 'pillbox_refresh_token'
};

@Injectable({
  providedIn: 'root'
})
export class Auth {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  registrar(data: RegistroRequest): Observable<UsuarioResponse> {
    return this.http.post<UsuarioResponse>(`${this.apiUrl}registro/`, data);
  }

  login(data: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}login/`, data).pipe(
      tap((response) => this.guardarSesion(response)),
      catchError((error) => this.manejarError(error))
    );
  }

  refreshAccessToken(): Observable<string> {
    const refreshToken = this.obtenerRefreshToken();

    if (!refreshToken) {
      this.cerrarSesion();
      return throwError(() => new Error('No hay refresh token disponible.'));
    }

    const payload: RefreshTokenRequest = { refresh: refreshToken };

    return this.http.post<RefreshTokenResponse>(`${this.apiUrl}token/refresh/`, payload).pipe(
      map((response) => {
        this.guardarAccessToken(response.access);
        return response.access;
      }),
      catchError((error) => {
        this.cerrarSesion();
        return this.manejarError(error);
      })
    );
  }

  guardarSesion(response: LoginResponse) {
    this.guardarUsuario(response.usuario);
    this.guardarAccessToken(response.access);
    this.guardarRefreshToken(response.refresh);
  }

  guardarUsuario(usuario: any) {
    localStorage.setItem(STORAGE_KEYS.usuario, JSON.stringify(usuario));
  }

  guardarAccessToken(token: string) {
    localStorage.setItem(STORAGE_KEYS.accessToken, token);
  }

  guardarRefreshToken(token: string) {
    localStorage.setItem(STORAGE_KEYS.refreshToken, token);
  }

  obtenerUsuario() {
    const raw = localStorage.getItem(STORAGE_KEYS.usuario);
    return raw ? JSON.parse(raw) : null;
  }

  obtenerAccessToken() {
    return localStorage.getItem(STORAGE_KEYS.accessToken) || null;
  }

  obtenerRefreshToken() {
    return localStorage.getItem(STORAGE_KEYS.refreshToken) || null;
  }

  restaurarSesion() {
    return this.obtenerUsuario() && this.obtenerAccessToken();
  }

  estaAutenticado() {
    return Boolean(this.obtenerAccessToken());
  }

  cerrarSesion() {
    localStorage.removeItem(STORAGE_KEYS.usuario);
    localStorage.removeItem(STORAGE_KEYS.accessToken);
    localStorage.removeItem(STORAGE_KEYS.refreshToken);
  }

  private manejarError(error: any): Observable<never> {
    const apiError: ApiErrorResponse = error?.error ?? {};
    const message = apiError?.detail || apiError?.code || 'Error de autenticación';
    return throwError(() => new Error(message));
  }
}