import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EventoDispositivoResponse } from '../../../core/models/api.interfaces';
import { ActividadDispositivo } from './actividad-dispositivo';

const evento = (tipo: string, extra: Partial<EventoDispositivoResponse> = {}): EventoDispositivoResponse => ({
  id: Math.random(), evento_id: 'x', tipo, fecha_dispositivo: new Date(Date.now() - 180_000).toISOString(),
  fecha_recibido: new Date().toISOString(), modulo: 1, id_registro: null, datos: {}, ...extra,
});

describe('ActividadDispositivo', () => {
  let fixture: ComponentFixture<ActividadDispositivo>;
  let component: ActividadDispositivo;
  const el = () => fixture.nativeElement as HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ActividadDispositivo] }).compileComponents();
    fixture = TestBed.createComponent(ActividadDispositivo);
    component = fixture.componentInstance;
  });

  it('sin eventos explica cuándo aparecerá la actividad', () => {
    fixture.detectChanges();
    expect(el().textContent).toContain('Aún no hay actividad');
    expect(el().querySelector('ul')).toBeNull();
  });

  it('mientras carga por primera vez lo dice', () => {
    component.cargando = true;
    fixture.detectChanges();
    expect(el().textContent).toContain('Consultando la actividad');
    expect(el().textContent).not.toContain('Aún no hay actividad');
  });

  it('lista cada evento con su texto y cuándo ocurrió', () => {
    component.eventos = [evento('tapa_abierta', { modulo: 2, datos: { alarma_activa: true } }), evento('modulo_conectado')];
    fixture.detectChanges();
    const filas = el().querySelectorAll('li');
    expect(filas.length).toBe(2);
    expect(filas[0].textContent).toContain('Módulo 2 · Tapa abierta durante la alarma');
    expect(filas[0].textContent).toContain('hace 3 min');
    expect(filas[1].textContent).toContain('Módulo 1 · Módulo conectado');
  });

  it('resalta lo que merece atención', () => {
    component.eventos = [evento('modulo_equivocado'), evento('tapa_cerrada'), evento('alarma_omitida')];
    fixture.detectChanges();
    const filas = Array.from(el().querySelectorAll('li'));
    expect(filas.map((f) => f.classList.contains('es-aviso'))).toEqual([true, false, true]);
  });
});
