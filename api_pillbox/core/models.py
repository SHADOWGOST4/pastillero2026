import math
import uuid
from django.db import models
from django.utils import timezone
from datetime import date, datetime, timedelta


class Usuario(models.Model):
    nombre = models.CharField(max_length=100)
    correo = models.EmailField(unique=True)
    password = models.CharField(max_length=255)
    telefono = models.CharField(max_length=15)
    activo = models.BooleanField(default=True)
    correo_verificado = models.BooleanField(default=False)
    fecha_creacion = models.DateTimeField(default=timezone.now)

    @property
    def is_authenticated(self):
        return True

    @property
    def is_anonymous(self):
        return False

    @property
    def is_active(self):
        return self.activo

    def __str__(self):
        return self.nombre


class Dispositivo(models.Model):
    nombre = models.CharField(max_length=100)
    # Informativa: la IP cambia y nunca se usa como identidad ni credencial.
    ip_esp32 = models.CharField(max_length=100, blank=True)
    estado_conexion = models.BooleanField(default=False)
    identificador = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    token_dispositivo_hash = models.CharField(max_length=255, blank=True)
    ultimo_latido = models.DateTimeField(null=True, blank=True)
    version_firmware = models.CharField(max_length=50, blank=True)
    rssi = models.IntegerField(null=True, blank=True)
    id_usuario = models.ForeignKey(Usuario, on_delete=models.CASCADE, related_name='dispositivos')

    def __str__(self):
        return self.nombre


class Medicamento(models.Model):
    nombre = models.CharField(max_length=100)
    descripcion = models.TextField(blank=True)
    dosis = models.CharField(max_length=50)
    stock = models.PositiveIntegerField(default=0)
    id_usuario = models.ForeignKey(Usuario, on_delete=models.CASCADE, related_name='medicamentos')

    def __str__(self):
        return self.nombre


class Modulo(models.Model):
    id_dispositivo = models.ForeignKey(
        Dispositivo,
        on_delete=models.CASCADE,
        related_name='modulos'
    )
    numero_modulo = models.PositiveIntegerField(
        help_text="Número físico o posición del módulo dentro del pastillero"
    )
    id_medicamento = models.OneToOneField(
        Medicamento,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='modulo',
        help_text="Medicamento asignado al módulo"
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['id_dispositivo', 'numero_modulo'],
                name='unique_modulo_por_dispositivo'
            )
        ]
        ordering = ['id_dispositivo', 'numero_modulo']

    def __str__(self):
        medicamento = (
            self.id_medicamento.nombre
            if self.id_medicamento
            else "Disponible"
        )
        return (
            f"{self.id_dispositivo.nombre} - "
            f"Módulo {self.numero_modulo} ({medicamento})"
        )


