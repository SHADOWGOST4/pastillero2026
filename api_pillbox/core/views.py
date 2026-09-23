from datetime import datetime, timedelta

from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password
from django.core import signing
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.db.models import Q
from django.utils import timezone

from rest_framework import serializers, status, viewsets
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.exceptions import PermissionDenied
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny, IsAuthenticated, SAFE_METHODS
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenViewBase

from . import verificacion, vinculaciones
from .inventory import calcular_cobertura_medicamento
from .models import (
    Dispositivo,
    EventoDispositivo,
    Horario,
    Medicamento,
    Modulo,
    MovimientoStock,
    Registro_Toma,
    Usuario,
    VinculacionMonitor,
    WebPushSubscription,
)
from .serializers import (
    AjustarStockSerializer,
    AsignacionDispositivoSerializer,
    DispositivoSerializer,
    HorarioSerializer,
    MedicamentoSerializer,
    ModuloSerializer,
    MovimientoStockSerializer,
    RegistroTomaSerializer,
    ReponerStockSerializer,
    UsuarioSerializer,
    UsuarioTokenObtainPairSerializer,
    UsuarioTokenRefreshSerializer,
    VinculacionMonitorSerializer,
)
from .stock import StockInsuficiente, ajustar_stock, confirmar_registro_con_stock, reponer_stock


def _titular_id_desde_request(request):
    """Lee y valida el parámetro `?titular=` (id del titular a consultar).
    Devuelve None si no viene en la petición."""
    titular_id = request.query_params.get('titular')
    if not titular_id:
        return None
    try:
        return int(titular_id)
    except ValueError:
        raise PermissionDenied('Parámetro titular inválido.')


class ResourcePagination(PageNumberPagination):
    """Paginación común para colecciones grandes del cliente web."""

    page_size = settings.PAGE_SIZE
    page_size_query_param = 'page_size'
    max_page_size = 100

    def get_paginated_response(self, data):
        response = super().get_paginated_response(data)
        response.data['page_size'] = self.page.paginator.per_page
        return response




@api_view(['POST'])
@permission_classes([AllowAny])
def registrar_usuario(request):
    serializer = UsuarioSerializer(data=request.data)
    if serializer.is_valid():
        usuario = serializer.save()
        verificacion.enviar_correo_verificacion(usuario)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([AllowAny])
