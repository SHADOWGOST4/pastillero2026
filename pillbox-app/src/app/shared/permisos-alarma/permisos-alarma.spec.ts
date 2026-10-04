import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EstadoPermisosAlarma } from '../../services/alarma-medicacion/alarma-medicacion.plugin';
import { AlarmaMedicacionService } from '../../services/alarma-medicacion/alarma-medicacion.service';
import { PermisosAlarma } from './permisos-alarma';

const TODOS: EstadoPermisosAlarma = { notificaciones: true, alarmasExactas: true, pantallaCompleta: true, sinOptimizacionBateria: true };

describe('PermisosAlarma', () => {
  let alarma: jasmine.SpyObj<AlarmaMedicacionService>;
  let fixture: ComponentFixture<PermisosAlarma>;
  const el = () => fixture.nativeElement as HTMLElement;

  async function crear(estado: EstadoPermisosAlarma, soportada = true) {
    alarma = jasmine.createSpyObj<AlarmaMedicacionService>('AlarmaMedicacionService', ['soportada', 'estadoPermisos', 'abrirAjustes']);
    alarma.soportada.and.returnValue(soportada);
    alarma.estadoPermisos.and.resolveTo(estado);
    alarma.abrirAjustes.and.resolveTo();
    await TestBed.configureTestingModule({
      imports: [PermisosAlarma],
      providers: [{ provide: AlarmaMedicacionService, useValue: alarma }],
    }).compileComponents();
    fixture = TestBed.createComponent(PermisosAlarma);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('no muestra nada si están todos los permisos', async () => {
    await crear(TODOS);
    expect(el().querySelector('.permisos-alarma')).toBeNull();
  });

  it('no muestra nada fuera de Android y ni siquiera consulta', async () => {
    await crear({ ...TODOS, notificaciones: false }, false);
    expect(el().querySelector('.permisos-alarma')).toBeNull();
    expect(alarma.estadoPermisos).not.toHaveBeenCalled();
  });

  it('lista solo los permisos que faltan', async () => {
    await crear({ ...TODOS, pantallaCompleta: false, sinOptimizacionBateria: false });
    const filas = Array.from(el().querySelectorAll('li'));
    expect(filas.length).toBe(2);
    expect(el().textContent).toContain('Faltan 2 permisos');
    expect(filas[0].textContent).toContain('Notificaciones a pantalla completa');
    expect(filas[1].textContent).toContain('Batería sin restricciones');
  });

  it('con un solo permiso lo dice en singular', async () => {
    await crear({ ...TODOS, alarmasExactas: false });
    expect(el().textContent).toContain('Falta un permiso');
    expect(el().textContent).not.toContain('Faltan');
  });

  it('"Permitir" abre el ajuste correspondiente', async () => {
    await crear({ ...TODOS, alarmasExactas: false, sinOptimizacionBateria: false });
    const botones = Array.from(el().querySelectorAll('button'));
    botones[0].click();
    botones[1].click();
    expect(alarma.abrirAjustes.calls.allArgs()).toEqual([['alarmasExactas'], ['bateria']]);
  });

  it('al volver a la app vuelve a comprobar y el aviso desaparece cuando ya se permitió', async () => {
    await crear({ ...TODOS, notificaciones: false });
    expect(el().querySelector('.permisos-alarma')).not.toBeNull();
    alarma.estadoPermisos.and.resolveTo(TODOS);
    document.dispatchEvent(new Event('visibilitychange'));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el().querySelector('.permisos-alarma')).toBeNull();
  });

  it('si no puede comprobarlos, no molesta con un aviso falso', async () => {
    alarma = jasmine.createSpyObj<AlarmaMedicacionService>('AlarmaMedicacionService', ['soportada', 'estadoPermisos', 'abrirAjustes']);
    alarma.soportada.and.returnValue(true);
    alarma.estadoPermisos.and.rejectWith(new Error('sin servicio'));
    spyOn(console, 'error');
    await TestBed.configureTestingModule({
      imports: [PermisosAlarma],
      providers: [{ provide: AlarmaMedicacionService, useValue: alarma }],
    }).compileComponents();
    fixture = TestBed.createComponent(PermisosAlarma);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el().querySelector('.permisos-alarma')).toBeNull();
  });
});
