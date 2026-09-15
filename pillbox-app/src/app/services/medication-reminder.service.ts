import { Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  HorarioResponse,
  MedicamentoResponse,
  RegistroTomaResponse,
} from '../core/models/api.interfaces';
import { Horario } from './horario';
import { Medicamento } from './medicamento';
import { RegistroToma } from './registro-toma';

export const MEDICATION_TOLERANCE_MINUTES = 15;
const CHECK_INTERVAL_MS = 10_000;

export interface MedicationReminder {
  registro: RegistroTomaResponse;
  horario: HorarioResponse;
  medicamento: MedicamentoResponse | undefined;
}

@Injectable({ providedIn: 'root' })
export class MedicationReminderService {
  readonly currentReminder = signal<MedicationReminder | null>(null);

  private intervalId: ReturnType<typeof setInterval> | null = null;
  private reminderExpiryId: ReturnType<typeof setTimeout> | null = null;
  private checking = false;
  private dismissedKeys = new Set<string>();

  constructor(
    private readonly horarioService: Horario,
    private readonly medicamentoService: Medicamento,
    private readonly registroService: RegistroToma,
  ) {}

  start(): void {
    if (this.intervalId !== null) {
      return;
    }

    void this.checkNow();
    this.intervalId = setInterval(() => void this.checkNow(), CHECK_INTERVAL_MS);
  }

  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.clearReminder();
    this.dismissedKeys.clear();
  }

  dismiss(): void {
    const reminder = this.currentReminder();
    if (reminder) {
      this.dismissedKeys.add(this.occurrenceKey(reminder.horario.id, reminder.registro.fecha_hora_programada));
    }
    this.clearReminder();
  }

  async confirm(): Promise<void> {
    const reminder = this.currentReminder();
    if (!reminder) {
      return;
    }

    const updated = await firstValueFrom(
      this.registroService.confirmar(reminder.registro.id),
    );
    this.registroService.notificarActualizacion();
    this.clearReminder();
  }

  private async checkNow(): Promise<void> {
    if (this.checking) {
      return;
    }

    this.checking = true;
    try {
      const reminderVisible = this.currentReminder();
      if (reminderVisible) {
        // Si el ESP32 confirmó primero, el registro ya cambió en el servidor.
        // Cerramos este modal sin volver a enviar una confirmación.
        const registroActual = await firstValueFrom(
          this.registroService.getById(reminderVisible.registro.id),
        );
        if (registroActual.fecha_hora_real) {
          this.registroService.notificarActualizacion();
          this.clearReminder();
        }
        return;
      }

      const [horarios, medicamentos, registros] = await Promise.all([
        firstValueFrom(this.horarioService.getAll()),
        firstValueFrom(this.medicamentoService.getAll()),
        firstValueFrom(this.registroService.getAll()),
      ]);

      const now = new Date();
      for (const horario of horarios) {
        const scheduled = this.latestDueOccurrence(horario, now);
        if (!scheduled) {
          continue;
        }

        const key = this.occurrenceKey(horario.id, scheduled.toISOString());
        if (this.dismissedKeys.has(key)) {
          continue;
        }

        let registro = registros.find(
          (item) =>
            item.id_horario === horario.id &&
            this.sameInstant(item.fecha_hora_programada, scheduled),
        );

        if (!registro) {
          registro = await firstValueFrom(
            this.registroService.create({
              id_horario: horario.id,
              fecha_hora_programada: scheduled.toISOString(),
            }),
          );
          registros.push(registro);
          this.registroService.notificarActualizacion();
        }

        if (!registro.fecha_hora_real) {
          const minutesSinceScheduled =
            (now.getTime() - scheduled.getTime()) / 60_000;
          if (minutesSinceScheduled <= MEDICATION_TOLERANCE_MINUTES) {
            this.currentReminder.set({
              registro,
              horario,
              medicamento: medicamentos.find((item) => item.id === horario.id_medicamento),
            });
            this.scheduleReminderExpiry(scheduled);
            return;
          }
        }
      }
    } catch (error) {
      console.error('No se pudo comprobar las tomas programadas.', error);
    } finally {
      this.checking = false;
    }
  }

  private latestDueOccurrence(horario: HorarioResponse, now: Date): Date | null {
    const [hours, minutes, seconds = 0] = horario.hora_toma.split(':').map(Number);
    if (![hours, minutes, seconds].every(Number.isFinite)) {
      return null;
    }

    const anchor = new Date(now);
    anchor.setHours(hours, minutes, seconds, 0);

    if (horario.frecuencia <= 0 || horario.frecuencia >= 24) {
      return anchor <= now ? anchor : null;
    }

    const elapsedHours = (now.getTime() - anchor.getTime()) / 3_600_000;
    const steps = Math.floor(elapsedHours / horario.frecuencia);
    const latest = new Date(anchor.getTime() + steps * horario.frecuencia * 3_600_000);
    return latest <= now ? latest : null;
  }

  private sameInstant(left: string, right: Date): boolean {
    return Math.abs(new Date(left).getTime() - right.getTime()) < 1000;
  }

  private occurrenceKey(horarioId: number, scheduled: string): string {
    return `${horarioId}:${new Date(scheduled).getTime()}`;
  }

  private scheduleReminderExpiry(scheduled: Date): void {
    if (this.reminderExpiryId !== null) {
      clearTimeout(this.reminderExpiryId);
    }

    const remainingMs =
      scheduled.getTime() + MEDICATION_TOLERANCE_MINUTES * 60_000 - Date.now();
    this.reminderExpiryId = setTimeout(() => {
      this.reminderExpiryId = null;
      this.clearReminder();
    }, Math.max(0, remainingMs));
  }

  private clearReminder(): void {
    if (this.reminderExpiryId !== null) {
      clearTimeout(this.reminderExpiryId);
      this.reminderExpiryId = null;
    }
    this.currentReminder.set(null);
  }
}
