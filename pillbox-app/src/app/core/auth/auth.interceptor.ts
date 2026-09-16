import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, catchError, finalize, shareReplay, switchMap, throwError } from 'rxjs';
import { Auth } from '../../services/auth';

// Refresh compartido entre peticiones 401 concurrentes: si dos llamadas del
// dashboard expiran a la vez, la segunda se engancha a la misma llamada de
// refresh en curso (éxito o error) en vez de cerrar sesión de inmediato.
let refreshTokenObservable: Observable<string> | null = null;

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(Auth);
  const url = req.url.toLowerCase();
  const isPublicEndpoint =
    url.includes('/login/') ||
    url.includes('/registro/') ||
    url.includes('/token/refresh/');

  const token = auth.obtenerAccessToken();
  const request = !isPublicEndpoint && token
    ? req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`
        }
      })
    : req;

  const withToken = (accessToken: string) =>
    next(req.clone({ setHeaders: { Authorization: `Bearer ${accessToken}` } }));

  return next(request).pipe(
    catchError((error: HttpErrorResponse) => {
      const isUnauthorized = error.status === 401;
      const hasRefreshToken = !!auth.obtenerRefreshToken();

      if (!isUnauthorized || isPublicEndpoint || !hasRefreshToken) {
        return throwError(() => error);
      }

      if (!refreshTokenObservable) {
        refreshTokenObservable = auth.refreshAccessToken().pipe(
          finalize(() => {
            refreshTokenObservable = null;
          }),
          shareReplay(1)
        );
      }

      return refreshTokenObservable.pipe(
        switchMap((newAccessToken) => withToken(newAccessToken)),
        catchError((refreshError) => {
          auth.cerrarSesion();
          return throwError(() => refreshError);
        })
      );
    })
  );
};
