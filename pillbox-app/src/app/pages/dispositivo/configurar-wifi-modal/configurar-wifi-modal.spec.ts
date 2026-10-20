import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EscanerQrService } from '../../../services/aprovisionamiento/escaner-qr.service';
import { RedTelefono, RedWifi } from '../../../services/aprovisionamiento/provisioning.service';
import { ConfigurarWifiModal, CredencialesWifi } from './configurar-wifi-modal';

const REDES: RedWifi[] = [
  { ssid: 'Casa de Luis ', rssi: -50, segura: true },
  { ssid: 'Cafetería', rssi: -85, segura: false },
];

describe('ConfigurarWifiModal', () => {
  let component: ConfigurarWifiModal;
  let fixture: ComponentFixture<ConfigurarWifiModal>;
  let escaner: { disponible: boolean; escanear: jasmine.Spy; leerDeImagen: jasmine.Spy };

  beforeEach(async () => {
    escaner = {
      disponible: true,
      escanear: jasmine.createSpy('escanear').and.resolveTo(null),
      leerDeImagen: jasmine.createSpy('leerDeImagen').and.resolveTo(null),
    };
    await TestBed.configureTestingModule({
      imports: [ConfigurarWifiModal],
      providers: [{ provide: EscanerQrService, useValue: escaner }],
    }).compileComponents();
    fixture = TestBed.createComponent(ConfigurarWifiModal);
    component = fixture.componentInstance;
  });

  function abrir(ssidInicial = ''): void {
    component.ssidInicial = ssidInicial;
    component.visible = true;
    component.ngOnChanges({ visible: { currentValue: true, previousValue: false, firstChange: false, isFirstChange: () => false } });
    fixture.detectChanges();
  }

  it('no se dibuja mientras está cerrado', () => {
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('.wifi-modal')).toBeNull();
  });

  it('al abrir limpia la contraseña y precarga la red anterior', () => {
    component.password = 'vieja-clave';
    abrir('MiRed');
    expect(component.ssid).toBe('MiRed');
    expect(component.password).toBe('');
  });

  it('emite la red sin espacios sobrantes', () => {
    const enviados: CredencialesWifi[] = [];
    component.submitted.subscribe((w) => enviados.push(w));
    abrir();
    component.ssid = '  MiRed  ';
    component.password = '12345678';
    component.conectar();
    expect(enviados).toEqual([{ ssid: 'MiRed', password: '12345678' }]);
  });

  it('conserva los espacios y mayúsculas internos del nombre de la red', () => {
    const enviados: CredencialesWifi[] = [];
    component.submitted.subscribe((w) => enviados.push(w));
    abrir();
    component.ssid = 'Casa de  Luis 2.4G';
    component.password = 'clave con espacios';
    component.conectar();
    expect(enviados).toEqual([{ ssid: 'Casa de  Luis 2.4G', password: 'clave con espacios' }]);
  });

  it('desactiva el autocorrector del teclado en la red y la contraseña', () => {
    abrir();
    for (const id of ['#wifi-ssid', '#wifi-password']) {
      const campo = (fixture.nativeElement as HTMLElement).querySelector(id) as HTMLInputElement;
      expect(campo.getAttribute('autocapitalize')).toBe('none');
      expect(campo.getAttribute('autocorrect')).toBe('off');
      expect(campo.getAttribute('spellcheck')).toBe('false');
    }
  });

  it('no emite con la red vacía ni con contraseña corta', () => {
    const enviados: CredencialesWifi[] = [];
    component.submitted.subscribe((w) => enviados.push(w));
    abrir();
    component.ssid = '   ';
    component.password = '12345678';
    component.conectar();
    component.ssid = 'MiRed';
    component.password = '123';
    component.conectar();
    expect(enviados).toEqual([]);
    expect(component.intentado).toBeTrue();
  });

  it('muestra los errores solo después de intentar enviar', () => {
    abrir();
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('al menos 8 caracteres');
    component.conectar();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Escribe el nombre de la red.');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('al menos 8 caracteres');
  });

  it('cierra con el botón Cancelar y con Escape', () => {
    let cierres = 0;
    component.closed.subscribe(() => cierres++);
    abrir();
    const cancelar = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Cancelar'),
    );
    cancelar!.click();
    component.onEscape();
    expect(cierres).toBe(2);
  });

  describe('redes cercanas', () => {
    const el = () => fixture.nativeElement as HTMLElement;
    const redesEnPantalla = () => Array.from(el().querySelectorAll('.red')) as HTMLButtonElement[];

    it('sin lista pedida solo muestra el campo para escribir', () => {
      abrir();
      expect(el().querySelector('.redes')).toBeNull();
      expect(el().textContent).toContain('Nombre de la red');
    });

    it('mientras busca muestra que está buscando', () => {
      component.buscandoRedes = true;
      abrir();
      expect(el().textContent).toContain('Buscando redes cercanas');
      expect(redesEnPantalla().length).toBe(0);
    });

    it('muestra las redes con candado solo en las que tienen contraseña', () => {
      component.redes = REDES;
      abrir();
      const redes = redesEnPantalla();
      expect(redes.map((b) => b.querySelector('.red-nombre')!.textContent)).toEqual(['Casa de Luis ', 'Cafetería']);
      expect(redes[0].querySelector('.red-candado')).not.toBeNull();
      expect(redes[1].querySelector('.red-candado')).toBeNull();
      expect(el().textContent).toContain('O escribe el nombre de la red');
    });

    it('elegir una red la pone en el campo y se envía exacta, sin recortar espacios', () => {
      const enviados: CredencialesWifi[] = [];
      component.submitted.subscribe((w) => enviados.push(w));
      component.redes = REDES;
      abrir();
      redesEnPantalla()[0].click();
      fixture.detectChanges();
      expect(component.ssid).toBe('Casa de Luis ');
      expect(redesEnPantalla()[0].classList).toContain('seleccionada');
      component.password = '12345678';
      component.conectar();
      expect(enviados).toEqual([{ ssid: 'Casa de Luis ', password: '12345678' }]);
    });

    it('si se edita a mano tras elegir, vuelve a recortar los extremos', () => {
      const enviados: CredencialesWifi[] = [];
      component.submitted.subscribe((w) => enviados.push(w));
      component.redes = REDES;
      abrir();
      component.elegirRed(REDES[1]);
      component.ssid = ' Otra red ';
      component.password = '12345678';
      component.conectar();
      expect(enviados[0].ssid).toBe('Otra red');
    });

    it('sin redes o con error invita a escribir el nombre', () => {
      component.redes = [];
      abrir();
      expect(el().textContent).toContain('no encontró redes de 2,4 GHz');
      component.errorRedes = true;
      fixture.detectChanges();
      expect(el().textContent).toContain('No se pudieron cargar las redes');
      expect(el().textContent).toContain('Escribe el nombre abajo');
    });

    it('"Actualizar" pide buscar de nuevo', () => {
      let pedidas = 0;
      component.buscarRedes.subscribe(() => pedidas++);
      component.redes = REDES;
      abrir();
      Array.from(el().querySelectorAll('button')).find((b) => b.textContent?.includes('Actualizar'))!.click();
      expect(pedidas).toBe(1);
    });

    it('el icono refleja la intensidad de la señal', () => {
      expect(component.iconoSenal(-40)).toBe('signal_wifi_4_bar');
      expect(component.iconoSenal(-60)).toBe('network_wifi_3_bar');
      expect(component.iconoSenal(-75)).toBe('network_wifi_2_bar');
      expect(component.iconoSenal(-90)).toBe('network_wifi_1_bar');
    });
  });

  describe('red del teléfono', () => {
    const el = () => fixture.nativeElement as HTMLElement;
    const red = (ssid: string, frecuenciaMhz = 2437): RedTelefono => ({ ssid, frecuenciaMhz });

    it('rellena el nombre si el campo está vacío, también si llega con el modal abierto', () => {
      abrir();
      expect(component.ssid).toBe('');
      component.redTelefono = red('Casa de Luis');
      component.ngOnChanges({ redTelefono: { currentValue: component.redTelefono, previousValue: null, firstChange: false, isFirstChange: () => false } });
      fixture.detectChanges();
      expect(component.ssid).toBe('Casa de Luis');
      expect(el().textContent).toContain('Es la red a la que está conectado tu teléfono');
    });

    it('no pisa un nombre ya escrito o el de un intento anterior', () => {
      component.redTelefono = red('Casa de Luis');
      abrir('Otra red');
      expect(component.ssid).toBe('Otra red');
    });

    it('avisa si la red del teléfono es de 5 GHz y el pastillero no la vio', () => {
      component.redTelefono = red('Casa 5G', 5180);
      component.redes = [{ ssid: 'Casa 2.4', rssi: -50, segura: true }];
      abrir();
      expect(el().textContent).toContain('en 5 GHz');
      expect(el().textContent).not.toContain('Es la red a la que está conectado');
    });

    it('no avisa si el pastillero sí ve esa red (mismo nombre en 2,4 GHz)', () => {
      component.redTelefono = red('Casa', 5180);
      component.redes = [{ ssid: 'Casa', rssi: -50, segura: true }];
      abrir();
      expect(component.avisoBanda).toBeNull();
    });
  });

  describe('QR del Wi‑Fi', () => {
    const el = () => fixture.nativeElement as HTMLElement;
    const boton = (texto: string) => Array.from(el().querySelectorAll('button')).find((b) => b.textContent?.includes(texto));

    it('solo se ofrece en la app nativa', () => {
      escaner.disponible = false;
      abrir();
      expect(boton('Desde una captura')).toBeUndefined();
      escaner.disponible = true;
      fixture.detectChanges();
      expect(boton('Desde una captura')).toBeTruthy();
      expect(boton('Escanear QR')).toBeTruthy();
    });

    it('desde una captura rellena nombre y contraseña, y el nombre va exacto', async () => {
      escaner.leerDeImagen.and.resolveTo('WIFI:S:Casa de Luis ;T:WPA;P:clave secreta;H:false;;');
      const enviados: CredencialesWifi[] = [];
      component.submitted.subscribe((w) => enviados.push(w));
      abrir();
      await component.leerQrWifi('imagen');
      fixture.detectChanges();
      expect(component.ssid).toBe('Casa de Luis ');
      expect(component.password).toBe('clave secreta');
      expect(el().textContent).toContain('Nombre y contraseña leídos del QR');
      component.conectar();
      expect(enviados).toEqual([{ ssid: 'Casa de Luis ', password: 'clave secreta' }]);
    });

    it('con la cámara también rellena los datos', async () => {
      escaner.escanear.and.resolveTo('WIFI:T:WPA;S:MiRed;P:12345678;;');
      abrir();
      boton('Escanear QR')!.click();
      await fixture.whenStable();
      expect(escaner.escanear).toHaveBeenCalled();
      expect(component.ssid).toBe('MiRed');
      expect(component.password).toBe('12345678');
    });

    it('si se cancela no cambia nada', async () => {
      abrir('MiRed');
      await component.leerQrWifi('imagen');
      expect(component.ssid).toBe('MiRed');
      expect(component.mensajeQr).toBe('');
      expect(component.errorQr).toBe('');
    });

    it('explica si la imagen no tiene QR o el QR no es de Wi‑Fi', async () => {
      abrir();
      escaner.leerDeImagen.and.resolveTo('');
      await component.leerQrWifi('imagen');
      expect(component.errorQr).toContain('No encontramos ningún QR');
      escaner.escanear.and.resolveTo('pastillero://v1?id=x');
      await component.leerQrWifi('camara');
      expect(component.errorQr).toBe('Ese QR no es de una red Wi‑Fi.');
      expect(component.ssid).toBe('');
    });

    it('sin permiso de cámara lo dice', async () => {
      escaner.escanear.and.rejectWith(new Error('permiso-camara'));
      abrir();
      await component.leerQrWifi('camara');
      expect(component.errorQr).toContain('permiso de cámara');
      expect(component.leyendoQr).toBeFalse();
    });
  });

  it('alterna la visibilidad de la contraseña', () => {
    abrir();
    const campo = () => (fixture.nativeElement as HTMLElement).querySelector('#wifi-password') as HTMLInputElement;
    expect(campo().type).toBe('password');
    component.mostrarPassword = true;
    fixture.detectChanges();
    expect(campo().type).toBe('text');
  });
});
