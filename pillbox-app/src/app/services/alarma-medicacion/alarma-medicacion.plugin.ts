import { InjectionToken } from '@angular/core';
import { Capacitor, registerPlugin } from '@capacitor/core';

export interface AlarmaProgramada {
  horarioId: number;
  /** Instante programado de la toma, en milisegundos. */
  instanteMs: number;
  titulo: string;
  cuerpo: string;
}

export interface ConfirmacionPendiente {
  horarioId: number;
  instanteMs: number;
}

export interface EstadoPermisosAlarma {
  notificaciones: boolean;
  alarmasExactas: boolean;
  pantallaCompleta: boolean;
  sinOptimizacionBateria: boolean;
}

export type AjusteAlarma = 'notificaciones' | 'alarmasExactas' | 'pantallaCompleta' | 'bateria';

export interface AlarmaMedicacionPlugin {
  /** Reemplaza las alarmas programadas por estas. Las pospuestas que sigan vigentes se conservan. */
  programar(datos: { alarmas: AlarmaProgramada[] }): Promise<void>;
  /** La toma se resolvió: apaga la alarma que esté sonando por ella y cancela sus alarmas pendientes. */
  detenerPorToma(datos: { horarioId: number; instanteMs: number }): Promise<void>;
  /** Tomas que la persona confirmó con "Ya lo tomé" en la alarma y que aún no se enviaron al servidor. */
  confirmacionesPendientes(): Promise<{ confirmaciones: ConfirmacionPendiente[] }>;
  limpiarConfirmaciones(): Promise<void>;
  estadoPermisos(): Promise<EstadoPermisosAlarma>;
  abrirAjustes(datos: { tipo: AjusteAlarma }): Promise<void>;
}

/** Implementación nativa: plugins/capacitor-alarma-medicacion (solo Android). */
export const ALARMA_MEDICACION = new InjectionToken<AlarmaMedicacionPlugin>('AlarmaMedicacionPlugin', {
  providedIn: 'root',
  factory: () => registerPlugin<AlarmaMedicacionPlugin>('AlarmaMedicacion'),
});

/** Apaga la alarma nativa de una toma que ya se resolvió. No falla: la toma ya está resuelta en el servidor. */
export async function detenerAlarmaDeToma(
  plugin: AlarmaMedicacionPlugin,
  horarioId: number,
  programada: string,
): Promise<void> {
  if (Capacitor.getPlatform() !== 'android') return;
  const instanteMs = Date.parse(programada);
  if (Number.isNaN(instanteMs)) return;
  try {
    await plugin.detenerPorToma({ horarioId, instanteMs });
  } catch (error) {
    console.error(`[AlarmaMedicacion] no se pudo apagar la alarma: ${String(error)}`);
  }
}
