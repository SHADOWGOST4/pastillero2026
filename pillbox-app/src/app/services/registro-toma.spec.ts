import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Capacitor } from '@capacitor/core';
import { ALARMA_MEDICACION, AlarmaMedicacionPlugin } from './alarma-medicacion/alarma-medicacion.plugin';
import { RegistroToma } from './registro-toma';

describe('RegistroToma.confirmar', () => {
  let plugin: jasmine.SpyObj<AlarmaMedicacionPlugin>;
  let http: HttpTestingController;
  let servicio: RegistroToma;

  function crear(plataforma: string): void {
    spyOn(Capacitor, 'getPlatform').and.returnValue(plataforma);
    plugin = jasmine.createSpyObj<AlarmaMedicacionPlugin>('AlarmaMedicacion', ['detenerPorToma']);
    plugin.detenerPorToma.and.resolveTo();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: ALARMA_MEDICACION, useValue: plugin }],
    });
    servicio = TestBed.inject(RegistroToma);
    http = TestBed.inject(HttpTestingController);
  }

  const respuesta = { id: 50, fecha_hora_programada: '2026-10-03T13:00:00.000Z', fecha_hora_real: '2026-10-03T13:00:20Z', id_horario: 15, id_usuario: 1 };

  it('en Android apaga la alarma nativa de la toma que se acaba de confirmar', async () => {
    crear('android');
    servicio.confirmar(50, '2026-10-03T13:00:20Z').subscribe();
    const peticion = http.expectOne((r) => r.url.endsWith('/registros/50/'));
    expect(peticion.request.method).toBe('PATCH');
    expect(peticion.request.body).toEqual({ fecha_hora_real: '2026-10-03T13:00:20Z' });
    peticion.flush(respuesta);
    await Promise.resolve();
    expect(plugin.detenerPorToma).toHaveBeenCalledOnceWith({ horarioId: 15, instanteMs: Date.parse('2026-10-03T13:00:00.000Z') });
    http.verify();
  });

  it('fuera de Android no usa el plugin', () => {
    crear('web');
    servicio.confirmar(50).subscribe();
    http.expectOne((r) => r.url.endsWith('/registros/50/')).flush(respuesta);
    expect(plugin.detenerPorToma).not.toHaveBeenCalled();
    http.verify();
  });

  it('si la confirmación falla, la alarma sigue sonando', () => {
    crear('android');
    servicio.confirmar(50).subscribe({ error: () => undefined });
    http.expectOne((r) => r.url.endsWith('/registros/50/')).flush({ detail: 'x' }, { status: 500, statusText: 'Error' });
    expect(plugin.detenerPorToma).not.toHaveBeenCalled();
    http.verify();
  });
});
