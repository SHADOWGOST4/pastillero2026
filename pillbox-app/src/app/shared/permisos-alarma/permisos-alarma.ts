import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { AjusteAlarma, EstadoPermisosAlarma } from '../../services/alarma-medicacion/alarma-medicacion.plugin';
import { AlarmaMedicacionService } from '../../services/alarma-medicacion/alarma-medicacion.service';

interface PermisoAlarma {
  ajuste: AjusteAlarma;
  clave: keyof EstadoPermisosAlarma;
  titulo: string;
  detalle: string;
}

const PERMISOS: PermisoAlarma[] = [
  { ajuste: 'notificaciones', clave: 'notificaciones', titulo: 'Notificaciones', detalle: 'Para que la alarma pueda mostrarse.' },
  { ajuste: 'alarmasExactas', clave: 'alarmasExactas', titulo: 'Alarmas y recordatorios', detalle: 'Para que suene a la hora exacta.' },
  { ajuste: 'pantallaCompleta', clave: 'pantallaCompleta', titulo: 'Notificaciones a pantalla completa', detalle: 'Para verla sobre la pantalla de bloqueo.' },
  { ajuste: 'bateria', clave: 'sinOptimizacionBateria', titulo: 'Batería sin restricciones', detalle: 'Para que el teléfono no cierre la app y la alarma no suene.' },
];

/** Avisa de los permisos de Android que faltan para que la alarma sea fiable, y los abre con un toque. */
@Component({
  selector: 'app-permisos-alarma',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './permisos-alarma.html',
  styleUrl: './permisos-alarma.css',
})
export class PermisosAlarma implements OnInit, OnDestroy {
  faltantes: PermisoAlarma[] = [];

  // Al volver de los ajustes de Android la app recupera el foco: se vuelve a comprobar.
  private readonly alVolver = () => {
    if (!document.hidden) void this.revisar();
  };

  constructor(private readonly alarma: AlarmaMedicacionService) {}

  ngOnInit(): void {
    void this.revisar();
    document.addEventListener('visibilitychange', this.alVolver);
  }

  ngOnDestroy(): void {
    document.removeEventListener('visibilitychange', this.alVolver);
  }

  async revisar(): Promise<void> {
    if (!this.alarma.soportada()) {
      this.faltantes = [];
      return;
    }
    try {
      const estado = await this.alarma.estadoPermisos();
      this.faltantes = PERMISOS.filter((permiso) => !estado[permiso.clave]);
    } catch (error) {
      // Sin poder comprobarlo no se molesta al usuario con un aviso que podría ser falso.
      console.error(`[AlarmaMedicacion] no se pudieron comprobar los permisos: ${String(error)}`);
      this.faltantes = [];
    }
  }

  permitir(permiso: PermisoAlarma): void {
    void this.alarma.abrirAjustes(permiso.ajuste);
  }
}
