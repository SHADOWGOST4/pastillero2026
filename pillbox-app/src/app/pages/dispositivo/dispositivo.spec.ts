import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';
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

const modulo = (id: number, medicamento: string | null): ModuloResponse => ({
  id, id_dispositivo: 3, dispositivo_nombre: 'Mi pastillero', numero_modulo: id,
  id_medicamento: medicamento ? id : null, medicamento_nombre: medicamento,
});

describe('Dispositivo', () => {
  let component: Dispositivo;
  let fixture: ComponentFixture<Dispositivo>;
  let modulos: ModuloResponse[];
  let dispositivos: DispositivoResponse[];
  let asignacion: Observable<unknown>;

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
            getAsignacion: () => asignacion,
            asignarHorario: () => of({}),
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
    asignacion = of({ id_horario: 9 });
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

    it('usa "Horario del pastillero" y conserva el horario asignado en el selector', () => {
      expect(texto()).toContain('Horario del pastillero');
      expect(texto()).not.toContain('Horario activo');
      expect(boton('Asignar horario')).toBeTruthy();
      const select = (fixture.nativeElement as HTMLElement).querySelector('#horario-3') as HTMLSelectElement;
      expect(component.asignaciones[3]).toBe(9);
      expect(select.options[select.selectedIndex].textContent).toContain('Ibuprofeno');
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

  describe('horario asignado', () => {
    it('un 404 significa "sin horario": el selector queda en "Sin asignar" y no hay error', async () => {
      asignacion = throwError(() => ({ status: 404 }));
      await crear();
      const select = (fixture.nativeElement as HTMLElement).querySelector('#horario-3') as HTMLSelectElement;
      expect(component.asignaciones[3]).toBeUndefined();
      expect(select.options[select.selectedIndex].textContent).toContain('Sin asignar');
      expect(component.errorMessage).toBe('');
    });

    it('cualquier otro error sí se muestra', async () => {
      asignacion = throwError(() => ({ status: 500 }));
      await crear();
      expect(component.errorMessage).toContain('No se pudo cargar el horario');
    });
  });

  describe('módulos', () => {
    it('sin módulos muestra "0 módulos configurados" y la acción de agregar', async () => {
      await crear();
      expect(texto()).toContain('0 módulos configurados');
      expect(boton('Agregar módulo')).toBeTruthy();
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

    it('el formulario de nuevo módulo se abre con el botón y se cierra al cancelar', async () => {
      await crear();
      expect((fixture.nativeElement as HTMLElement).querySelector('#nuevo-modulo')).toBeNull();
      boton('Agregar módulo')!.click();
      fixture.detectChanges();
      expect((fixture.nativeElement as HTMLElement).querySelector('#nuevo-modulo')).not.toBeNull();
      boton('Cancelar')!.click();
      fixture.detectChanges();
      expect((fixture.nativeElement as HTMLElement).querySelector('#nuevo-modulo')).toBeNull();
    });
  });
});
