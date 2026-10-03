import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ConfigurarWifiModal, CredencialesWifi } from './configurar-wifi-modal';

describe('ConfigurarWifiModal', () => {
  let component: ConfigurarWifiModal;
  let fixture: ComponentFixture<ConfigurarWifiModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ConfigurarWifiModal] }).compileComponents();
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

  it('alterna la visibilidad de la contraseña', () => {
    abrir();
    const campo = () => (fixture.nativeElement as HTMLElement).querySelector('#wifi-password') as HTMLInputElement;
    expect(campo().type).toBe('password');
    component.mostrarPassword = true;
    fixture.detectChanges();
    expect(campo().type).toBe('text');
  });
});
