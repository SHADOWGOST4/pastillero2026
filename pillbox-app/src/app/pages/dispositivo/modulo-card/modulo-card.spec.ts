import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HorarioResponse, ModuloResponse } from '../../../core/models/api.interfaces';
import { ModuloCard } from './modulo-card';

const modulo = (extra: Partial<ModuloResponse> = {}): ModuloResponse => ({
  id: 1, id_dispositivo: 3, dispositivo_nombre: 'Mi pastillero', numero_modulo: 2, id_medicamento: null,
  medicamento_nombre: null, detectado: true, ultimo_visto: null, tapa_abierta: null, ...extra,
});

const horario = (id_medicamento: number, hora_toma: string, extra: Partial<HorarioResponse> = {}) =>
  ({ id: Math.random(), id_medicamento, hora_toma, activo: true, eliminado: false, ...extra }) as unknown as HorarioResponse;

describe('ModuloCard', () => {
  let fixture: ComponentFixture<ModuloCard>;
  let component: ModuloCard;
  const texto = () => (fixture.nativeElement as HTMLElement).textContent ?? '';
  const boton = (etiqueta: string) =>
    Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button')).find((b) => b.textContent?.includes(etiqueta));

  function mostrar(m: ModuloResponse, horarios: HorarioResponse[] = []): void {
    component.modulo = m;
    component.horarios = horarios;
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ModuloCard] }).compileComponents();
    fixture = TestBed.createComponent(ModuloCard);
    component = fixture.componentInstance;
  });

  it('muestra el número y si la placa lo ve conectado', () => {
    mostrar(modulo());
    expect(texto()).toContain('Módulo 2');
    expect(texto()).toContain('Conectado');
    expect((fixture.nativeElement as HTMLElement).querySelector('.module-offline')).toBeNull();
  });

  it('un módulo que la placa ya no ve aparece sin conexión y atenuado', () => {
    mostrar(modulo({ detectado: false, tapa_abierta: null }));
    expect(texto()).toContain('Sin conexión');
    expect((fixture.nativeElement as HTMLElement).querySelector('.module-offline')).not.toBeNull();
  });

  it('muestra el estado de la tapa solo si el módulo está conectado y lo informa', () => {
    mostrar(modulo({ tapa_abierta: false }));
    expect(texto()).toContain('Tapa cerrada');
    mostrar(modulo({ tapa_abierta: true }));
    expect(texto()).toContain('Tapa abierta');
    mostrar(modulo({ tapa_abierta: null }));
    expect(component.textoTapa).toBeNull();
    mostrar(modulo({ detectado: false, tapa_abierta: true }));
    expect(component.textoTapa).toBeNull();
  });

  it('sin medicamento ofrece asignar y no muestra horarios', () => {
    mostrar(modulo());
    expect(texto()).toContain('Sin medicamento asignado');
    expect(boton('Asignar')).toBeTruthy();
    expect(boton('Desasignar')).toBeUndefined();
    expect(texto()).not.toContain('Sin horarios');
  });

  it('con medicamento muestra sus horarios activos ordenados', () => {
    const horarios = [
      horario(7, '16:00:00'), horario(7, '08:00:00'), horario(7, '12:00:00', { activo: false }),
      horario(7, '20:00:00', { eliminado: true }), horario(9, '09:00:00'),
    ];
    mostrar(modulo({ id_medicamento: 7, medicamento_nombre: 'Ibuprofeno' }), horarios);
    expect(texto()).toContain('Ibuprofeno');
    expect(texto()).toContain('08:00 · 16:00');
    expect(texto()).not.toContain('09:00');
    expect(boton('Desasignar')).toBeTruthy();
  });

  it('avisa si el medicamento no tiene horarios', () => {
    mostrar(modulo({ id_medicamento: 7, medicamento_nombre: 'Ibuprofeno' }), [horario(9, '09:00:00')]);
    expect(texto()).toContain('Sin horarios');
  });

  it('emite el módulo al pulsar asignar o desasignar', () => {
    const emitidos: string[] = [];
    component.asignar.subscribe((m) => emitidos.push(`asignar ${m.numero_modulo}`));
    component.desasignar.subscribe((m) => emitidos.push(`desasignar ${m.numero_modulo}`));
    mostrar(modulo());
    boton('Asignar')!.click();
    mostrar(modulo({ id_medicamento: 7, medicamento_nombre: 'X' }));
    boton('Desasignar')!.click();
    expect(emitidos).toEqual(['asignar 2', 'desasignar 2']);
  });
});
