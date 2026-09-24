from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from core.views import *

router = DefaultRouter()
router.register(r'usuarios', UsuarioViewSet)
router.register(r'dispositivos', DispositivoViewSet)
router.register(r'medicamentos', MedicamentoViewSet)
router.register(r'modulos', ModuloViewSet)
router.register(r'horarios', HorarioViewSet)
router.register(r'registros', RegistroTomaViewSet)
router.register(r'movimientos-stock', MovimientoStockViewSet, basename='movimiento-stock')
router.register(r'vinculaciones', VinculacionMonitorViewSet)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('verificar-correo/', verificar_correo_pagina, name='verificar_correo_pagina'),
    path('api/', include(router.urls)),
    path('api/registro/', registrar_usuario, name='registro_usuario'),
    path('api/verificar-correo/', verificar_correo, name='verificar_correo'),
    path('api/reenviar-verificacion/', reenviar_verificacion, name='reenviar_verificacion'),
    path('api/login/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair_alias'),
    path('api/token/refresh/', CustomTokenRefreshView.as_view(), name='token_refresh'),
    path('api/proximos-horarios/', proximos_horarios, name='proximos_horarios'),
    path('api/notificaciones/webpush/subscribe/', web_push_subscribe, name='web_push_subscribe'),
    path('api/notificaciones/webpush/unsubscribe/', web_push_unsubscribe, name='web_push_unsubscribe'),
    path('api/iot/heartbeat/', iot_heartbeat, name='iot_heartbeat'),
    path('api/iot/configuracion/', iot_configuracion, name='iot_configuracion'),
    path('api/iot/tomas/confirmar/', iot_confirmar_toma, name='iot_confirmar_toma'),
]
