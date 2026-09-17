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
}

export interface MedicamentoResponse {
  id: number;
  nombre: string;
  descripcion: string;
  dosis: string;
  stock: number;
  id_usuario: number;
}

export interface MedicamentoCoberturaTratamiento {
  id_horario: number;
  tipo_duracion: TipoDuracion;
  cantidad_por_toma: number;
  consumo_diario: number;
  unidades_necesarias_restantes: number | null;
  activo: boolean;
}

export type EstadoStock = 'NORMAL' | 'BAJO' | 'CRITICO' | 'AGOTADO' | 'INSUFICIENTE_TRATAMIENTO';

export interface MedicamentoCoberturaResponse {
  id_medicamento: number;
  medicamento: string;
  stock_actual: number;
  consumo_diario: number;
  dias_cobertura: number | null;
  fecha_agotamiento_estimada: string | null;
  estado_stock: Exclude<EstadoStock, 'INSUFICIENTE_TRATAMIENTO'>;
  stock_suficiente_tratamiento: boolean;
  stock_suficiente: boolean;
  unidades_necesarias: number;
  faltantes: number;
  estado_tratamiento: EstadoStock | null;
  tratamientos: MedicamentoCoberturaTratamiento[];
}

export type TipoMovimientoStock =
  | 'TOMA_CONFIRMADA'
  | 'REPOSICION_MANUAL'
  | 'AJUSTE_INVENTARIO';

export interface MovimientoStockResponse {
  id: number;
  medicamento: number;
  registro_toma: number | null;
  cantidad: number;
  stock_anterior: number;
  stock_nuevo: number;
  tipo: TipoMovimientoStock;
  motivo: string;
  fecha_hora: string;
  usuario: number;
}

export interface ReponerStockRequest {
  cantidad: number;
}

export interface AjustarStockRequest {
  cantidad: number;
  motivo: string;
}

export interface CrearHorarioRequest {
  hora_toma: string;
  frecuencia: number;
  id_medicamento: number;
  cantidad_por_toma: number;
  fecha_inicio: string;
  tipo_duracion: TipoDuracion;
  duracion_dias?: number | null;
  fecha_fin?: string | null;
}

export interface ActualizarHorarioRequest {
  hora_toma?: string;
  frecuencia?: number;
  id_medicamento?: number;
  cantidad_por_toma?: number;
  fecha_inicio?: string;
  tipo_duracion?: TipoDuracion;
  duracion_dias?: number | null;
  fecha_fin?: string | null;
  activo?: boolean;
}

export type TipoDuracion = 'DIAS' | 'FECHA' | 'INDEFINIDO';

export interface HorarioResponse {
  id: number;
  hora_toma: string;
  frecuencia: number;
  id_medicamento: number;
  medicamento_nombre: string;
  proxima_toma: string | null;
  cantidad_por_toma: number;
  fecha_inicio: string;
  tipo_duracion: TipoDuracion;
  duracion_dias: number | null;
  fecha_fin: string | null;
  activo: boolean;
  eliminado: boolean;
}

export interface ProximaTomaItem {
  id_horario: number;
  id_medicamento: number;
  medicamento: string;
  dosis: string;
  hora_toma: string;
  frecuencia: number;
  cantidad_por_toma: number;
  proxima_toma: string;
}

export interface RegistroTomaResponse {
  id: number;
  fecha_hora_programada: string;
  fecha_hora_real: string | null;
  id_horario: number;
  id_usuario: number;
}

export interface CrearRegistroTomaRequest {
  fecha_hora_programada: string;
  id_horario: number;
}

export interface IoTConfirmarTomaRequest {
  evento_id: string;
  fecha_hora_real: string;
}

export interface IoTConfirmarTomaResponse {
  ok: boolean;
  duplicado: boolean;
  registro_id: number | null;
  detail?: string;
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
  identificador: string;
  ultimo_latido: string | null;
  version_firmware: string;
  rssi: number | null;
  id_usuario: number;
}

export interface AsignacionDispositivoResponse {
  id: number;
  dispositivo: number;
  id_horario: number;
  medicamento: string;
  fecha_actualizacion: string;
}

export interface CredencialDispositivoResponse {
  device_id: string;
  device_token: string;
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

export interface UsuarioResumenResponse {
  id: number;
  nombre: string;
  correo: string;
}

export type EstadoVinculacion = 'PENDIENTE' | 'ACEPTADA' | 'RECHAZADA';

export interface CrearVinculacionRequest {
  correo_monitor: string;
}

export interface ActualizarVinculacionRequest {
  puede_ver_medicamentos?: boolean;
  puede_ver_horarios?: boolean;
  puede_ver_registros?: boolean;
}

export interface VinculacionResponse {
  id: number;
  titular: UsuarioResumenResponse;
  monitor: UsuarioResumenResponse;
  estado: EstadoVinculacion;
  puede_ver_medicamentos: boolean;
  puede_ver_horarios: boolean;
  puede_ver_registros: boolean;
  fecha_creacion: string;
  fecha_respuesta: string | null;
}

export interface ApiErrorResponse {
  detail?: string;
  code?: string;
  [campo: string]: any;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
  page_size?: number;
}
