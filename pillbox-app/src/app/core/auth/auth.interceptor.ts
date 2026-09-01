import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { Auth } from '../../services/auth';

let isRefreshing = false;

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

  return next(request).pipe(
    catchError((error: HttpErrorResponse) => {
      const isUnauthorized = error.status === 401;
      const hasRefreshToken = !!auth.obtenerRefreshToken();

      if (!isUnauthorized || isPublicEndpoint || !hasRefreshToken) {
        return throwError(() => error);
      }

      if (isRefreshing) {
        auth.cerrarSesion();
        return throwError(() => error);
      }

      isRefreshing = true;

      return auth.refreshAccessToken().pipe(
        switchMap((newAccessToken) => {
          isRefreshing = false;
          const retryRequest = req.clone({
            setHeaders: {
              Authorization: `Bearer ${newAccessToken}`
            }
          });
          return next(retryRequest);
        }),
        catchError((refreshError) => {
          isRefreshing = false;
          auth.cerrarSesion();
          return throwError(() => refreshError);
        })
      );
    })
  );
};
