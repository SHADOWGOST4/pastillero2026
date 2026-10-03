import { EventoDispositivoResponse, MetodoConfirmacion } from '../models/api.interfaces';

export type NivelMetodo = 'ok' | 'info' | 'aviso';

export interface DescripcionMetodo {
  texto: string;
  icono: string;
  nivel: NivelMetodo;
}

const METODOS: Record<MetodoConfirmacion, DescripcionMetodo> = {
  COMPLETA: { texto: 'Tapa y botón', icono: 'verified', nivel: 'ok' },
  TAPA: { texto: 'Solo tapa', icono: 'door_front', nivel: 'info' },
  // Confirmó sin abrir el módulo: puede que no tomara la pastilla.
  BOTON: { texto: 'Solo botón, sin abrir', icono: 'warning_amber', nivel: 'aviso' },
  DISPOSITIVO: { texto: 'Pastillero', icono: 'devices', nivel: 'info' },
  APP: { texto: 'Aplicación', icono: 'smartphone', nivel: 'info' },
};

/** Cómo se confirmó una toma; null mientras sigue pendiente. */
export function describirMetodo(metodo: MetodoConfirmacion | null | undefined): DescripcionMetodo | null {
  return metodo ? (METODOS[metodo] ?? null) : null;
}

interface DescripcionEvento {
  texto: string;
  icono: string;
}

const EVENTOS: Record<string, DescripcionEvento> = {
  tapa_abierta: { texto: 'Tapa abierta', icono: 'lock_open' },
  tapa_cerrada: { texto: 'Tapa cerrada', icono: 'lock' },
  boton_pulsado: { texto: 'Botón pulsado', icono: 'touch_app' },
  alarma_iniciada: { texto: 'Alarma activada', icono: 'notifications_active' },
  alarma_omitida: { texto: 'Toma omitida', icono: 'notifications_off' },
  modulo_equivocado: { texto: 'Se abrió el módulo equivocado', icono: 'error_outline' },
  modulo_conectado: { texto: 'Módulo conectado', icono: 'sensors' },
  modulo_desconectado: { texto: 'Módulo desconectado', icono: 'sensors_off' },
  toma_confirmada: { texto: 'Toma confirmada', icono: 'check_circle' },
};

/** Frase corta de un evento de la placa, con el módulo al que se refiere. */
export function describirEvento(evento: EventoDispositivoResponse): DescripcionEvento {
  const base = EVENTOS[evento.tipo] ?? { texto: evento.tipo, icono: 'info' };
  let texto = base.texto;
  if (evento.tipo === 'tapa_abierta' && evento.datos?.['alarma_activa'] === true) texto += ' durante la alarma';
  if (evento.tipo === 'modulo_equivocado' && typeof evento.datos?.['esperado'] === 'number') {
    texto += ` (tocaba el ${evento.datos['esperado']})`;
  }
  if (evento.tipo === 'toma_confirmada') {
    const metodo = describirMetodo(evento.datos?.['metodo'] as MetodoConfirmacion | undefined);
    if (metodo) texto += `: ${metodo.texto.toLowerCase()}`;
  }
  return { texto: evento.modulo ? `Módulo ${evento.modulo} · ${texto}` : texto, icono: base.icono };
}

/** "hace 3 min", "hace 2 h"... para mostrar cuándo ocurrió algo. */
export function tiempoRelativo(iso: string, ahora: number = Date.now()): string {
  const minutos = Math.floor((ahora - Date.parse(iso)) / 60_000);
  if (Number.isNaN(minutos)) return '';
  if (minutos < 1) return 'ahora';
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;
  return `hace ${Math.floor(horas / 24)} d`;
}

/** "08:00:00" -> "08:00". */
export function horaCorta(hora: string): string {
  return hora.slice(0, 5);
}
