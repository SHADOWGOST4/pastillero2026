import { InjectionToken } from '@angular/core';
import { PluginListenerHandle, registerPlugin } from '@capacitor/core';
import { RedTelefono, RedWifi, SolicitudAprovisionamiento } from './provisioning.service';

export interface EspProvisioningPlugin {
  /** Resuelve cuando el ESP32 confirma la configuración. Rechaza con `code` = ErrorAprovisionamiento. */
  provision(solicitud: SolicitudAprovisionamiento): Promise<void>;
  /** Redes que ve el ESP32, sin filtrar. Una llamada a `provision` en curso la cancela (code "cancelado"). */
  scanNetworks(opciones: { nombreBle: string; pop: string }): Promise<{ redes: RedWifi[] }>;
  /** Pide permiso de ubicación si hace falta. Resuelve {} si no se puede saber; nunca rechaza. */
  currentNetwork(): Promise<Partial<RedTelefono>>;
  /** Selector de imágenes del sistema: {uri} content://, o {} si se cancela. */
  pickImage(): Promise<{ uri?: string }>;
  addListener(evento: 'paso', escuchar: (datos: { paso: string }) => void): Promise<PluginListenerHandle>;
}

/** Implementación nativa: plugins/capacitor-esp-provisioning (solo Android). */
export const ESP_PROVISIONING = new InjectionToken<EspProvisioningPlugin>('EspProvisioningPlugin', {
  providedIn: 'root',
  factory: () => registerPlugin<EspProvisioningPlugin>('EspProvisioning'),
});