class Horario(models.Model):
    class TipoDuracion(models.TextChoices):
        DIAS = 'DIAS', 'Número de días'
        FECHA = 'FECHA', 'Hasta una fecha'
        INDEFINIDO = 'INDEFINIDO', 'Indefinido'

    hora_toma = models.TimeField()
    # frecuencia: número de horas entre tomas (ej: 4, 6, 8, 12, 24)
    # default=0 para migraciones de datos existentes (ver instrucciones).
    frecuencia = models.PositiveIntegerField(default=0)
    id_medicamento = models.ForeignKey(Medicamento, on_delete=models.CASCADE, related_name='horarios')
    cantidad_por_toma = models.PositiveIntegerField(default=1)
    fecha_inicio = models.DateField(default=date(2000, 1, 1))
    tipo_duracion = models.CharField(max_length=12, choices=TipoDuracion.choices, default=TipoDuracion.INDEFINIDO)
    duracion_dias = models.PositiveIntegerField(null=True, blank=True)
    fecha_fin = models.DateField(null=True, blank=True)
    activo = models.BooleanField(default=True)
    eliminado = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.id_medicamento.nombre} - {self.hora_toma}"

    def clean(self):
        from django.core.exceptions import ValidationError

        errors = {}
        if self.cantidad_por_toma is None or self.cantidad_por_toma < 1:
            errors['cantidad_por_toma'] = 'La cantidad por toma debe ser un entero positivo.'
        if not self.fecha_inicio:
            errors['fecha_inicio'] = 'La fecha de inicio es obligatoria.'

        if self.tipo_duracion == self.TipoDuracion.DIAS:
            if self.duracion_dias is None or self.duracion_dias < 1:
                errors['duracion_dias'] = 'La duración debe ser un entero positivo.'
            if self.fecha_fin is not None:
                errors['fecha_fin'] = 'No debes enviar fecha_fin para una duración por días.'
        elif self.tipo_duracion == self.TipoDuracion.FECHA:
            if not self.fecha_fin:
                errors['fecha_fin'] = 'La fecha de finalización es obligatoria.'
            elif self.fecha_inicio and self.fecha_fin < self.fecha_inicio:
                errors['fecha_fin'] = 'La fecha de finalización no puede ser anterior al inicio.'
            if self.duracion_dias is not None:
                errors['duracion_dias'] = 'No debes enviar duracion_dias para una duración por fecha.'
        elif self.tipo_duracion == self.TipoDuracion.INDEFINIDO:
            if self.duracion_dias is not None:
                errors['duracion_dias'] = 'No debes enviar duracion_dias para un tratamiento indefinido.'
            if self.fecha_fin is not None:
                errors['fecha_fin'] = 'No debes enviar fecha_fin para un tratamiento indefinido.'

        if errors:
            raise ValidationError(errors)

    def calcular_proxima_toma(self, now_local=None):
        """Calcula y devuelve el siguiente DateTime consciente (timezone-aware en America/Bogota) estrictamente mayor a now_local.

        Si now_local no es proporcionado, se utiliza la hora actual local: timezone.localtime().
        """
        if not self.activo or self.eliminado:
            return None
        if now_local is None:
            now_local = timezone.localtime()
        tz = timezone.get_current_timezone()

        if timezone.is_naive(now_local):
            now_local = timezone.make_aware(now_local, tz)
        else:
            now_local = now_local.astimezone(tz)

        start_anchor = timezone.make_aware(datetime.combine(self.fecha_inicio, self.hora_toma), tz)
        if now_local < start_anchor:
            next_dt = start_anchor
        else:
            today_anchor = timezone.make_aware(datetime.combine(now_local.date(), self.hora_toma), tz)
            if not self.frecuencia or self.frecuencia <= 0 or self.frecuencia >= 24:
                next_dt = today_anchor if today_anchor > now_local else today_anchor + timedelta(days=1)
            else:
                step_seconds = self.frecuencia * 3600
                delta_seconds = (now_local - start_anchor).total_seconds()
                k = math.floor(delta_seconds / step_seconds) + 1
                next_dt = start_anchor + timedelta(hours=k * self.frecuencia)

        if self.tipo_duracion == self.TipoDuracion.DIAS:
            if next_dt.date() >= self.fecha_inicio + timedelta(days=self.duracion_dias):
                return None
        elif self.tipo_duracion == self.TipoDuracion.FECHA:
            if next_dt.date() > self.fecha_fin:
                return None

        return next_dt.astimezone(tz)

    @property
    def proxima_toma(self):
        """Devuelve el siguiente DateTime (timezone-aware en America/Bogota) estrictamente mayor a ahora."""
        return self.calcular_proxima_toma()


class Registro_Toma(models.Model):
    fecha_hora_programada = models.DateTimeField()
    fecha_hora_real = models.DateTimeField(null=True, blank=True)
    id_horario = models.ForeignKey(Horario, on_delete=models.CASCADE, related_name='registros')
    id_usuario = models.ForeignKey(Usuario, on_delete=models.CASCADE, related_name='registros')

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['id_usuario', 'id_horario', 'fecha_hora_programada'],
                name='registro_toma_unico_por_horario_instante',
            )
        ]

    def __str__(self):
        return f"{self.id_usuario.nombre} - {self.fecha_hora_programada}"


class MovimientoStock(models.Model):
    class Tipo(models.TextChoices):
        TOMA_CONFIRMADA = 'TOMA_CONFIRMADA', 'Toma confirmada'
        REPOSICION_MANUAL = 'REPOSICION_MANUAL', 'Reposición manual'
        AJUSTE_INVENTARIO = 'AJUSTE_INVENTARIO', 'Ajuste de inventario'

    medicamento = models.ForeignKey(Medicamento, on_delete=models.PROTECT, related_name='movimientos_stock')
    registro_toma = models.OneToOneField(
        Registro_Toma,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='movimiento_stock',
    )
    cantidad = models.IntegerField()
    stock_anterior = models.PositiveIntegerField()
    stock_nuevo = models.PositiveIntegerField()
    tipo = models.CharField(max_length=30, choices=Tipo.choices)
    motivo = models.TextField(blank=True, default='')
    fecha_hora = models.DateTimeField(auto_now_add=True)
    usuario = models.ForeignKey(Usuario, on_delete=models.PROTECT, related_name='movimientos_stock')

    def clean(self):
        from django.core.exceptions import ValidationError

        errors = {}
        if self.stock_nuevo != self.stock_anterior + self.cantidad:
            errors['stock_nuevo'] = 'Debe ser igual a stock_anterior + cantidad.'
        if self.tipo == self.Tipo.TOMA_CONFIRMADA and self.registro_toma_id is None:
            errors['registro_toma'] = 'Las tomas confirmadas requieren un registro.'
        if self.tipo != self.Tipo.TOMA_CONFIRMADA and self.registro_toma_id is not None:
            errors['registro_toma'] = 'Solo las tomas confirmadas pueden asociarse a un registro.'
        if self.tipo == self.Tipo.REPOSICION_MANUAL and self.cantidad <= 0:
            errors['cantidad'] = 'La reposición debe ser positiva.'
        if self.tipo == self.Tipo.AJUSTE_INVENTARIO and self.cantidad == 0:
            errors['cantidad'] = 'El ajuste no puede ser cero.'
        if self.tipo == self.Tipo.AJUSTE_INVENTARIO and not self.motivo.strip():
            errors['motivo'] = 'El motivo es obligatorio para un ajuste.'
        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.medicamento.nombre}: {self.cantidad} ({self.tipo})"


