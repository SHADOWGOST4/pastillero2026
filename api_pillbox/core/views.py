from django.contrib.auth.hashers import check_password, make_password
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from datetime import timedelta
from django.utils import timezone

from rest_framework import viewsets
from rest_framework_simplejwt.views import TokenViewBase
from .models import *
from .serializers import *




@api_view(['POST'])
@permission_classes([AllowAny])
def registrar_usuario(request):
    serializer = UsuarioSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


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


class ContactoViewSet(viewsets.ModelViewSet):
    serializer_class = ContactoSerializer
    permission_classes = [IsAuthenticated]
    queryset = Contacto.objects.none()

    def get_queryset(self):
        return Contacto.objects.filter(id_usuario=self.request.user)

    def perform_create(self, serializer):
        serializer.save(id_usuario=self.request.user)


class DispositivoViewSet(viewsets.ModelViewSet):
    serializer_class = DispositivoSerializer
    permission_classes = [IsAuthenticated]
    queryset = Dispositivo.objects.none()

    def get_queryset(self):
        return Dispositivo.objects.filter(id_usuario=self.request.user)

    def perform_create(self, serializer):
        serializer.save(id_usuario=self.request.user)


class MedicamentoViewSet(viewsets.ModelViewSet):
    serializer_class = MedicamentoSerializer
    permission_classes = [IsAuthenticated]
    queryset = Medicamento.objects.none()

    def get_queryset(self):
        return Medicamento.objects.filter(id_usuario=self.request.user)

    def perform_create(self, serializer):
        serializer.save(id_usuario=self.request.user)


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
    queryset = Horario.objects.none()

    def get_queryset(self):
        return Horario.objects.filter(id_medicamento__id_usuario=self.request.user)

    def perform_create(self, serializer):
        medicamento = serializer.validated_data.get('id_medicamento')
        if medicamento.id_usuario_id != self.request.user.id:
            raise serializers.ValidationError({'id_medicamento': 'El medicamento no pertenece al usuario autenticado.'})
        serializer.save()


class RegistroTomaViewSet(viewsets.ModelViewSet):
    serializer_class = RegistroTomaSerializer
    permission_classes = [IsAuthenticated]
    queryset = Registro_Toma.objects.none()

    def get_queryset(self):
        return Registro_Toma.objects.filter(id_usuario=self.request.user)

    def perform_create(self, serializer):
        horario = serializer.validated_data.get('id_horario')
        if horario.id_medicamento.id_usuario_id != self.request.user.id:
            raise serializers.ValidationError({'id_horario': 'El horario no pertenece al usuario autenticado.'})
        serializer.save(id_usuario=self.request.user)


class NotificacionViewSet(viewsets.ModelViewSet):
    serializer_class = NotificacionSerializer
    permission_classes = [IsAuthenticated]
    queryset = Notificacion.objects.none()

    def get_queryset(self):
        return Notificacion.objects.filter(id_contacto__id_usuario=self.request.user)

    def perform_create(self, serializer):
        contacto = serializer.validated_data.get('id_contacto')
        registro = serializer.validated_data.get('id_registro')
        if contacto.id_usuario_id != self.request.user.id or registro.id_usuario_id != self.request.user.id:
            raise serializers.ValidationError('El contacto o registro no pertenece al usuario autenticado.')
        serializer.save()


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def proximos_horarios(request):
    """
    Devuelve los próximos horarios de toma del usuario autenticado,
    ordenados cronológicamente por la fecha/hora calculada de su próxima toma.
    Utiliza select_related para evitar N+1 queries.
    """
    horarios = Horario.objects.filter(
        id_medicamento__id_usuario=request.user
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