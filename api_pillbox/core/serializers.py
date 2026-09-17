from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.settings import api_settings
from rest_framework_simplejwt.exceptions import AuthenticationFailed
from django.contrib.auth.hashers import check_password, make_password
from datetime import date, timedelta
from django.utils import timezone
from .models import (
    Usuario,
    Dispositivo,
    Medicamento,
    Modulo,
    Horario,
    Registro_Toma,
    MovimientoStock,
    AsignacionDispositivo,
    WebPushSubscription,
    VinculacionMonitor,
)
from . import vinculaciones

class UsuarioSerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        write_only=True,
        required=False,
        style={'input_type': 'password'},
        help_text='Contraseña en texto plano. Obligatoria al crear el usuario; opcional al actualizar (si se omite, se conserva la actual).'
    )

    class Meta:
        model = Usuario
        fields = ['id', 'nombre', 'correo', 'password', 'telefono', 'activo', 'fecha_creacion']
        extra_kwargs = {
            'fecha_creacion': {'read_only': True},
        }

    def validate_correo(self, value):
        if not value:
            raise serializers.ValidationError('El correo es obligatorio.')
        return value.lower().strip()

    def validate_telefono(self, value):
        if not value.isdigit():
            raise serializers.ValidationError('El teléfono solo debe contener números.')
        return value

    def create(self, validated_data):
        password = validated_data.pop('password', None)
        if not password:
            raise serializers.ValidationError({'password': 'Este campo es obligatorio al crear un usuario.'})
        validated_data['password'] = make_password(password)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        if password:
            instance.password = make_password(password)
        return super().update(instance, validated_data)


class DispositivoSerializer(serializers.ModelSerializer):
    estado_conexion = serializers.SerializerMethodField()

    class Meta:
        model = Dispositivo
        fields = ['id', 'nombre', 'ip_esp32', 'estado_conexion', 'identificador', 'ultimo_latido', 'version_firmware', 'rssi', 'id_usuario']
        extra_kwargs = {
            'id_usuario': {'read_only': True},
            'identificador': {'read_only': True},
            'ultimo_latido': {'read_only': True},
            'version_firmware': {'read_only': True},
            'rssi': {'read_only': True},
        }

    def get_estado_conexion(self, obj):
        return bool(obj.ultimo_latido and obj.ultimo_latido >= timezone.now() - timedelta(seconds=90))


class AsignacionDispositivoSerializer(serializers.ModelSerializer):
    medicamento = serializers.CharField(source='id_horario.id_medicamento.nombre', read_only=True)

    class Meta:
        model = AsignacionDispositivo
        fields = ['id', 'dispositivo', 'id_horario', 'medicamento', 'fecha_actualizacion']
        extra_kwargs = {'dispositivo': {'read_only': True}, 'fecha_actualizacion': {'read_only': True}}

    def validate_id_horario(self, value):
        dispositivo = self.context.get('dispositivo')
        if dispositivo and value.id_medicamento.id_usuario_id != dispositivo.id_usuario_id:
            raise serializers.ValidationError('El horario no pertenece al propietario del dispositivo.')
        return value


class MedicamentoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Medicamento
        fields = ['id', 'nombre', 'descripcion', 'dosis', 'stock', 'id_usuario']
        extra_kwargs = {
            'id_usuario': {'read_only': True},
        }

class ReponerStockSerializer(serializers.Serializer):
    cantidad = serializers.IntegerField(min_value=1)


class AjustarStockSerializer(serializers.Serializer):
    cantidad = serializers.IntegerField()
    motivo = serializers.CharField(max_length=1000, allow_blank=False, trim_whitespace=True)


class MovimientoStockSerializer(serializers.ModelSerializer):
    class Meta:
        model = MovimientoStock
        fields = [
            'id', 'medicamento', 'registro_toma', 'cantidad', 'stock_anterior',
            'stock_nuevo', 'tipo', 'motivo', 'fecha_hora', 'usuario',
        ]
        read_only_fields = fields


