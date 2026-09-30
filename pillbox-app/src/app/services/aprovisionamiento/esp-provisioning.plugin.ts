import { InjectionToken } from '@angular/core';
import { PluginListenerHandle, registerPlugin } from '@capacitor/core';
import { SolicitudAprovisionamiento } from './provisioning.service';

export interface EspProvisioningPlugin {
  /** Resuelve cuando el ESP32 confirma la configuración. Rechaza con `code` = ErrorAprovisionamiento. */
  provision(solicitud: SolicitudAprovisionamiento): Promise<void>;
  addListener(evento: 'paso', escuchar: (datos: { paso: string }) => void): Promise<PluginListenerHandle>;
}

/** Implementación nativa: plugins/capacitor-esp-provisioning (solo Android). */
export const ESP_PROVISIONING = new InjectionToken<EspProvisioningPlugin>('EspProvisioningPlugin', {
  providedIn: 'root',
  factory: () => registerPlugin<EspProvisioningPlugin>('EspProvisioning'),
});
