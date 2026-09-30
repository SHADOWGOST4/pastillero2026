import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ESP_PROVISIONING, EspProvisioningPlugin } from './esp-provisioning.plugin';
import {
  AprovisionamientoError,
  ErrorAprovisionamiento,
  PasoAprovisionamiento,
  ProvisioningService,
  SolicitudAprovisionamiento,
} from './provisioning.service';

const ERRORES: ErrorAprovisionamiento[] = [
  'no-encontrado',
  'pop-invalido',
  'wifi',
  'permisos',
  'bluetooth-apagado',
  'desconocido',
];

@Injectable()
export class ProvisioningNativoService extends ProvisioningService {
  constructor(@Inject(ESP_PROVISIONING) private plugin: EspProvisioningPlugin) {
    super();
  }

  aprovisionar(solicitud: SolicitudAprovisionamiento): Observable<PasoAprovisionamiento> {
    return new Observable((subscriber) => {
      let cancelado = false;
      const escucha = this.plugin.addListener('paso', ({ paso }) => subscriber.next(paso as PasoAprovisionamiento));
      escucha
        .then(() => this.plugin.provision(solicitud))
        .then(() => subscriber.complete())
        .catch((err: { code?: string; message?: string }) => {
          if (cancelado) return;
          const tipo = ERRORES.find((e) => e === err?.code) ?? 'desconocido';
          subscriber.error(new AprovisionamientoError(tipo, err?.message));
        });
      return () => {
        cancelado = true;
        escucha.then((h) => h.remove());
      };
    });
  }
}
