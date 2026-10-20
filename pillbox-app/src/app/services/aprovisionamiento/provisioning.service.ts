import { Observable } from 'rxjs';

export type PasoAprovisionamiento = 'buscando' | 'conectando' | 'enviando' | 'wifi';

export interface SolicitudAprovisionamiento {
  nombreBle: string;
  pop: string;
  ssid: string;
  password: string;
  deviceId: string;
  enrollmentCode: string;
  apiUrl: string;
}

/** Una red Wi‑Fi que ve el pastillero (el ESP32 solo ve las de 2,4 GHz). */
export interface RedWifi {
  ssid: string;
  rssi: number;
  segura: boolean;
}

/** La red Wi‑Fi a la que está conectado el teléfono. */
export interface RedTelefono {
  ssid: string;
  frecuenciaMhz: number;
}

/** 5 GHz o 6 GHz: el ESP32 no las ve (si el router usa el mismo nombre en 2,4 GHz, sí se conectará). */
export function esRedNo24GHz(red: RedTelefono): boolean {
  return red.frecuenciaMhz >= 4900;
}

/** Quita nombres vacíos (redes ocultas) y repetidos (varios puntos de acceso), de la señal más fuerte a la más débil. */
export function ordenarRedes(redes: RedWifi[]): RedWifi[] {
  const mejores = new Map<string, RedWifi>();
  for (const red of redes) {
    if (!red.ssid) continue;
    const previa = mejores.get(red.ssid);
    if (!previa || red.rssi > previa.rssi) mejores.set(red.ssid, red);
  }
  return [...mejores.values()].sort((a, b) => b.rssi - a.rssi);
}

export type ErrorAprovisionamiento = 'no-encontrado' | 'pop-invalido' | 'wifi' | 'permisos' | 'bluetooth-apagado' | 'desconocido';

export class AprovisionamientoError extends Error {
  constructor(
    public readonly tipo: ErrorAprovisionamiento,
    mensaje?: string,
  ) {
    super(mensaje ?? tipo);
  }
}

/**
 * Canal BLE hacia el ESP32. Emite cada paso que alcanza y completa cuando el
 * ESP32 confirma que recibió la configuración; falla con `AprovisionamientoError`.
 */
export abstract class ProvisioningService {
  abstract aprovisionar(solicitud: SolicitudAprovisionamiento): Observable<PasoAprovisionamiento>;

  /** Se conecta al pastillero, le pide las redes Wi‑Fi que ve y se desconecta. Falla con `AprovisionamientoError`. */
  abstract escanearRedes(nombreBle: string, pop: string): Promise<RedWifi[]>;

  /** La red del teléfono para proponerla; null si no se puede saber (sin Wi‑Fi, sin permiso de ubicación...). */
  abstract redDelTelefono(): Promise<RedTelefono | null>;
}