class ModuloSerializer(serializers.ModelSerializer):
    medicamento_nombre = serializers.CharField(source='id_medicamento.nombre', read_only=True, allow_null=True)
    dispositivo_nombre = serializers.CharField(source='id_dispositivo.nombre', read_only=True)

    class Meta:
        model = Modulo
        fields = ['id', 'id_dispositivo', 'dispositivo_nombre', 'numero_modulo', 'id_medicamento', 'medicamento_nombre']
        # Desactivar el UniqueTogetherValidator auto-generado por DRF para que
        # la validación personalizada en validate() controle el mensaje de error.
        validators = []

    def validate_id_dispositivo(self, value):
        request = self.context.get('request')
        if request and hasattr(request, 'user') and request.user.is_authenticated:
            if value.id_usuario_id != request.user.id:
                raise serializers.ValidationError('El dispositivo especificado no pertenece al usuario autenticado.')
        return value

    def validate_id_medicamento(self, value):
        if value is None:
            return value
        request = self.context.get('request')
        if request and hasattr(request, 'user') and request.user.is_authenticated:
            if value.id_usuario_id != request.user.id:
                raise serializers.ValidationError('El medicamento especificado no pertenece al usuario autenticado.')
        return value

    def validate(self, attrs):
        instance = self.instance

        id_dispositivo = attrs.get('id_dispositivo', instance.id_dispositivo if instance else None)
        numero_modulo = attrs.get('numero_modulo', instance.numero_modulo if instance else None)

        if 'id_medicamento' in attrs:
            id_medicamento = attrs.get('id_medicamento')
        else:
            id_medicamento = instance.id_medicamento if instance else None

        # 1. Validar unicidad (id_dispositivo, numero_modulo)
        if id_dispositivo and numero_modulo is not None:
            qs_dup = Modulo.objects.filter(id_dispositivo=id_dispositivo, numero_modulo=numero_modulo)
            if instance:
                qs_dup = qs_dup.exclude(id=instance.id)
            if qs_dup.exists():
                raise serializers.ValidationError({
                    'numero_modulo': f'El módulo número {numero_modulo} ya existe en este dispositivo.'
                })

        # 2. Validar OneToOne (id_medicamento no asignado a otro módulo)
        if id_medicamento:
            qs_med = Modulo.objects.filter(id_medicamento=id_medicamento)
            if instance:
                qs_med = qs_med.exclude(id=instance.id)
            if qs_med.exists():
                raise serializers.ValidationError({
                    'id_medicamento': 'Este medicamento ya se encuentra asignado a otro módulo.'
                })

        return attrs


class HorarioSerializer(serializers.ModelSerializer):
    medicamento_nombre = serializers.CharField(source='id_medicamento.nombre', read_only=True)
    frecuencia = serializers.IntegerField(min_value=0)
    cantidad_por_toma = serializers.IntegerField(min_value=1)
    proxima_toma = serializers.ReadOnlyField()

    class Meta:
        model = Horario
        fields = [
            'id', 'hora_toma', 'frecuencia', 'id_medicamento', 'medicamento_nombre',
            'cantidad_por_toma', 'fecha_inicio', 'tipo_duracion', 'duracion_dias',
            'fecha_fin', 'activo', 'eliminado', 'proxima_toma',
        ]
        read_only_fields = [
            'activo', 'eliminado', 'proxima_toma', 'medicamento_nombre',
        ]
    def validate(self, attrs):
        instance = self.instance
        values = {
            'cantidad_por_toma': attrs.get('cantidad_por_toma', instance.cantidad_por_toma if instance else 1),
            'fecha_inicio': attrs.get('fecha_inicio', instance.fecha_inicio if instance else date(2000, 1, 1)),
            'tipo_duracion': attrs.get('tipo_duracion', instance.tipo_duracion if instance else Horario.TipoDuracion.INDEFINIDO),
            'duracion_dias': attrs.get('duracion_dias', instance.duracion_dias if instance else None),
            'fecha_fin': attrs.get('fecha_fin', instance.fecha_fin if instance else None),
        }
        if values['tipo_duracion'] == Horario.TipoDuracion.DIAS:
            if values['duracion_dias'] is None or values['duracion_dias'] < 1:
                raise serializers.ValidationError({'duracion_dias': 'La duración debe ser un entero positivo.'})
            if values['fecha_fin'] is not None:
                raise serializers.ValidationError({'fecha_fin': 'No corresponde para duración por días.'})
        elif values['tipo_duracion'] == Horario.TipoDuracion.FECHA:
            if values['fecha_fin'] is None:
                raise serializers.ValidationError({'fecha_fin': 'La fecha de finalización es obligatoria.'})
            if values['fecha_inicio'] and values['fecha_fin'] < values['fecha_inicio']:
                raise serializers.ValidationError({'fecha_fin': 'No puede ser anterior a la fecha de inicio.'})
            if values['duracion_dias'] is not None:
                raise serializers.ValidationError({'duracion_dias': 'No corresponde para duración por fecha.'})
        elif values['tipo_duracion'] == Horario.TipoDuracion.INDEFINIDO:
            if values['duracion_dias'] is not None or values['fecha_fin'] is not None:
                raise serializers.ValidationError('Un tratamiento indefinido no debe tener fecha_fin ni duracion_dias.')
        return attrs

    def validate_id_medicamento(self, value):
        request = self.context.get('request')
        if request and hasattr(request, 'user') and request.user.is_authenticated:
            if value.id_usuario_id != request.user.id:
                raise serializers.ValidationError('El medicamento especificado no pertenece al usuario autenticado.')
        return value


class RegistroTomaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Registro_Toma
        fields = ['id', 'fecha_hora_programada', 'fecha_hora_real', 'id_horario', 'id_usuario']
        extra_kwargs = {
            'id_usuario': {'read_only': True}
        }

    def validate_id_horario(self, value):
        request = self.context.get('request')
        if request and hasattr(request, 'user') and request.user.is_authenticated:
            if value.id_medicamento.id_usuario_id != request.user.id:
                raise serializers.ValidationError('El horario especificado no pertenece a los medicamentos del usuario autenticado.')
        return value


