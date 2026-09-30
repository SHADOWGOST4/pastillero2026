import { Injectable } from '@angular/core';
import { Observable, concat, of, throwError } from 'rxjs';
import { delay } from 'rxjs/operators';
import {
  AprovisionamientoError,
  PasoAprovisionamiento,
  ProvisioningService,
  SolicitudAprovisionamiento,
} from './provisioning.service';

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
}
