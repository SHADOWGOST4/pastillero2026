import math
from django.db import models
from django.utils import timezone
from datetime import datetime, timedelta


class Usuario(models.Model):
    nombre = models.CharField(max_length=100)
    correo = models.EmailField(unique=True)
    password = models.CharField(max_length=255)
    telefono = models.CharField(max_length=15)
    activo = models.BooleanField(default=True)
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


class Contacto(models.Model):
    nombre = models.CharField(max_length=100)
    correo = models.EmailField()
    telefono = models.CharField(max_length=15)
    id_usuario = models.ForeignKey(Usuario, on_delete=models.CASCADE, related_name='contactos')

    def __str__(self):
        return self.nombre


class Dispositivo(models.Model):
    nombre = models.CharField(max_length=100)
    ip_esp32 = models.CharField(max_length=100)
    estado_conexion = models.BooleanField(default=False)
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
    hora_toma = models.TimeField()
    # frecuencia: número de horas entre tomas (ej: 4, 6, 8, 12, 24)
    # default=0 para migraciones de datos existentes (ver instrucciones).
    frecuencia = models.PositiveIntegerField(default=0)
    id_medicamento = models.ForeignKey(Medicamento, on_delete=models.CASCADE, related_name='horarios')

    def __str__(self):
        return f"{self.id_medicamento.nombre} - {self.hora_toma}"

    def calcular_proxima_toma(self, now_local=None):
        """Calcula y devuelve el siguiente DateTime consciente (timezone-aware en America/Bogota) estrictamente mayor a now_local.

        Si now_local no es proporcionado, se utiliza la hora actual local: timezone.localtime().
        """
        if now_local is None:
            now_local = timezone.localtime()
        tz = timezone.get_current_timezone()

        if timezone.is_naive(now_local):
            now_local = timezone.make_aware(now_local, tz)
        else:
            now_local = now_local.astimezone(tz)

        naive_today_time = datetime.combine(now_local.date(), self.hora_toma)
        today_anchor = timezone.make_aware(naive_today_time, tz)

        # Frecuencia 0 o >= 24 (tomas diarias únicas)
        if not self.frecuencia or self.frecuencia <= 0 or self.frecuencia >= 24:
            if today_anchor > now_local:
                return today_anchor
            return today_anchor + timedelta(days=1)

        # Frecuencia periódica intradía (ej. 4, 6, 8, 12 horas)
        step_seconds = self.frecuencia * 3600
        delta_seconds = (now_local - today_anchor).total_seconds()
        k = math.floor(delta_seconds / step_seconds) + 1
        next_dt = today_anchor + timedelta(hours=k * self.frecuencia)

        # Garantizar que sea estrictamente mayor a now_local
        while not (next_dt > now_local):
            next_dt = next_dt + timedelta(hours=self.frecuencia)

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

    def __str__(self):
        return f"{self.id_usuario.nombre} - {self.fecha_hora_programada}"


class Notificacion(models.Model):
    mensaje = models.CharField(max_length=255)
    fecha_envio = models.DateTimeField(auto_now_add=True)
    id_registro = models.ForeignKey(Registro_Toma, on_delete=models.CASCADE, related_name='notificaciones')
    id_contacto = models.ForeignKey(Contacto, on_delete=models.CASCADE, related_name='notificaciones')

    def __str__(self):
        return f"Notif: {self.mensaje}"
