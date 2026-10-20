import { Inject, Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { ESP_PROVISIONING, EspProvisioningPlugin } from './esp-provisioning.plugin';

@Injectable({ providedIn: 'root' })
export class EscanerQrService {
  constructor(@Inject(ESP_PROVISIONING) private plugin: EspProvisioningPlugin) {}

  get disponible(): boolean {
    return Capacitor.isNativePlatform();
  }

  /** Abre la cámara y devuelve el texto del primer QR leído, o null si el usuario cancela. */
  async escanear(): Promise<string | null> {
    const { BarcodeScanner, BarcodeFormat } = await import('@capacitor-mlkit/barcode-scanning');
    const permisos = await BarcodeScanner.requestPermissions();
    if (permisos.camera !== 'granted' && permisos.camera !== 'limited') {
      throw new Error('permiso-camara');
    }
    const { barcodes } = await BarcodeScanner.scan({ formats: [BarcodeFormat.QrCode] });
    return barcodes[0]?.rawValue ?? null;
  }

  /**
   * Deja elegir una imagen (p. ej. una captura de «Compartir» Wi‑Fi) y devuelve el texto de su QR;
   * null si el usuario cancela y '' si la imagen no tiene ningún QR.
   */
  async leerDeImagen(): Promise<string | null> {
    const { uri } = await this.plugin.pickImage();
    if (!uri) return null;
    const { BarcodeScanner, BarcodeFormat } = await import('@capacitor-mlkit/barcode-scanning');
    const { barcodes } = await BarcodeScanner.readBarcodesFromImage({ path: uri, formats: [BarcodeFormat.QrCode] });
    return barcodes[0]?.rawValue ?? '';
  }
}
