// Contrato oficial del backend: API_FRONTEND_CONTRACT.md

export interface RegistroRequest {
  nombre: string;
  correo: string;
  password: string;
  telefono: string;
}

export interface LoginRequest {
  correo: string;
  password: string;
}

export interface RefreshTokenRequest {
  refresh: string;
}

export interface RefreshTokenResponse {
  access: string;
}

export interface UsuarioResponse {
  id: number;
  nombre: string;
  correo: string;
  telefono: string;
  activo: boolean;
  fecha_creacion: string;
}

export interface LoginResponse {
  refresh: string;
  access: string;
  usuario: {
    id: number;
    nombre: string;
    correo: string;
    telefono: string;
  };
}

export interface ActualizarUsuarioRequest {
  nombre?: string;
  telefono?: string;
  password?: string;
}

export interface CrearMedicamentoRequest {
  nombre: string;
  descripcion?: string;
  dosis: string;
  stock: number;
}

export interface ActualizarMedicamentoRequest {
  nombre?: string;
  descripcion?: string;
  dosis?: string;
  stock?: number;
}

export interface MedicamentoResponse {
  id: number;
  nombre: string;
  descripcion: string;
  dosis: string;
  stock: number;
  id_usuario: number;
}

export interface CrearHorarioRequest {
  hora_toma: string;
  frecuencia: number;
  id_medicamento: number;
}

export interface ActualizarHorarioRequest {
  hora_toma?: string;
  frecuencia?: number;
  id_medicamento?: number;
}

export interface HorarioResponse {
  id: number;
  hora_toma: string;
  frecuencia: number;
  id_medicamento: number;
  medicamento_nombre: string;
  proxima_toma: string;
}

export interface ProximaTomaItem {
  id_horario: number;
  id_medicamento: number;
  medicamento: string;
  dosis: string;
  hora_toma: string;
  frecuencia: number;
  proxima_toma: string;
}

export interface CrearRegistroTomaRequest {
  fecha_hora_programada: string;
  fecha_hora_real?: string | null;
  id_horario: number;
}

export interface ConfirmarRegistroTomaRequest {
  fecha_hora_real: string;
}

export interface RegistroTomaResponse {
  id: number;
  fecha_hora_programada: string;
  fecha_hora_real: string | null;
  id_horario: number;
  id_usuario: number;
}

export interface CrearContactoRequest {
  nombre: string;
  correo: string;
  telefono: string;
}

export interface ActualizarContactoRequest {
  nombre?: string;
  correo?: string;
  telefono?: string;
}

export interface ContactoResponse {
  id: number;
  nombre: string;
  correo: string;
  telefono: string;
  id_usuario: number;
}

export interface CrearDispositivoRequest {
  nombre: string;
  ip_esp32: string;
  estado_conexion?: boolean;
}

export interface ActualizarDispositivoRequest {
  nombre?: string;
  ip_esp32?: string;
  estado_conexion?: boolean;
}

export interface DispositivoResponse {
  id: number;
  nombre: string;
  ip_esp32: string;
  estado_conexion: boolean;
  id_usuario: number;
}

export interface CrearModuloRequest {
  id_dispositivo: number;
  numero_modulo: number;
  id_medicamento: number | null;
}

export interface ActualizarModuloRequest {
  id_dispositivo: number;
  numero_modulo: number;
  id_medicamento: number | null;
}

export interface ModuloResponse {
  id: number;
  id_dispositivo: number;
  dispositivo_nombre: string;
  numero_modulo: number;
  id_medicamento: number | null;
  medicamento_nombre: string | null;
}

export interface CrearNotificacionRequest {
  mensaje: string;
  id_registro: number;
  id_contacto: number;
}

export interface NotificacionResponse {
  id: number;
  mensaje: string;
  fecha_envio: string;
  id_registro: number;
  id_contacto: number;
}

export interface ApiErrorResponse {
  detail?: string;
  code?: string;
  [campo: string]: any;
}
