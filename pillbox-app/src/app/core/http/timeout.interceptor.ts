import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { TimeoutError, catchError, throwError, timeout } from 'rxjs';

/** Tiempo máximo de cada petición antes de darla por perdida (p. ej. con datos móviles débiles). */
export const TIEMPO_MAXIMO_PETICION_MS = 20_000;

/**
 * Corta las peticiones colgadas y las convierte en un error de red (status 0),
 * el mismo que da el navegador sin conexión, para que cada pantalla lo trate igual.
 */
export const timeoutInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(
    timeout(TIEMPO_MAXIMO_PETICION_MS),
    catchError((error) =>
      throwError(() =>
        error instanceof TimeoutError
          ? new HttpErrorResponse({ status: 0, statusText: 'Timeout', url: req.url, error: null })
          : error,
      ),
    ),
  );
