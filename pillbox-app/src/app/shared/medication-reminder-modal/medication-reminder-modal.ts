import { CommonModule, DatePipe } from '@angular/common';
import { Component } from '@angular/core';
import { MedicationReminderService } from '../../services/medication-reminder.service';

@Component({
  selector: 'app-medication-reminder-modal',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './medication-reminder-modal.html',
  styleUrl: './medication-reminder-modal.css',
})
export class MedicationReminderModal {
  busy = false;
  errorMessage = '';

  constructor(readonly reminderService: MedicationReminderService) {}

  async confirmar(): Promise<void> {
    if (this.busy) {
      return;
    }

    this.busy = true;
    this.errorMessage = '';
    try {
      await this.reminderService.confirm();
    } catch (error) {
      console.error('No se pudo confirmar la toma.', error);
      const apiError = (error as { error?: Record<string, unknown> })?.error;
      const detail = apiError?.['detail'];
      if (typeof detail === 'string') {
        const stock = apiError?.['stock_actual'];
        const required = apiError?.['cantidad_requerida'];
        this.errorMessage =
          typeof stock === 'number' && typeof required === 'number'
            ? `${detail} Stock disponible: ${stock}. Cantidad necesaria: ${required}.`
            : detail;
      } else {
        this.errorMessage = 'No se pudo confirmar la toma. Inténtalo nuevamente.';
      }
    } finally {
      this.busy = false;
    }
  }

  cerrar(): void {
    if (!this.busy) {
      this.reminderService.dismiss();
    }
  }
}
