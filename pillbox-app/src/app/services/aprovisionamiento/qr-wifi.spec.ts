import { parsearQrWifi } from './qr-wifi';

describe('parsearQrWifi', () => {
  it('lee el QR que genera Android al compartir una red', () => {
    expect(parsearQrWifi('WIFI:S:Casa de Luis;T:WPA;P:clave secreta;H:false;;')).toEqual({
      ssid: 'Casa de Luis',
      password: 'clave secreta',
    });
  });

  it('acepta los campos en cualquier orden y en minúsculas el prefijo', () => {
    expect(parsearQrWifi('wifi:T:WPA;P:12345678;S:MiRed;;')).toEqual({ ssid: 'MiRed', password: '12345678' });
  });

  it('respeta los caracteres escapados', () => {
    expect(parsearQrWifi('WIFI:T:WPA;S:Red\\;con\\:raros\\\\;P:a\\,b\\;c\\"d;;')).toEqual({
      ssid: 'Red;con:raros\\',
      password: 'a,b;c"d',
    });
  });

  it('una red abierta no trae contraseña', () => {
    expect(parsearQrWifi('WIFI:T:nopass;S:Cafetería;;')).toEqual({ ssid: 'Cafetería', password: '' });
  });

  it('rechaza lo que no es un QR de Wi‑Fi o no trae nombre', () => {
    expect(parsearQrWifi('pastillero://v1?id=x')).toBeNull();
    expect(parsearQrWifi('https://ejemplo.com')).toBeNull();
    expect(parsearQrWifi('WIFI:T:WPA;P:12345678;;')).toBeNull();
  });
});
