import { parsearQrDispositivo } from './qr-dispositivo';

describe('parsearQrDispositivo', () => {
  const id = '4397a840-1b2c-4d3e-8f90-a1b2c3d4e5f6';

  it('lee un QR válido', () => {
    expect(parsearQrDispositivo(`pastillero://v1?id=${id}&ble=PASTILLERO-4397A840&pop=abc123`)).toEqual({
      deviceId: id,
      nombreBle: 'PASTILLERO-4397A840',
      pop: 'abc123',
    });
  });

  it('normaliza el UUID a minúsculas', () => {
    const qr = parsearQrDispositivo(`pastillero://v1?id=${id.toUpperCase()}&ble=P&pop=x`);
    expect(qr?.deviceId).toBe(id);
  });

  it('rechaza textos que no son de un pastillero', () => {
    expect(parsearQrDispositivo('https://ejemplo.com')).toBeNull();
    expect(parsearQrDispositivo('hola')).toBeNull();
    expect(parsearQrDispositivo(`pastillero://v1?id=no-uuid&ble=P&pop=x`)).toBeNull();
    expect(parsearQrDispositivo(`pastillero://v1?id=${id}&ble=P`)).toBeNull();
    expect(parsearQrDispositivo(`pastillero://v1?id=${id}&pop=x`)).toBeNull();
  });
});
