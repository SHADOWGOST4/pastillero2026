import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { DispositivoService } from './dispositivo';

describe('DispositivoService', () => {
  let service: DispositivoService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(DispositivoService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getEventos', () => {
    it('pide la actividad del dispositivo sin filtros', () => {
      service.getEventos(3).subscribe();
      const peticion = http.expectOne((r) => r.url.endsWith('/dispositivos/3/eventos/'));
      expect(peticion.request.method).toBe('GET');
      expect(peticion.request.params.keys()).toEqual([]);
      peticion.flush([]);
    });

    it('envía el módulo y el límite cuando se indican', () => {
      service.getEventos(3, { modulo: 2, limit: 10 }).subscribe();
      const peticion = http.expectOne((r) => r.url.endsWith('/dispositivos/3/eventos/'));
      expect(peticion.request.params.get('modulo')).toBe('2');
      expect(peticion.request.params.get('limit')).toBe('10');
      peticion.flush([]);
    });

    it('un módulo con número 0 también se envía', () => {
      service.getEventos(3, { modulo: 0 }).subscribe();
      const peticion = http.expectOne((r) => r.url.endsWith('/dispositivos/3/eventos/'));
      expect(peticion.request.params.get('modulo')).toBe('0');
      peticion.flush([]);
    });
  });
});
