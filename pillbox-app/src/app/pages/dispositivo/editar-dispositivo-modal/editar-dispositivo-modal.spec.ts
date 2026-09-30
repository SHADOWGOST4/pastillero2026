import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DispositivoResponse } from '../../../core/models/api.interfaces';
import { EditarDispositivoModal } from './editar-dispositivo-modal';

const DISPOSITIVO: DispositivoResponse = {
  id: 3, nombre: 'Mi pastillero', ip_esp32: '', estado_conexion: false, identificador: 'x',
  ultimo_latido: null, version_firmware: '', rssi: null, id_usuario: 1,
};

describe('EditarDispositivoModal', () => {
  let component: EditarDispositivoModal;
  let fixture: ComponentFixture<EditarDispositivoModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [EditarDispositivoModal] }).compileComponents();
    fixture = TestBed.createComponent(EditarDispositivoModal);
    component = fixture.componentInstance;
    component.dispositivo = DISPOSITIVO;
    component.visible = true;
    component.ngOnChanges();
    fixture.detectChanges();
  });

  it('precarga el nombre actual', () => {
    expect(component.nombre).toBe('Mi pastillero');
  });

  it('emite el nombre sin espacios sobrantes', () => {
    const guardado: string[] = [];
    component.saved.subscribe((n) => guardado.push(n));
    component.nombre = '  Pastillero sala  ';
    component.guardar();
    expect(guardado).toEqual(['Pastillero sala']);
  });

  it('no guarda un nombre vacío', () => {
    const guardado: string[] = [];
    component.saved.subscribe((n) => guardado.push(n));
    component.nombre = '   ';
    component.guardar();
    expect(guardado).toEqual([]);
    expect(component.intentado).toBeTrue();
  });

  it('si no hay cambios solo cierra', () => {
    let cerrado = false;
    component.closed.subscribe(() => (cerrado = true));
    component.guardar();
    expect(cerrado).toBeTrue();
  });

  it('no emite mientras está guardando', () => {
    const guardado: string[] = [];
    component.saved.subscribe((n) => guardado.push(n));
    component.busy = true;
    component.nombre = 'Otro';
    component.guardar();
    expect(guardado).toEqual([]);
  });
});
