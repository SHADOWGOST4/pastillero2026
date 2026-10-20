import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ESP_PROVISIONING, EspProvisioningPlugin } from './esp-provisioning.plugin';
import {
  AprovisionamientoError,
  ErrorAprovisionamiento,
  PasoAprovisionamiento,
  ProvisioningService,
  RedTelefono,
  RedWifi,
  SolicitudAprovisionamiento,
  ordenarRedes,
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
          if (!cancelado) subscriber.error(traducirError(err));
        });
      return () => {
        cancelado = true;
        escucha.then((h) => h.remove());
      };
    });
  }

  async escanearRedes(nombreBle: string, pop: string): Promise<RedWifi[]> {
    try {
      const { redes } = await this.plugin.scanNetworks({ nombreBle, pop });
      return ordenarRedes(redes ?? []);
    } catch (err) {
      throw traducirError(err as { code?: string; message?: string });
    }
  }

  async redDelTelefono(): Promise<RedTelefono | null> {
    try {
      const { ssid, frecuenciaMhz } = await this.plugin.currentNetwork();
      return ssid ? { ssid, frecuenciaMhz: frecuenciaMhz ?? 0 } : null;
    } catch {
      return null;
    }
  }
}

function traducirError(err: { code?: string; message?: string }): AprovisionamientoError {
  const tipo = ERRORES.find((e) => e === err?.code) ?? 'desconocido';
  return new AprovisionamientoError(tipo, err?.message);
}