class AsignacionDispositivo(models.Model):
    """MVP: un solo horario activo por ESP32; los módulos quedan preparados para escalar."""
    dispositivo = models.OneToOneField(Dispositivo, on_delete=models.CASCADE, related_name='asignacion')
    id_horario = models.ForeignKey(Horario, on_delete=models.CASCADE, related_name='asignaciones_dispositivo')
    fecha_actualizacion = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.dispositivo.nombre} -> {self.id_horario}"


class EventoDispositivo(models.Model):
    """Eventos idempotentes para permitir reintentos seguros tras cortes de red."""
    evento_id = models.UUIDField(unique=True)
    dispositivo = models.ForeignKey(Dispositivo, on_delete=models.CASCADE, related_name='eventos')
    tipo = models.CharField(max_length=40)
    fecha_dispositivo = models.DateTimeField()
    fecha_recibido = models.DateTimeField(auto_now_add=True)
    id_registro = models.ForeignKey(Registro_Toma, null=True, blank=True, on_delete=models.SET_NULL, related_name='eventos_dispositivo')


class WebPushSubscription(models.Model):
    usuario = models.ForeignKey(Usuario, on_delete=models.CASCADE, related_name='web_push_subscriptions')
    endpoint = models.URLField(max_length=2048)
    auth = models.CharField(max_length=255)
    p256dh = models.CharField(max_length=255)
    active = models.BooleanField(default=True)
    browser = models.CharField(max_length=50, blank=True, default='')
    user_agent = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['usuario', 'endpoint'], name='unique_webpush_subscription_usuario_endpoint')
        ]

    def __str__(self):
        return f"WebPushSubscription({self.usuario_id} @ {self.endpoint})"


class FcmSubscription(models.Model):
    """Token de Firebase Cloud Messaging de un dispositivo Android
    (Capacitor). Análogo a WebPushSubscription pero para push nativo, que es
    el único canal que llega con la app cerrada en el APK."""
    usuario = models.ForeignKey(Usuario, on_delete=models.CASCADE, related_name='fcm_subscriptions')
    token = models.CharField(max_length=255, unique=True)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"FcmSubscription({self.usuario_id} @ {self.token[:16]}…)"


class WebPushNotificationLog(models.Model):
    registro = models.OneToOneField(Registro_Toma, on_delete=models.CASCADE, related_name='web_push_log')
    evento_id = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    sent_at = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=20, default='sent')
    error = models.TextField(blank=True, default='')

    def __str__(self):
        return f"WebPushLog({self.registro_id}, {self.evento_id})"


class VinculacionMonitor(models.Model):
    """Permite que un usuario (monitor) vea, en solo lectura, ciertos datos
    de otro usuario (titular) que lo invitó y aceptó explícitamente."""

    class Estado(models.TextChoices):
        PENDIENTE = 'PENDIENTE', 'Pendiente'
        ACEPTADA = 'ACEPTADA', 'Aceptada'
        RECHAZADA = 'RECHAZADA', 'Rechazada'

    titular = models.ForeignKey(Usuario, on_delete=models.CASCADE, related_name='monitores')
    monitor = models.ForeignKey(Usuario, on_delete=models.CASCADE, related_name='titulares')
    estado = models.CharField(max_length=10, choices=Estado.choices, default=Estado.PENDIENTE)
    puede_ver_medicamentos = models.BooleanField(default=True)
    puede_ver_horarios = models.BooleanField(default=True)
    puede_ver_registros = models.BooleanField(default=True)
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    fecha_respuesta = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['titular', 'monitor'], name='unique_vinculacion_titular_monitor')
        ]

    def clean(self):
        from django.core.exceptions import ValidationError

        if self.titular_id == self.monitor_id:
            raise ValidationError('No puedes vincularte a ti mismo.')

    def __str__(self):
        return f"{self.monitor.nombre} monitorea a {self.titular.nombre} ({self.estado})"
