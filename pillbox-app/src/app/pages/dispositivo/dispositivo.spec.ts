import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { DispositivoResponse, HorarioResponse, ModuloResponse } from '../../core/models/api.interfaces';
import { DispositivoService } from '../../services/dispositivo';
import { Horario } from '../../services/horario';
import { Medicamento } from '../../services/medicamento';
import { ModuloService } from '../../services/modulo';
import { Dispositivo } from './dispositivo';

const DISPOSITIVO: DispositivoResponse = {
  id: 3, nombre: 'Mi pastillero', ip_esp32: '192.168.1.87', estado_conexion: true, identificador: 'x',
  ultimo_latido: null, version_firmware: '', rssi: null, id_usuario: 1,
};

const modulo = (id: number, medicamento: string | null, detectado = true): ModuloResponse => ({
  id, id_dispositivo: 3, dispositivo_nombre: 'Mi pastillero', numero_modulo: id,
  id_medicamento: medicamento ? id : null, medicamento_nombre: medicamento,
  detectado, ultimo_visto: null, tapa_abierta: null,
});

describe('Dispositivo', () => {
  let component: Dispositivo;
  let fixture: ComponentFixture<Dispositivo>;
  let modulos: ModuloResponse[];
  let dispositivos: DispositivoResponse[];
  let getEventos: jasmine.Spy;
  let getAsignacion: jasmine.Spy;
  let asignarHorario: jasmine.Spy;

  const texto = () => (fixture.nativeElement as HTMLElement).textContent ?? '';
  const botones = () => Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button'));
  const boton = (etiqueta: string) => botones().find((b) => b.textContent?.includes(etiqueta));

  async function crear() {
    await TestBed.configureTestingModule({
      imports: [Dispositivo],
      providers: [
        {
          provide: DispositivoService,
          useValue: {
            getAll: () => of(dispositivos),
            getAsignacion,
            asignarHorario,
            getEventos,
          },
        },
        {
          provide: ModuloService,
          useValue: { getAll: () => of(modulos), create: () => of({}), update: () => of({}) },
        },
        { provide: Medicamento, useValue: { getAll: () => of([]) } },
        {
          provide: Horario,
          useValue: {
            getAll: () =>
              of([{ id: 9, medicamento_nombre: 'Ibuprofeno', hora_toma: '08:00' } as unknown as HorarioResponse]),
          },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(Dispositivo);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(() => {
    modulos = [];
    dispositivos = [DISPOSITIVO];
    getEventos = jasmine.createSpy('getEventos').and.returnValue(of([]));
    getAsignacion = jasmine.createSpy('getAsignacion').and.returnValue(of({ id_horario: 9 }));
    asignarHorario = jasmine.createSpy('asignarHorario').and.returnValue(of({}));
  });

  it('se crea', async () => {
    await crear();
    expect(component).toBeTruthy();
  });

  describe('tarjeta del dispositivo', () => {
    beforeEach(crear);

    it('no muestra la IP ni el texto redundante de estado', () => {
      expect(texto()).not.toContain('192.168.1.87');
      expect(texto()).not.toContain('IP del ESP32');
      expect(texto()).not.toContain('figura conectado');
    });

    it('muestra estado, tipo y nombre', () => {
      expect(texto()).toContain('Conectado');
      expect(texto()).toContain('Pastillero inteligente');
      expect(texto()).toContain('Mi pastillero');
    });

    it('la tarjeta no muestra horario: los horarios son de los medicamentos de cada módulo', () => {
      expect(texto()).not.toContain('Horario del pastillero');
      expect(texto()).not.toContain('Asignar horario');
      expect((fixture.nativeElement as HTMLElement).querySelector('select')).toBeNull();
    });

    it('ya no consulta la asignación de horario del dispositivo', () => {
      expect(getAsignacion).not.toHaveBeenCalled();
      expect(asignarHorario).not.toHaveBeenCalled();
    });

    it('mantiene Editar y Ver módulos, y desvincular es un enlace secundario', () => {
      expect(boton('Editar')).toBeTruthy();
      expect(boton('Ver módulos')).toBeTruthy();
      const desvincular = boton('Desvincular dispositivo');
      expect(desvincular).toBeTruthy();
      expect(desvincular!.classList).toContain('unlink-button');
      expect(desvincular!.classList).not.toContain('btn');
    });

    it('desvincular sigue abriendo la confirmación', () => {
      boton('Desvincular dispositivo')!.click();
      expect(component.modalEliminarAbierto).toBeTrue();
      expect(component.dispositivoPendienteEliminar).toBe(3);
    });
  });

  describe('pastillero modular', () => {
    const tarjetas = () => (fixture.nativeElement as HTMLElement).querySelectorAll('app-modulo-card');

    it('dibuja una tarjeta por módulo', async () => {
      modulos = [modulo(1, 'Ibuprofeno'), modulo(2, null)];
      await crear();
      expect(tarjetas().length).toBe(2);
      expect(texto()).toContain('Módulo 1');
      expect(texto()).toContain('Módulo 2');
    });

    it('asignar y desasignar siguen funcionando desde la tarjeta', async () => {
      modulos = [modulo(1, 'Ibuprofeno'), modulo(2, null)];
      await crear();
      const botonesTarjeta = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('app-modulo-card button'));
      (botonesTarjeta.find((b) => b.textContent?.includes('Asignar')) as HTMLButtonElement).click();
      expect(component.selectedModuleId).toBe(2);
    });

    it('carga la actividad reciente del dispositivo y la muestra', async () => {
      getEventos.and.returnValue(of([{
        id: 1, evento_id: 'x', tipo: 'tapa_abierta', fecha_dispositivo: new Date().toISOString(),
        fecha_recibido: new Date().toISOString(), modulo: 1, id_registro: null, datos: {},
      }]));
      await crear();
      expect(getEventos).toHaveBeenCalledWith(3, { limit: 10 });
      expect(texto()).toContain('Actividad reciente');
      expect(texto()).toContain('Módulo 1 · Tapa abierta');
    });

    it('si falla la actividad no rompe la pantalla', async () => {
      getEventos.and.returnValue(throwError(() => ({ status: 500 })));
      await crear();
      expect(component.eventos).toEqual([]);
      expect(component.errorMessage).toBe('');
      expect(texto()).toContain('Aún no hay actividad');
    });

    it('"Buscar módulos" vuelve a consultar módulos y actividad', async () => {
      await crear();
      getEventos.calls.reset();
      boton('Buscar módulos')!.click();
      expect(getEventos).toHaveBeenCalledTimes(1);
    });
  });

  describe('módulos', () => {
    it('sin módulos muestra "0 módulos configurados" y explica cómo se detectan', async () => {
      await crear();
      expect(texto()).toContain('0 módulos configurados');
      expect(texto()).toContain('Conecta un módulo al pastillero');
      expect(boton('Buscar módulos')).toBeTruthy();
    });

    it('con módulos resume cuántos hay, ocupados y disponibles', async () => {
      modulos = [modulo(1, 'Ibuprofeno'), modulo(2, null), modulo(3, null)];
      await crear();
      expect(component.resumenModulos).toBe('3 módulos configurados · 1 ocupado · 2 disponibles');
      expect(texto()).toContain('3 módulos configurados · 1 ocupado · 2 disponibles');
    });

    it('usa el singular con un solo módulo', async () => {
      modulos = [modulo(1, null)];
      await crear();
      expect(component.resumenModulos).toBe('1 módulo configurado · 0 ocupados · 1 disponible');
    });

    it('el alta manual sigue disponible: abre el formulario y se cierra al cancelar', async () => {
      await crear();
      expect((fixture.nativeElement as HTMLElement).querySelector('#nuevo-modulo')).toBeNull();
      boton('Agregar manualmente')!.click();
      fixture.detectChanges();
      expect((fixture.nativeElement as HTMLElement).querySelector('#nuevo-modulo')).not.toBeNull();
      boton('Cancelar')!.click();
      fixture.detectChanges();
      expect((fixture.nativeElement as HTMLElement).querySelector('#nuevo-modulo')).toBeNull();
    });
  });
});
