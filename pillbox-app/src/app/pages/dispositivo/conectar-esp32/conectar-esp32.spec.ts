import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Subject, from, of, throwError } from 'rxjs';
import { DispositivoResponse, ReclamarDispositivoResponse } from '../../../core/models/api.interfaces';
import { AprovisionamientoError, PasoAprovisionamiento, ProvisioningService } from '../../../services/aprovisionamiento/provisioning.service';
import { DispositivoService } from '../../../services/dispositivo';
import { ConectarEsp32 } from './conectar-esp32';

const ID = '4397a840-1b2c-4d3e-8f90-a1b2c3d4e5f6';
const QR = `pastillero://v1?id=${ID}&ble=PASTILLERO-4397A840&pop=secreto`;

function dispositivo(ultimoLatido: string | null): DispositivoResponse {
  return {
    id: 7, nombre: 'Mi pastillero', ip_esp32: '', estado_conexion: false, identificador: ID,
    ultimo_latido: ultimoLatido, version_firmware: '', rssi: null, id_usuario: 1,
  };
}

describe('ConectarEsp32', () => {
  let component: ConectarEsp32;
  let fixture: ComponentFixture<ConectarEsp32>;
  let api: jasmine.SpyObj<DispositivoService>;
  let ble: jasmine.SpyObj<ProvisioningService>;

  const reclamo: ReclamarDispositivoResponse = {
    dispositivo: dispositivo(null), device_id: ID, enrollment_code: 'codigo', expira_en: '2099-01-01T00:00:00Z',
  };

  beforeEach(async () => {
    api = jasmine.createSpyObj('DispositivoService', ['reclamar', 'getById']);
    ble = jasmine.createSpyObj('ProvisioningService', ['aprovisionar']);
    await TestBed.configureTestingModule({
      imports: [ConectarEsp32],
      providers: [
        { provide: DispositivoService, useValue: api },
        { provide: ProvisioningService, useValue: ble },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ConectarEsp32);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  function llenarWifi(): void {
    component.usarQr(QR);
    component.ssid = 'MiRed';
    component.password = '12345678';
  }

  it('rechaza un QR ajeno y se queda en el inicio', () => {
    component.usarQr('https://otro.com');
    expect(component.etapa).toBe('inicio');
    expect(component.mensajeError).toContain('no es de un pastillero');
  });

  it('un QR válido pasa a pedir el Wi-Fi', () => {
    component.usarQr(QR);
    expect(component.etapa).toBe('wifi');
  });

  it('exige contraseña de al menos 8 caracteres', () => {
    component.usarQr(QR);
    component.ssid = 'MiRed';
    component.password = '123';
    expect(component.wifiValido).toBeFalse();
  });

  it('flujo feliz: reclama, aprovisiona y confirma con el latido', fakeAsync(() => {
    api.reclamar.and.returnValue(of(reclamo));
    ble.aprovisionar.and.returnValue(from<PasoAprovisionamiento[]>(['buscando', 'wifi']));
    api.getById.and.callFake(() => of(dispositivo(new Date(Date.now() + 1000).toISOString())));
    llenarWifi();
    component.conectar();
    tick(0);
    expect(ble.aprovisionar).toHaveBeenCalledWith(jasmine.objectContaining({
      nombreBle: 'PASTILLERO-4397A840', pop: 'secreto', ssid: 'MiRed', deviceId: ID, enrollmentCode: 'codigo',
    }));
    expect(component.etapa).toBe('exito');
    expect(component.password).toBe('');
  }));

  it('espera el latido con reintentos', fakeAsync(() => {
    api.reclamar.and.returnValue(of(reclamo));
    ble.aprovisionar.and.returnValue(of<PasoAprovisionamiento>('wifi'));
    api.getById.and.returnValues(
      of(dispositivo(null)),
      of(dispositivo(new Date(Date.now() + 60_000).toISOString())),
    );
    llenarWifi();
    component.conectar();
    tick(0);
    expect(component.etapa).toBe('progreso');
    tick(3000);
    expect(component.etapa).toBe('exito');
  }));

  it('muestra error de Wi-Fi y permite reintentar', () => {
    api.reclamar.and.returnValue(of(reclamo));
    ble.aprovisionar.and.returnValue(throwError(() => new AprovisionamientoError('wifi')));
    llenarWifi();
    component.conectar();
    expect(component.etapa).toBe('error');
    expect(component.mensajeError).toContain('Wi‑Fi');
    component.reintentar();
    expect(component.etapa).toBe('wifi');
  });

  it('error 404 al reclamar no llega al BLE', () => {
    api.reclamar.and.returnValue(throwError(() => ({ status: 404 })));
    llenarWifi();
    component.conectar();
    expect(ble.aprovisionar).not.toHaveBeenCalled();
    expect(component.etapa).toBe('error');
    expect(component.mensajeError).toContain('no está disponible');
  });

  describe('Wi-Fi en un modal', () => {
    const el = () => fixture.nativeElement as HTMLElement;
    const boton = (texto: string) =>
      Array.from(el().querySelectorAll('button')).find((b) => b.textContent?.includes(texto));

    it('tras escanear ofrece "Configurar Wi-Fi" y el modal sigue cerrado', () => {
      component.usarQr(QR);
      fixture.detectChanges();
      expect(el().textContent).toContain('Pastillero detectado');
      expect(el().textContent).toContain('PASTILLERO-4397A840');
      expect(boton('Configurar Wi‑Fi')).toBeTruthy();
      expect(el().querySelector('.wifi-modal')).toBeNull();
      expect(el().querySelector('#wifi-ssid')).toBeNull();
    });

    it('el botón abre el modal con los campos', () => {
      component.usarQr(QR);
      fixture.detectChanges();
      boton('Configurar Wi‑Fi')!.click();
      fixture.detectChanges();
      expect(component.wifiModalAbierto).toBeTrue();
      expect(el().querySelector('#wifi-ssid')).not.toBeNull();
      expect(el().querySelector('#wifi-password')).not.toBeNull();
    });

    it('enviar el modal cierra el modal e inicia la conexión', () => {
      api.reclamar.and.returnValue(of(reclamo));
      ble.aprovisionar.and.returnValue(new Subject<PasoAprovisionamiento>());
      component.usarQr(QR);
      component.abrirWifi();
      component.usarWifi({ ssid: 'MiRed', password: '12345678' });
      expect(component.wifiModalAbierto).toBeFalse();
      expect(ble.aprovisionar).toHaveBeenCalledWith(jasmine.objectContaining({ ssid: 'MiRed' }));
      expect(component.etapa).toBe('progreso');
    });

    it('mientras conecta muestra el spinner y el paso actual', () => {
      api.reclamar.and.returnValue(of(reclamo));
      const pasos = new Subject<PasoAprovisionamiento>();
      ble.aprovisionar.and.returnValue(pasos);
      component.usarQr(QR);
      component.usarWifi({ ssid: 'MiRed', password: '12345678' });
      fixture.detectChanges();
      expect(el().querySelector('app-conexion-spinner .spinner')).not.toBeNull();
      expect(el().querySelector('.progreso-titulo')?.textContent).toContain('Buscando tu pastillero');
      pasos.next('conectando');
      fixture.detectChanges();
      expect(el().querySelector('.progreso-titulo')?.textContent).toContain('Conectando de forma segura');
    });

    it('al terminar o fallar ya no muestra el spinner', () => {
      api.reclamar.and.returnValue(of(reclamo));
      ble.aprovisionar.and.returnValue(throwError(() => new AprovisionamientoError('wifi')));
      component.usarQr(QR);
      component.usarWifi({ ssid: 'MiRed', password: '12345678' });
      fixture.detectChanges();
      expect(el().querySelector('app-conexion-spinner')).toBeNull();
      expect(el().textContent).toContain('Reintentar');
    });
  });

  it('falla si el latido nunca llega', fakeAsync(() => {
    api.reclamar.and.returnValue(of(reclamo));
    ble.aprovisionar.and.returnValue(of<PasoAprovisionamiento>('wifi'));
    api.getById.and.returnValue(of(dispositivo(null)));
    llenarWifi();
    component.conectar();
    tick(100_000);
    expect(component.etapa).toBe('error');
  }));
});
