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
}