class WebPushSubscriptionSerializer(serializers.ModelSerializer):
    keys = serializers.SerializerMethodField()

    class Meta:
        model = WebPushSubscription
        fields = ['id', 'endpoint', 'keys', 'active', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_keys(self, obj):
        return {'auth': obj.auth, 'p256dh': obj.p256dh}


class UsuarioResumenSerializer(serializers.ModelSerializer):
    """Versión reducida de Usuario para exponer a la otra parte de una
    vinculación: nunca se filtran teléfono/estado de la cuenta ajena."""

    class Meta:
        model = Usuario
        fields = ['id', 'nombre', 'correo']
        read_only_fields = fields


class VinculacionMonitorSerializer(serializers.ModelSerializer):
    titular = UsuarioResumenSerializer(read_only=True)
    monitor = UsuarioResumenSerializer(read_only=True)
    correo_monitor = serializers.EmailField(write_only=True, required=False)

    class Meta:
        model = VinculacionMonitor
        fields = [
            'id', 'titular', 'monitor', 'correo_monitor', 'estado',
            'puede_ver_medicamentos', 'puede_ver_horarios', 'puede_ver_registros',
            'fecha_creacion', 'fecha_respuesta',
        ]
        read_only_fields = ['estado', 'fecha_creacion', 'fecha_respuesta']

    def create(self, validated_data):
        request = self.context['request']
        correo_monitor = validated_data.pop('correo_monitor', '').lower().strip()

        if not correo_monitor:
            raise serializers.ValidationError({'correo_monitor': 'El correo del monitor es obligatorio.'})
        if correo_monitor == request.user.correo.lower():
            raise serializers.ValidationError({'correo_monitor': 'No puedes invitarte a ti mismo.'})

        try:
            monitor = Usuario.objects.get(correo=correo_monitor)
        except Usuario.DoesNotExist:
            raise serializers.ValidationError(
                {'correo_monitor': 'No existe ninguna cuenta de Pillbox con ese correo.'}
            )

        vinculacion, creada = VinculacionMonitor.objects.get_or_create(
            titular=request.user,
            monitor=monitor,
            defaults={
                'puede_ver_medicamentos': validated_data.get('puede_ver_medicamentos', True),
                'puede_ver_horarios': validated_data.get('puede_ver_horarios', True),
                'puede_ver_registros': validated_data.get('puede_ver_registros', True),
            },
        )
        if not creada:
            vinculacion.estado = VinculacionMonitor.Estado.PENDIENTE
            vinculacion.fecha_respuesta = None
            vinculacion.save(update_fields=['estado', 'fecha_respuesta'])

        vinculaciones.enviar_invitacion(vinculacion)
        return vinculacion


class UsuarioTokenObtainPairSerializer(serializers.Serializer):
    correo = serializers.EmailField(required=True)
    password = serializers.CharField(write_only=True, required=True, style={'input_type': 'password'})

    def validate(self, attrs):
        correo = attrs.get('correo', '').lower().strip()
        password = attrs.get('password', '')

        if not correo or not password:
            raise serializers.ValidationError({'detail': 'Debe proporcionar correo y contraseña'})

        try:
            usuario = Usuario.objects.get(correo=correo)
        except Usuario.DoesNotExist:
            raise AuthenticationFailed('Credenciales inválidas', 'no_active_account')

        if not usuario.activo:
            raise AuthenticationFailed('El usuario está inactivo', 'user_inactive')

        valido = False
        if check_password(password, usuario.password):
            valido = True
        elif usuario.password == password:
            # Soporte de migración transparente retrocompatible
            usuario.password = make_password(password)
            usuario.save(update_fields=['password'])
            valido = True

        if not valido:
            raise AuthenticationFailed('Credenciales inválidas', 'no_active_account')

        refresh = RefreshToken.for_user(usuario)

        return {
            'refresh': str(refresh),
            'access': str(refresh.access_token),
            'usuario': {
                'id': usuario.id,
                'nombre': usuario.nombre,
                'correo': usuario.correo,
                'telefono': usuario.telefono,
            }
        }


class UsuarioTokenRefreshSerializer(TokenRefreshSerializer):
    def validate(self, attrs):
        refresh = self.token_class(attrs['refresh'])
        data = {'access': str(refresh.access_token)}

        if api_settings.ROTATE_REFRESH_TOKENS:
            if api_settings.BLACKLIST_AFTER_ROTATION:
                try:
                    refresh.blacklist()
                except AttributeError:
                    pass
            refresh.set_jti()
            refresh.set_exp()
            refresh.set_iat()
            data['refresh'] = str(refresh)

        if api_settings.CHECK_USER_IS_ACTIVE:
            try:
                user = Usuario.objects.get(**{api_settings.USER_ID_FIELD: refresh[api_settings.USER_ID_CLAIM]})
            except Usuario.DoesNotExist:
                raise AuthenticationFailed('Usuario no encontrado', 'user_not_found')
            if not user.is_active:
                raise AuthenticationFailed('Usuario inactivo', 'user_inactive')

        return data
