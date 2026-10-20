import { Injectable } from '@angular/core';
import { Observable, concat, of, throwError } from 'rxjs';
import { delay } from 'rxjs/operators';
import {
  AprovisionamientoError,
  PasoAprovisionamiento,
  ProvisioningService,
  RedTelefono,
  RedWifi,
  SolicitudAprovisionamiento,
} from './provisioning.service';

const REDES_SIMULADAS: RedWifi[] = [
  { ssid: 'Casa de Luis 2.4G', rssi: -48, segura: true },
  { ssid: 'Vecino', rssi: -71, segura: true },
  { ssid: 'Cafetería libre', rssi: -83, segura: false },
];

/** Simula el BLE mientras no exista el plugin nativo ni hardware. Contraseña "fallo" fuerza error de Wi-Fi. */
@Injectable()
export class ProvisioningSimuladoService extends ProvisioningService {
  aprovisionar(solicitud: SolicitudAprovisionamiento): Observable<PasoAprovisionamiento> {
    const pasos: PasoAprovisionamiento[] = ['buscando', 'conectando', 'enviando', 'wifi'];
    const avance = pasos.map((paso) => of(paso).pipe(delay(700)));
    if (solicitud.password === 'fallo') {
      return concat(...avance.slice(0, 3), throwError(() => new AprovisionamientoError('wifi')).pipe(delay(700)));
    }
    return concat(...avance);
  }

  escanearRedes(): Promise<RedWifi[]> {
    return new Promise((ok) => setTimeout(() => ok(REDES_SIMULADAS), 1200));
  }

  redDelTelefono(): Promise<RedTelefono | null> {
    return Promise.resolve({ ssid: REDES_SIMULADAS[0].ssid, frecuenciaMhz: 2437 });
  }
}
