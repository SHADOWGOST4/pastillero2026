import { PluginListenerHandle } from '@capacitor/core';
import { EspProvisioningPlugin } from './esp-provisioning.plugin';
import { ProvisioningNativoService } from './provisioning-nativo.service';
import { AprovisionamientoError, PasoAprovisionamiento, SolicitudAprovisionamiento } from './provisioning.service';

const SOLICITUD: SolicitudAprovisionamiento = {
  nombreBle: 'PASTILLERO-1', pop: 'p', ssid: 's', password: '12345678',
  deviceId: 'd', enrollmentCode: 'c', apiUrl: 'https://x/api/iot',
};

describe('ProvisioningNativoService', () => {
  let remover: jasmine.Spy;
  let escuchar: (datos: { paso: string }) => void;
  let plugin: jasmine.SpyObj<EspProvisioningPlugin>;
  let servicio: ProvisioningNativoService;

  beforeEach(() => {
    remover = jasmine.createSpy('remove').and.resolveTo();
    plugin = jasmine.createSpyObj('plugin', ['provision', 'addListener', 'scanNetworks', 'currentNetwork']);
    plugin.addListener.and.callFake(async (_e, fn) => {
      escuchar = fn;
      return { remove: remover } as unknown as PluginListenerHandle;
    });
    servicio = new ProvisioningNativoService(plugin);
  });

  it('emite los pasos y completa cuando el plugin resuelve', async () => {
    let terminar!: () => void;
    plugin.provision.and.returnValue(new Promise<void>((r) => (terminar = r)));
    const pasos: PasoAprovisionamiento[] = [];
    const completado = new Promise<void>((ok) => servicio.aprovisionar(SOLICITUD).subscribe({ next: (p) => pasos.push(p), complete: ok }));
    await Promise.resolve();
    await Promise.resolve();
    escuchar({ paso: 'buscando' });
    escuchar({ paso: 'wifi' });
    terminar();
    await completado;
    expect(pasos).toEqual(['buscando', 'wifi']);
    expect(plugin.provision).toHaveBeenCalledWith(SOLICITUD);
  });

  it('traduce el código de rechazo a AprovisionamientoError', async () => {
    plugin.provision.and.rejectWith({ code: 'pop-invalido', message: 'x' });
    const error = await new Promise<unknown>((ok) => servicio.aprovisionar(SOLICITUD).subscribe({ error: ok }));
    expect(error instanceof AprovisionamientoError && error.tipo).toBe('pop-invalido');
  });

  it('un código desconocido se vuelve "desconocido"', async () => {
    plugin.provision.and.rejectWith({ code: 'raro' });
    const error = await new Promise<unknown>((ok) => servicio.aprovisionar(SOLICITUD).subscribe({ error: ok }));
    expect(error instanceof AprovisionamientoError && error.tipo).toBe('desconocido');
  });

  it('escanea redes: quita ocultas y repetidas y ordena por señal', async () => {
    plugin.scanNetworks.and.resolveTo({
      redes: [
        { ssid: 'Vecino', rssi: -80, segura: true },
        { ssid: '', rssi: -30, segura: true },
        { ssid: 'Casa de Luis', rssi: -60, segura: true },
        { ssid: 'Vecino', rssi: -55, segura: true },
      ],
    });
    const redes = await servicio.escanearRedes('PASTILLERO-1', 'p');
    expect(plugin.scanNetworks).toHaveBeenCalledWith({ nombreBle: 'PASTILLERO-1', pop: 'p' });
    expect(redes.map((r) => [r.ssid, r.rssi])).toEqual([['Vecino', -55], ['Casa de Luis', -60]]);
  });

  it('un fallo al escanear redes se vuelve AprovisionamientoError', async () => {
    plugin.scanNetworks.and.rejectWith({ code: 'bluetooth-apagado' });
    const error = await servicio.escanearRedes('PASTILLERO-1', 'p').catch((e) => e);
    expect(error instanceof AprovisionamientoError && error.tipo).toBe('bluetooth-apagado');
  });

  it('devuelve la red del teléfono, o null si no se puede saber', async () => {
    plugin.currentNetwork.and.resolveTo({ ssid: 'Casa de Luis', frecuenciaMhz: 2437 });
    expect(await servicio.redDelTelefono()).toEqual({ ssid: 'Casa de Luis', frecuenciaMhz: 2437 });
    plugin.currentNetwork.and.resolveTo({});
    expect(await servicio.redDelTelefono()).toBeNull();
    plugin.currentNetwork.and.rejectWith(new Error('sin plugin'));
    expect(await servicio.redDelTelefono()).toBeNull();
  });

  it('quita el listener al desuscribirse', async () => {
    plugin.provision.and.returnValue(new Promise<void>(() => {}));
    const sub = servicio.aprovisionar(SOLICITUD).subscribe();
    await Promise.resolve();
    await Promise.resolve();
    sub.unsubscribe();
    await Promise.resolve();
    expect(remover).toHaveBeenCalled();
  });
});
