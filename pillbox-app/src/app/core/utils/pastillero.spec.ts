import { EventoDispositivoResponse } from '../models/api.interfaces';
import { describirEvento, describirMetodo, horaCorta, tiempoRelativo } from './pastillero';

const evento = (tipo: string, extra: Partial<EventoDispositivoResponse> = {}): EventoDispositivoResponse => ({
  id: 1, evento_id: 'x', tipo, fecha_dispositivo: '2026-10-03T15:00:00Z', fecha_recibido: '2026-10-03T15:00:01Z',
  modulo: null, id_registro: null, datos: {}, ...extra,
});

describe('describirMetodo', () => {
  it('distingue lo que hizo la persona', () => {
    expect(describirMetodo('COMPLETA')).toEqual({ texto: 'Tapa y botón', icono: 'verified', nivel: 'ok' });
    expect(describirMetodo('TAPA')?.nivel).toBe('info');
    expect(describirMetodo('APP')?.texto).toBe('Aplicación');
  });

  it('una confirmación solo con botón es un aviso', () => {
    expect(describirMetodo('BOTON')?.nivel).toBe('aviso');
  });

  it('una toma pendiente no tiene método', () => {
    expect(describirMetodo(null)).toBeNull();
    expect(describirMetodo(undefined)).toBeNull();
  });
});

describe('describirEvento', () => {
  it('antepone el módulo cuando lo hay', () => {
    expect(describirEvento(evento('tapa_cerrada', { modulo: 2 })).texto).toBe('Módulo 2 · Tapa cerrada');
    expect(describirEvento(evento('alarma_omitida')).texto).toBe('Toma omitida');
  });

  it('añade el contexto que trae el evento', () => {
    expect(describirEvento(evento('tapa_abierta', { modulo: 1, datos: { alarma_activa: true } })).texto)
      .toBe('Módulo 1 · Tapa abierta durante la alarma');
    expect(describirEvento(evento('modulo_equivocado', { modulo: 3, datos: { esperado: 1 } })).texto)
      .toBe('Módulo 3 · Se abrió el módulo equivocado (tocaba el 1)');
    expect(describirEvento(evento('toma_confirmada', { modulo: 1, datos: { metodo: 'BOTON' } })).texto)
      .toBe('Módulo 1 · Toma confirmada: solo botón, sin abrir');
  });

  it('un tipo desconocido se muestra tal cual', () => {
    expect(describirEvento(evento('nuevo_tipo'))).toEqual({ texto: 'nuevo_tipo', icono: 'info' });
  });
});

describe('tiempoRelativo', () => {
  const ahora = Date.parse('2026-10-03T15:00:00Z');

  it('usa la unidad más natural', () => {
    expect(tiempoRelativo('2026-10-03T14:59:40Z', ahora)).toBe('ahora');
    expect(tiempoRelativo('2026-10-03T14:57:00Z', ahora)).toBe('hace 3 min');
    expect(tiempoRelativo('2026-10-03T12:00:00Z', ahora)).toBe('hace 3 h');
    expect(tiempoRelativo('2026-10-01T15:00:00Z', ahora)).toBe('hace 2 d');
  });

  it('una fecha inválida no rompe la vista', () => {
    expect(tiempoRelativo('no-es-fecha', ahora)).toBe('');
  });
});

describe('horaCorta', () => {
  it('quita los segundos', () => {
    expect(horaCorta('08:00:00')).toBe('08:00');
  });
});
