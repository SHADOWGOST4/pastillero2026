export interface HorarioModel {
  id?: number;
  id_medicamento?: number;
  medicamento_nombre?: string;
  medicamento?: string;
  hora_toma?: string;
  frecuencia?: number;
  proxima_toma?: string | Date;
}