def verificar_correo(request):
    """Confirma el token enviado por correo y marca la cuenta como
    verificada. No requiere sesión: el enlace del correo debe funcionar por
    sí solo."""
    token = request.data.get('token', '')
    if not token:
        return Response({'detail': 'Token requerido.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        usuario = verificacion.verificar_token(token)
    except signing.SignatureExpired:
        return Response(
            {'detail': 'El enlace de verificación expiró. Solicita uno nuevo.'},
            status=status.HTTP_400_BAD_REQUEST,
        )
    except (signing.BadSignature, ValueError, Usuario.DoesNotExist):
        return Response({'detail': 'El enlace de verificación no es válido.'}, status=status.HTTP_400_BAD_REQUEST)

    return Response({'detail': 'Correo verificado correctamente.', 'correo': usuario.correo})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def reenviar_verificacion(request):
    usuario = request.user
    if usuario.correo_verificado:
        return Response({'detail': 'Tu correo ya está verificado.'}, status=status.HTTP_400_BAD_REQUEST)
    verificacion.enviar_correo_verificacion(usuario)
    return Response({'detail': 'Te enviamos un nuevo correo de verificación.'})


class CustomTokenObtainPairView(TokenViewBase):
    """
    Endpoint para autenticación y obtención de tokens JWT (access + refresh)
    para el modelo Usuario.
    """
    permission_classes = [AllowAny]
    serializer_class = UsuarioTokenObtainPairSerializer


class CustomTokenRefreshView(TokenViewBase):
    """
    Endpoint para refrescar el access token a partir de un refresh token válido.
    """
    permission_classes = [AllowAny]
    serializer_class = UsuarioTokenRefreshSerializer


@api_view(['POST'])
@permission_classes([AllowAny])
def login_usuario(request):
    """
    Endpoint de login retrocompatible que emite tokens JWT (access + refresh)
    y los datos del usuario.
    """
    serializer = UsuarioTokenObtainPairSerializer(data=request.data)
    if serializer.is_valid():
        return Response(serializer.validated_data, status=status.HTTP_200_OK)
    return Response(serializer.errors, status=status.HTTP_401_UNAUTHORIZED)




class UsuarioViewSet(viewsets.ModelViewSet):
    """
    Permite al usuario autenticado consultar o modificar únicamente su propio perfil.
    """
    serializer_class = UsuarioSerializer
    permission_classes = [IsAuthenticated]
    queryset = Usuario.objects.none()

    def get_queryset(self):
        return Usuario.objects.filter(id=self.request.user.id)


class DispositivoViewSet(viewsets.ModelViewSet):
    serializer_class = DispositivoSerializer
    permission_classes = [IsAuthenticated]
    queryset = Dispositivo.objects.none()

    def get_queryset(self):
        return Dispositivo.objects.filter(id_usuario=self.request.user)

    def perform_create(self, serializer):
        serializer.save(id_usuario=self.request.user)

    @action(detail=True, methods=['get', 'put', 'delete'], url_path='asignacion')
    def asignacion(self, request, pk=None):
        dispositivo = self.get_object()
        asignacion = getattr(dispositivo, 'asignacion', None)
        if request.method == 'GET':
            return Response(AsignacionDispositivoSerializer(asignacion).data) if asignacion else Response(status=status.HTTP_404_NOT_FOUND)
        if request.method == 'DELETE':
            if asignacion:
                asignacion.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        serializer = AsignacionDispositivoSerializer(asignacion, data=request.data, context={'dispositivo': dispositivo})
        serializer.is_valid(raise_exception=True)
        serializer.save(dispositivo=dispositivo)
        return Response(serializer.data, status=status.HTTP_200_OK if asignacion else status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='generar-credencial')
    def generar_credencial(self, request, pk=None):
        import secrets
        dispositivo = self.get_object()
        token = secrets.token_urlsafe(32)
        dispositivo.token_dispositivo_hash = make_password(token)
        dispositivo.save(update_fields=['token_dispositivo_hash'])
        return Response({'device_id': str(dispositivo.identificador), 'device_token': token})


class MedicamentoViewSet(viewsets.ModelViewSet):
    serializer_class = MedicamentoSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = ResourcePagination
    queryset = Medicamento.objects.none()

    def get_queryset(self):
        titular_id = _titular_id_desde_request(self.request)
        if titular_id is not None and self.request.method in SAFE_METHODS:
            if titular_id != self.request.user.id and not vinculaciones.tiene_permiso(
                self.request.user, titular_id, 'puede_ver_medicamentos'
            ):
                raise PermissionDenied('No tienes acceso a los medicamentos de este usuario.')
            return Medicamento.objects.filter(id_usuario_id=titular_id).order_by('id')
        return Medicamento.objects.filter(id_usuario=self.request.user).order_by('id')

    def perform_create(self, serializer):
        serializer.save(id_usuario=self.request.user)

    def perform_update(self, serializer):
        stock_requested = 'stock' in serializer.validated_data
        with transaction.atomic():
            medicamento = Medicamento.objects.select_for_update().get(
                id=serializer.instance.id,
                id_usuario=self.request.user,
            )
            stock_anterior = medicamento.stock
            serializer.instance = medicamento
            serializer.save()
            if stock_requested and medicamento.stock != stock_anterior:
                MovimientoStock.objects.create(
                    medicamento=medicamento,
                    cantidad=medicamento.stock - stock_anterior,
                    stock_anterior=stock_anterior,
                    stock_nuevo=medicamento.stock,
                    tipo=MovimientoStock.Tipo.AJUSTE_INVENTARIO,
                    motivo='Corrección administrativa',
                    usuario=self.request.user,
                )

    @action(detail=True, methods=['get'], url_path='cobertura')
    def cobertura(self, request, pk=None):
        medicamento = self.get_object()
        return Response(calcular_cobertura_medicamento(medicamento))

    @action(detail=True, methods=['post'], url_path='reponer')
    def reponer(self, request, pk=None):
        medicamento = self.get_object()
        serializer = ReponerStockSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        movimiento = reponer_stock(
            medicamento.id,
            request.user,
            serializer.validated_data['cantidad'],
        )
        return Response(MovimientoStockSerializer(movimiento).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='ajustar-stock')
    def ajustar_stock(self, request, pk=None):
        medicamento = self.get_object()
        serializer = AjustarStockSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            movimiento = ajustar_stock(
                medicamento.id,
                request.user,
                serializer.validated_data['cantidad'],
                serializer.validated_data['motivo'],
            )
        except StockInsuficiente as exc:
            return Response(exc.detail, status=exc.status_code)
        return Response(MovimientoStockSerializer(movimiento).data, status=status.HTTP_201_CREATED)


class MovimientoStockViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = MovimientoStockSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = ResourcePagination
    queryset = MovimientoStock.objects.none()

    def get_queryset(self):
        queryset = MovimientoStock.objects.filter(
            usuario=self.request.user,
        ).select_related('medicamento', 'registro_toma').order_by('-fecha_hora', '-id')
        medicamento = self.request.query_params.get('medicamento')
        tipo = self.request.query_params.get('tipo')
        if medicamento:
            queryset = queryset.filter(medicamento_id=medicamento)
        if tipo:
            queryset = queryset.filter(tipo=tipo)
        return queryset


class ModuloViewSet(viewsets.ModelViewSet):
    serializer_class = ModuloSerializer
    permission_classes = [IsAuthenticated]
    queryset = Modulo.objects.none()

    def get_queryset(self):
        return Modulo.objects.filter(id_dispositivo__id_usuario=self.request.user)

    def perform_create(self, serializer):
        dispositivo = serializer.validated_data.get('id_dispositivo')
        if dispositivo.id_usuario_id != self.request.user.id:
            raise serializers.ValidationError({'id_dispositivo': 'El dispositivo no pertenece al usuario autenticado.'})
        medicamento = serializer.validated_data.get('id_medicamento')
        if medicamento and medicamento.id_usuario_id != self.request.user.id:
            raise serializers.ValidationError({'id_medicamento': 'El medicamento no pertenece al usuario autenticado.'})
        serializer.save()


class HorarioViewSet(viewsets.ModelViewSet):
    serializer_class = HorarioSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = ResourcePagination
    queryset = Horario.objects.none()

    def get_queryset(self):
        titular_id = _titular_id_desde_request(self.request)
        if titular_id is not None and self.request.method in SAFE_METHODS:
            if titular_id != self.request.user.id and not vinculaciones.tiene_permiso(
                self.request.user, titular_id, 'puede_ver_horarios'
            ):
                raise PermissionDenied('No tienes acceso a los horarios de este usuario.')
            return Horario.objects.filter(
                id_medicamento__id_usuario_id=titular_id,
                eliminado=False,
            ).order_by('id')
        return Horario.objects.filter(
            id_medicamento__id_usuario=self.request.user,
            eliminado=False,
        ).order_by('id')

    def perform_create(self, serializer):
        medicamento = serializer.validated_data.get('id_medicamento')
        if medicamento.id_usuario_id != self.request.user.id:
            raise serializers.ValidationError({'id_medicamento': 'El medicamento no pertenece al usuario autenticado.'})
        serializer.save()

    @action(detail=True, methods=['post'], url_path='activar')
    def activar(self, request, pk=None):
        horario = self.get_object()
        if horario.activo:
            return Response(HorarioSerializer(horario, context={'request': request}).data)
        horario.activo = True
        horario.save(update_fields=['activo'])
        return Response(HorarioSerializer(horario, context={'request': request}).data)

    @action(detail=True, methods=['post'], url_path='deshabilitar')
    def deshabilitar(self, request, pk=None):
        horario = self.get_object()
        if horario.activo:
            horario.activo = False
            horario.save(update_fields=['activo'])
        return Response(HorarioSerializer(horario, context={'request': request}).data)

    def destroy(self, request, *args, **kwargs):
        horario = self.get_object()
        horario.activo = False
        horario.eliminado = True
        horario.save(update_fields=['activo', 'eliminado'])
        return Response(status=status.HTTP_204_NO_CONTENT)


class RegistroTomaViewSet(viewsets.ModelViewSet):
    serializer_class = RegistroTomaSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = ResourcePagination
    queryset = Registro_Toma.objects.none()

    def get_queryset(self):
        titular_id = _titular_id_desde_request(self.request)
        if titular_id is not None and self.request.method in SAFE_METHODS:
            if titular_id != self.request.user.id and not vinculaciones.tiene_permiso(
                self.request.user, titular_id, 'puede_ver_registros'
            ):
                raise PermissionDenied('No tienes acceso al historial de tomas de este usuario.')
            return Registro_Toma.objects.filter(id_usuario_id=titular_id).order_by(
                '-fecha_hora_programada',
                '-id',
            )
        return Registro_Toma.objects.filter(id_usuario=self.request.user).order_by(
            '-fecha_hora_programada',
            '-id',
        )

    def perform_create(self, serializer):
        horario = serializer.validated_data.get('id_horario')
        if horario.id_medicamento.id_usuario_id != self.request.user.id:
            raise serializers.ValidationError({'id_horario': 'El horario no pertenece al usuario autenticado.'})
        serializer.save(id_usuario=self.request.user)

    def create(self, request, *args, **kwargs):
        """Crea una ocurrencia solo una vez, incluso si dos clientes la detectan a la vez."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        horario = serializer.validated_data['id_horario']
        if horario.id_medicamento.id_usuario_id != request.user.id:
            raise serializers.ValidationError({'id_horario': 'El horario no pertenece al usuario autenticado.'})

        try:
            with transaction.atomic():
                registro, creado = Registro_Toma.objects.get_or_create(
                    id_usuario=request.user,
                    id_horario=horario,
                    fecha_hora_programada=serializer.validated_data['fecha_hora_programada'],
                )
        except IntegrityError:
            # La restricción única resuelve carreras entre pestañas o clientes.
            registro = Registro_Toma.objects.get(
                id_usuario=request.user,
                id_horario=horario,
                fecha_hora_programada=serializer.validated_data['fecha_hora_programada'],
            )
            creado = False

        respuesta = self.get_serializer(registro)
        return Response(respuesta.data, status=status.HTTP_201_CREATED if creado else status.HTTP_200_OK)

    def perform_update(self, serializer):
        fecha_hora_real = serializer.validated_data.get('fecha_hora_real')
        if fecha_hora_real is None or serializer.instance.fecha_hora_real is not None:
            serializer.save()
            return
        registro = confirmar_registro_con_stock(
            serializer.instance.id,
            self.request.user,
            fecha_hora_real,
        )
        serializer.instance = registro


class VinculacionMonitorViewSet(viewsets.ModelViewSet):
    """Invitaciones para que un usuario (monitor) vea en solo lectura los
    datos de otro (titular). Cualquiera de las dos partes puede desvincular;
    solo el titular edita los permisos; el estado solo cambia vía
    aceptar/rechazar, nunca por PATCH directo."""

    serializer_class = VinculacionMonitorSerializer
    permission_classes = [IsAuthenticated]
    queryset = VinculacionMonitor.objects.none()

    def get_queryset(self):
        return VinculacionMonitor.objects.filter(
            Q(titular=self.request.user) | Q(monitor=self.request.user)
        ).select_related('titular', 'monitor').order_by('-fecha_creacion')

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context

    def perform_update(self, serializer):
        vinculacion = serializer.instance
        if vinculacion.titular_id != self.request.user.id:
            raise PermissionDenied('Solo el titular puede editar los permisos de una vinculación.')
        serializer.save(
            puede_ver_medicamentos=serializer.validated_data.get(
                'puede_ver_medicamentos', vinculacion.puede_ver_medicamentos
            ),
            puede_ver_horarios=serializer.validated_data.get(
                'puede_ver_horarios', vinculacion.puede_ver_horarios
            ),
            puede_ver_registros=serializer.validated_data.get(
                'puede_ver_registros', vinculacion.puede_ver_registros
            ),
        )

    def perform_destroy(self, instance):
        if self.request.user.id not in (instance.titular_id, instance.monitor_id):
            raise PermissionDenied('No puedes eliminar esta vinculación.')
        instance.delete()

    @action(detail=True, methods=['post'])
    def aceptar(self, request, pk=None):
        vinculacion = self.get_object()
        if request.user.id != vinculacion.monitor_id:
            raise PermissionDenied('Solo el monitor invitado puede aceptar esta vinculación.')
        vinculacion.estado = VinculacionMonitor.Estado.ACEPTADA
        vinculacion.fecha_respuesta = timezone.now()
        vinculacion.save(update_fields=['estado', 'fecha_respuesta'])
        return Response(VinculacionMonitorSerializer(vinculacion, context={'request': request}).data)

    @action(detail=True, methods=['post'])
    def rechazar(self, request, pk=None):
        vinculacion = self.get_object()
        if request.user.id != vinculacion.monitor_id:
            raise PermissionDenied('Solo el monitor invitado puede rechazar esta vinculación.')
        vinculacion.estado = VinculacionMonitor.Estado.RECHAZADA
        vinculacion.fecha_respuesta = timezone.now()
        vinculacion.save(update_fields=['estado', 'fecha_respuesta'])
        return Response(VinculacionMonitorSerializer(vinculacion, context={'request': request}).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def web_push_subscribe(request):
    endpoint = request.data.get('endpoint')
    keys = request.data.get('keys') or {}
    p256dh = keys.get('p256dh')
    auth = keys.get('auth')
    if not endpoint or not p256dh or not auth:
        return Response({'detail': 'endpoint, keys.p256dh y keys.auth son obligatorios.'}, status=status.HTTP_400_BAD_REQUEST)

    sub, created = WebPushSubscription.objects.update_or_create(
        usuario=request.user,
        endpoint=endpoint,
        defaults={
            'p256dh': p256dh,
            'auth': auth,
            'active': True,
            'browser': 'web',
            'user_agent': request.META.get('HTTP_USER_AGENT', ''),
        },
    )
    return Response({'ok': True, 'created': created, 'subscription_id': sub.id}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def web_push_unsubscribe(request):
    endpoint = request.data.get('endpoint')
    if not endpoint:
        return Response({'detail': 'endpoint es obligatorio.'}, status=status.HTTP_400_BAD_REQUEST)

    deleted, _ = WebPushSubscription.objects.filter(usuario=request.user, endpoint=endpoint).delete()
    return Response({'ok': True, 'deleted': deleted > 0}, status=status.HTTP_200_OK)


def autenticar_dispositivo(request):
    identificador = request.headers.get('X-Device-Id', '')
    token = request.headers.get('X-Device-Token', '')
    if not identificador or not token:
        return None
    try:
        dispositivo = Dispositivo.objects.get(identificador=identificador)
    except (Dispositivo.DoesNotExist, ValueError, ValidationError):
        return None
    return dispositivo if dispositivo.token_dispositivo_hash and check_password(token, dispositivo.token_dispositivo_hash) else None


@api_view(['POST'])
@permission_classes([AllowAny])
def iot_heartbeat(request):
    dispositivo = autenticar_dispositivo(request)
    if not dispositivo:
        return Response({'detail': 'Credenciales de dispositivo inválidas.'}, status=status.HTTP_401_UNAUTHORIZED)
    rssi = request.data.get('rssi')
    if rssi is not None and not isinstance(rssi, int):
        return Response({'rssi': 'Debe ser un entero.'}, status=status.HTTP_400_BAD_REQUEST)
    dispositivo.ultimo_latido = timezone.now()
    dispositivo.estado_conexion = True
    dispositivo.rssi = rssi
    dispositivo.version_firmware = str(request.data.get('firmware_version', dispositivo.version_firmware))[:50]
    dispositivo.ip_esp32 = str(request.data.get('ip', dispositivo.ip_esp32))[:100]
    dispositivo.save(update_fields=['ultimo_latido', 'estado_conexion', 'rssi', 'version_firmware', 'ip_esp32'])
    return Response({'ok': True, 'server_time': timezone.localtime().isoformat()})


@api_view(['GET'])
@permission_classes([AllowAny])
def iot_configuracion(request):
    dispositivo = autenticar_dispositivo(request)
    if not dispositivo:
        return Response({'detail': 'Credenciales de dispositivo inválidas.'}, status=status.HTTP_401_UNAUTHORIZED)
    asignacion = getattr(dispositivo, 'asignacion', None)
    if not asignacion:
        return Response({'activo': False, 'timezone': 'America/Bogota'})
    horario = asignacion.id_horario
    if not horario.activo or horario.eliminado:
        return Response({'activo': False, 'timezone': 'America/Bogota'})
    ultima_confirmada = Registro_Toma.objects.filter(
        id_horario=horario,
        id_usuario=dispositivo.id_usuario,
        fecha_hora_real__isnull=False,
    ).order_by('-fecha_hora_programada').first()
    # El ESP32 compara este instante con la alarma que tiene activa. Si la web
    # confirmó esa misma toma, apaga LED/buzzer sin generar otro registro.
    toma_confirmada_programada = (
        timezone.localtime(ultima_confirmada.fecha_hora_programada).strftime('%Y-%m-%dT%H:%M')
        if ultima_confirmada else None
    )
    return Response({'activo': True, 'version': asignacion.fecha_actualizacion.isoformat(), 'timezone': 'America/Bogota',
                     'ultima_toma_confirmada_programada': toma_confirmada_programada, 'horario': {
        'id': horario.id, 'hora_toma': horario.hora_toma.strftime('%H:%M:%S'), 'frecuencia': horario.frecuencia,
        'medicamento': horario.id_medicamento.nombre,
    }})


@api_view(['POST'])
@permission_classes([AllowAny])
def iot_confirmar_toma(request):
    dispositivo = autenticar_dispositivo(request)
    if not dispositivo:
        return Response({'detail': 'Credenciales de dispositivo inválidas.'}, status=status.HTTP_401_UNAUTHORIZED)
    asignacion = getattr(dispositivo, 'asignacion', None)
    if not asignacion:
        return Response({'detail': 'El dispositivo no tiene un horario asignado.'}, status=status.HTTP_409_CONFLICT)
    if not asignacion.id_horario.activo or asignacion.id_horario.eliminado:
        return Response({'detail': 'El horario asignado está deshabilitado.'}, status=status.HTTP_409_CONFLICT)
    try:
        import uuid
        evento_id = uuid.UUID(str(request.data['evento_id']))
        fecha_real = datetime.fromisoformat(str(request.data['fecha_hora_real']).replace('Z', '+00:00'))
        if timezone.is_naive(fecha_real):
            fecha_real = timezone.make_aware(fecha_real, timezone.get_current_timezone())
    except (KeyError, TypeError, ValueError):
        return Response({'detail': 'evento_id UUID y fecha_hora_real ISO-8601 son obligatorios.'}, status=status.HTTP_400_BAD_REQUEST)
    with transaction.atomic():
        evento = EventoDispositivo.objects.filter(evento_id=evento_id).first()
        if evento:
            if evento.dispositivo_id != dispositivo.id:
                return Response({'detail': 'evento_id ya pertenece a otro dispositivo.'}, status=status.HTTP_409_CONFLICT)
            return Response({'ok': True, 'duplicado': True, 'registro_id': evento.id_registro_id})

        registro = Registro_Toma.objects.select_for_update().filter(
            id_horario=asignacion.id_horario,
            id_usuario=dispositivo.id_usuario,
            fecha_hora_real__isnull=True,
            fecha_hora_programada__lte=fecha_real,
        ).order_by('-fecha_hora_programada').first()
        if not registro:
            return Response(
                {'detail': 'No existe una toma programada pendiente para confirmar.'},
                status=status.HTTP_409_CONFLICT,
            )

        registro = confirmar_registro_con_stock(
            registro.id,
            dispositivo.id_usuario,
            fecha_real,
        )
        evento = EventoDispositivo.objects.create(
            evento_id=evento_id,
            dispositivo=dispositivo,
            tipo='toma_confirmada',
            fecha_dispositivo=fecha_real,
            id_registro=registro,
        )
    return Response({'ok': True, 'duplicado': False, 'registro_id': registro.id}, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def proximos_horarios(request):
    """
    Devuelve los próximos horarios de toma del usuario autenticado,
    ordenados cronológicamente por la fecha/hora calculada de su próxima toma.
    Utiliza select_related para evitar N+1 queries.
    """
    horarios = Horario.objects.filter(
        id_medicamento__id_usuario=request.user,
        activo=True,
        eliminado=False,
    ).select_related('id_medicamento')

    lista_horarios = []
    for h in horarios:
        prox = h.proxima_toma
        if prox:
            lista_horarios.append({
                'id_horario': h.id,
                'id_medicamento': h.id_medicamento.id,
                'medicamento': h.id_medicamento.nombre,
                'dosis': h.id_medicamento.dosis,
                'hora_toma': h.hora_toma.strftime('%H:%M'),
                'frecuencia': h.frecuencia,
                'cantidad_por_toma': h.cantidad_por_toma,
                'fecha_inicio': h.fecha_inicio,
                'tipo_duracion': h.tipo_duracion,
                'duracion_dias': h.duracion_dias,
                'fecha_fin': h.fecha_fin,
                'proxima_toma': timezone.localtime(prox).isoformat(),
                '_prox_dt': prox,
            })

    # Ordenar cronológicamente por la próxima toma real
    lista_horarios.sort(key=lambda item: item['_prox_dt'])

    try:
        limit = int(request.query_params.get('limit', 5))
        limit = max(1, min(limit, 50))
    except (ValueError, TypeError):
        limit = 5

    resultado = lista_horarios[:limit]

    # Limpiar campo auxiliar de ordenamiento
    for item in resultado:
        del item['_prox_dt']

    return Response(resultado, status=status.HTTP_200_OK)
