export interface QrWifi {
  ssid: string;
  password: string;
}

/**
 * Lee el QR estándar de una red Wi‑Fi (`WIFI:T:WPA;S:<red>;P:<clave>;H:false;;`), el que muestran
 * Android al compartir una red y muchas pegatinas de router. Los valores escapan `\`, `;`, `,`, `:` y `"`
 * con barra invertida. Devuelve null si el texto no es un QR de Wi‑Fi.
 */
export function parsearQrWifi(texto: string): QrWifi | null {
  if (!/^WIFI:/i.test(texto)) return null;
  const campos = new Map<string, string>();
  let clave = '';
  let valor = '';
  let enValor = false;
  const cuerpo = texto.slice(5);
  for (let i = 0; i < cuerpo.length; i++) {
    const c = cuerpo[i];
    if (c === '\\' && i + 1 < cuerpo.length) {
      const escapado = cuerpo[++i];
      if (enValor) valor += escapado;
      else clave += escapado;
    } else if (!enValor && c === ':') {
      enValor = true;
    } else if (c === ';') {
      if (clave) campos.set(clave.toUpperCase(), valor);
      clave = '';
      valor = '';
      enValor = false;
    } else if (enValor) {
      valor += c;
    } else {
      clave += c;
    }
  }
  if (clave) campos.set(clave.toUpperCase(), valor);
  const ssid = campos.get('S') ?? '';
  if (!ssid) return null;
  return { ssid, password: campos.get('P') ?? '' };
}
