import { TestBed } from '@angular/core/testing';
import { Capacitor } from '@capacitor/core';
import { of, throwError } from 'rxjs';
import { RegistroTomaResponse } from '../../core/models/api.interfaces';
import { RegistroToma } from '../registro-toma';
import { ALARMA_MEDICACION, AlarmaMedicacionPlugin } from './alarma-medicacion.plugin';
import { AlarmaMedicacionService } from './alarma-medicacion.service';

const registro = (extra: Partial<RegistroTomaResponse> = {}): RegistroTomaResponse => ({
  id: 50, fecha_hora_programada: '2026-10-03T13:00:00.000Z', fecha_hora_real: null, id_horario: 15, id_usuario: 1,
  origen: 'APP', metodo_confirmacion: null, modulo_numero: null, apertura_en: null, cierre_en: null, boton_en: null, ...extra,
});

describe('AlarmaMedicacionService', () => {
  let plugin: jasmine.SpyObj<AlarmaMedicacionPlugin>;
  let registros: jasmine.SpyObj<RegistroToma>;
  let servicio: AlarmaMedicacionService;

  function crear(plataforma: string): void {
    spyOn(Capacitor, 'getPlatform').and.returnValue(plataforma);
    plugin = jasmine.createSpyObj<AlarmaMedicacionPlugin>('AlarmaMedicacion', [
      'programar', 'detenerPorToma', 'confirmacionesPendientes', 'limpiarConfirmaciones', 'estadoPermisos', 'abrirAjustes',
    ]);
    plugin.programar.and.resolveTo();
    plugin.detenerPorToma.and.resolveTo();
    plugin.limpiarConfirmaciones.and.resolveTo();
    registros = jasmine.createSpyObj<RegistroToma>('RegistroToma', ['create', 'confirmar', 'notificarActualizacion']);
    TestBed.configureTestingModule({
      providers: [
        { provide: ALARMA_MEDICACION, useValue: plugin },
        { provide: RegistroToma, useValue: registros },
      ],
    });
    servicio = TestBed.inject(AlarmaMedicacionService);
  }

  describe('fuera de Android', () => {
    beforeEach(() => crear('web'));

    it('no hace nada: la alarma nativa solo existe en Android', async () => {
      expect(servicio.soportada()).toBeFalse();
      await servicio.programar([{ horarioId: 1, instanteMs: 1, titulo: 't', cuerpo: 'c' }]);
      await servicio.detenerPorToma(1, '2026-10-03T13:00:00Z');
      expect(await servicio.procesarConfirmacionesPendientes()).toBe(0);
      expect(plugin.programar).not.toHaveBeenCalled();
      expect(plugin.detenerPorToma).not.toHaveBeenCalled();
      expect(plugin.confirmacionesPendientes).not.toHaveBeenCalled();
    });
  });

  describe('en Android', () => {
    beforeEach(() => crear('android'));

    it('entrega las alarmas al plugin', async () => {
      const alarmas = [{ horarioId: 15, instanteMs: 1_791_075_480_000, titulo: 'Hora de tomar', cuerpo: 'Aspirina · 13:58' }];
      await servicio.programar(alarmas);
      expect(plugin.programar).toHaveBeenCalledOnceWith({ alarmas });
    });

    it('apaga la alarma de una toma resuelta, con el instante en milisegundos', async () => {
      await servicio.detenerPorToma(15, '2026-10-03T13:00:00.000Z');
      expect(plugin.detenerPorToma).toHaveBeenCalledOnceWith({ horarioId: 15, instanteMs: Date.parse('2026-10-03T13:00:00.000Z') });
    });

    it('ignora una fecha inválida y no falla si el plugin falla', async () => {
      await servicio.detenerPorToma(15, 'ayer');
      expect(plugin.detenerPorToma).not.toHaveBeenCalled();
      plugin.detenerPorToma.and.rejectWith(new Error('sin servicio'));
      spyOn(console, 'error');
      await expectAsync(servicio.detenerPorToma(15, '2026-10-03T13:00:00Z')).toBeResolved();
    });

    describe('confirmaciones hechas desde la alarma', () => {
      const pendientes = [{ horarioId: 15, instanteMs: Date.parse('2026-10-03T13:00:00.000Z') }];

      it('sin pendientes no toca el servidor', async () => {
        plugin.confirmacionesPendientes.and.resolveTo({ confirmaciones: [] });
        expect(await servicio.procesarConfirmacionesPendientes()).toBe(0);
        expect(registros.create).not.toHaveBeenCalled();
        expect(plugin.limpiarConfirmaciones).not.toHaveBeenCalled();
      });

      it('encuentra o crea la toma, la confirma y limpia lo pendiente', async () => {
        plugin.confirmacionesPendientes.and.resolveTo({ confirmaciones: pendientes });
        registros.create.and.returnValue(of(registro()));
        registros.confirmar.and.returnValue(of(registro({ fecha_hora_real: '2026-10-03T13:00:20Z' })));
        expect(await servicio.procesarConfirmacionesPendientes()).toBe(1);
        expect(registros.create).toHaveBeenCalledOnceWith({ id_horario: 15, fecha_hora_programada: '2026-10-03T13:00:00.000Z' });
        expect(registros.confirmar).toHaveBeenCalledOnceWith(50);
        expect(plugin.limpiarConfirmaciones).toHaveBeenCalledTimes(1);
        expect(registros.notificarActualizacion).toHaveBeenCalledTimes(1);
      });

      it('si la toma ya estaba confirmada no la confirma otra vez', async () => {
        plugin.confirmacionesPendientes.and.resolveTo({ confirmaciones: pendientes });
        registros.create.and.returnValue(of(registro({ fecha_hora_real: '2026-10-03T13:00:05Z' })));
        expect(await servicio.procesarConfirmacionesPendientes()).toBe(1);
        expect(registros.confirmar).not.toHaveBeenCalled();
        expect(plugin.limpiarConfirmaciones).toHaveBeenCalledTimes(1);
      });

      it('si el servidor falla conserva las pendientes para reintentar más tarde', async () => {
        plugin.confirmacionesPendientes.and.resolveTo({ confirmaciones: pendientes });
        registros.create.and.returnValue(throwError(() => ({ status: 500 })));
        spyOn(console, 'error');
        expect(await servicio.procesarConfirmacionesPendientes()).toBe(0);
        expect(plugin.limpiarConfirmaciones).not.toHaveBeenCalled();
        expect(registros.notificarActualizacion).not.toHaveBeenCalled();
      });

      it('si el plugin no puede leerlas, no rompe', async () => {
        plugin.confirmacionesPendientes.and.rejectWith(new Error('sin servicio'));
        spyOn(console, 'error');
        expect(await servicio.procesarConfirmacionesPendientes()).toBe(0);
      });
    });
  });
});
