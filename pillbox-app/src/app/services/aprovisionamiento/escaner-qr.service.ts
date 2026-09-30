import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';

@Injectable({ providedIn: 'root' })
export class EscanerQrService {
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
}
