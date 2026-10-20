import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { TIEMPO_MAXIMO_PETICION_MS, timeoutInterceptor } from './timeout.interceptor';

describe('timeoutInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([timeoutInterceptor])), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });

  it('convierte una petición colgada en un error de red (status 0)', fakeAsync(() => {
    let error: HttpErrorResponse | undefined;
    http.delete('/api/dispositivos/1/').subscribe({ error: (e) => (error = e) });
    const peticion = backend.expectOne('/api/dispositivos/1/');

    tick(TIEMPO_MAXIMO_PETICION_MS - 1);
    expect(error).toBeUndefined();
    tick(1);

    expect(error).toEqual(jasmine.any(HttpErrorResponse));
    expect(error!.status).toBe(0);
    expect(peticion.cancelled).toBeTrue();
  }));

  it('deja pasar las respuestas y errores del servidor sin tocarlos', fakeAsync(() => {
    let respuesta: unknown;
    let error: HttpErrorResponse | undefined;
    http.get('/api/a/').subscribe((r) => (respuesta = r));
    http.get('/api/b/').subscribe({ error: (e) => (error = e) });

    backend.expectOne('/api/a/').flush({ ok: true });
    backend.expectOne('/api/b/').flush({ detail: 'No' }, { status: 403, statusText: 'Forbidden' });
    tick(TIEMPO_MAXIMO_PETICION_MS);

    expect(respuesta).toEqual({ ok: true });
    expect(error!.status).toBe(403);
  }));
});
