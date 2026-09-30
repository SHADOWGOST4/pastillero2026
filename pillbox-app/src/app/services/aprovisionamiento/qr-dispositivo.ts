export interface QrDispositivo {
  deviceId: string;
  nombreBle: string;
  pop: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Formato del QR de cada placa: `pastillero://v1?id=<uuid>&ble=<nombre>&pop=<secreto>`.
 * Devuelve null si el texto no es un QR válido de pastillero.
 */
export function parsearQrDispositivo(texto: string): QrDispositivo | null {
  let url: URL;
  try {
    url = new URL(texto.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'pastillero:') return null;
  const deviceId = url.searchParams.get('id') ?? '';
  const nombreBle = url.searchParams.get('ble') ?? '';
  const pop = url.searchParams.get('pop') ?? '';
  if (!UUID.test(deviceId) || !nombreBle || !pop) return null;
  return { deviceId: deviceId.toLowerCase(), nombreBle, pop };
}
