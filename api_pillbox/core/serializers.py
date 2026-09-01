from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.settings import api_settings
from rest_framework_simplejwt.exceptions import AuthenticationFailed
from django.contrib.auth.hashers import check_password, make_password
from .models import Usuario, Contacto, Dispositivo, Medicamento, Horario, Registro_Toma, Notificacion

class UsuarioSerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        write_only=True,
        required=True,
        style={'input_type': 'password'},
        help_text='Contraseña en texto plano para creación o actualización (se almacenará con hash seguro)'
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

    def create(self, validated_data):
        password = validated_data.pop('password')
        validated_data['password'] = make_password(password)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        if password:
            instance.password = make_password(password)
        return super().update(instance, validated_data)


class ContactoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Contacto
        fields = ['id', 'nombre', 'correo', 'telefono', 'id_usuario']
        extra_kwargs = {
            'id_usuario': {'read_only': True}
        }


class DispositivoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Dispositivo
        fields = ['id', 'nombre', 'ip_esp32', 'estado_conexion', 'id_usuario']
        extra_kwargs = {
            'id_usuario': {'read_only': True}
        }


class MedicamentoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Medicamento
        fields = ['id', 'nombre', 'descripcion', 'dosis', 'id_usuario']
        extra_kwargs = {
            'id_usuario': {'read_only': True}
        }


class HorarioSerializer(serializers.ModelSerializer):
    medicamento_nombre = serializers.CharField(source='id_medicamento.nombre', read_only=True)
    frecuencia = serializers.IntegerField(min_value=0)
    proxima_toma = serializers.ReadOnlyField()

    class Meta:
        model = Horario
        fields = ['id', 'hora_toma', 'frecuencia', 'id_medicamento', 'medicamento_nombre', 'proxima_toma']

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


class NotificacionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notificacion
        fields = ['id', 'mensaje', 'fecha_envio', 'id_registro', 'id_contacto']
        extra_kwargs = {
            'fecha_envio': {'read_only': True}
        }

    def validate(self, attrs):
        request = self.context.get('request')
        if request and hasattr(request, 'user') and request.user.is_authenticated:
            id_contacto = attrs.get('id_contacto')
            id_registro = attrs.get('id_registro')
            if id_contacto and id_contacto.id_usuario_id != request.user.id:
                raise serializers.ValidationError({'id_contacto': 'El contacto no pertenece al usuario autenticado.'})
            if id_registro and id_registro.id_usuario_id != request.user.id:
                raise serializers.ValidationError({'id_registro': 'El registro de toma no pertenece al usuario autenticado.'})
        return attrs


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

