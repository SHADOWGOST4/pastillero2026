import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ModuloService } from './modulo';
import { ActualizarModuloRequest, CrearModuloRequest, ModuloResponse } from '../core/models/api.interfaces';

describe('ModuloService', () => {
  let service: ModuloService;
  let httpController: HttpTestingController;
  const apiUrl = 'http://localhost:8000/api/modulos/';
  const modulo: ModuloResponse = {
    id: 1,
    id_dispositivo: 2,
    dispositivo_nombre: 'Pastillero Principal',
    numero_modulo: 1,
    id_medicamento: null,
    medicamento_nombre: null,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ModuloService);
    httpController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpController.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('obtiene todos los módulos', () => {
    service.getAll().subscribe((data) => expect(data).toEqual([modulo]));
    const request = httpController.expectOne(apiUrl);
    expect(request.request.method).toBe('GET');
    request.flush([modulo]);
  });

  it('obtiene un módulo por id', () => {
    service.getById(1).subscribe((data) => expect(data).toEqual(modulo));
    const request = httpController.expectOne(`${apiUrl}1/`);
    expect(request.request.method).toBe('GET');
    request.flush(modulo);
  });

  it('crea un módulo', () => {
    const payload: CrearModuloRequest = {
      id_dispositivo: 2,
      numero_modulo: 1,
      id_medicamento: null,
    };
    service.create(payload).subscribe((data) => expect(data).toEqual(modulo));
    const request = httpController.expectOne(apiUrl);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(payload);
    request.flush(modulo);
  });

  it('actualiza un módulo', () => {
    const payload: ActualizarModuloRequest = {
      id_dispositivo: 2,
      numero_modulo: 1,
      id_medicamento: 5,
    };
    service.update(1, payload).subscribe((data) => expect(data).toEqual(modulo));
    const request = httpController.expectOne(`${apiUrl}1/`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual(payload);
    request.flush(modulo);
  });

  it('propaga errores HTTP', () => {
    const error = { detail: 'Este medicamento ya se encuentra asignado a otro módulo.' };
    service.getAll().subscribe({
      next: () => fail('La solicitud debía fallar'),
      error: (received) => expect(received.error).toEqual(error),
    });
    const request = httpController.expectOne(apiUrl);
    request.flush(error, { status: 400, statusText: 'Bad Request' });
  });

  it('elimina un módulo', () => {
    service.delete(1).subscribe();
    const request = httpController.expectOne(`${apiUrl}1/`);
    expect(request.request.method).toBe('DELETE');
    request.flush(null);
  });
});
