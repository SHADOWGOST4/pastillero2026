from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from core.views import *

router = DefaultRouter()
router.register(r'usuarios', UsuarioViewSet)
router.register(r'contactos', ContactoViewSet)
router.register(r'dispositivos', DispositivoViewSet)
router.register(r'medicamentos', MedicamentoViewSet)
router.register(r'horarios', HorarioViewSet)
router.register(r'registros', RegistroTomaViewSet)
router.register(r'notificaciones', NotificacionViewSet)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include(router.urls)),
    path('api/registro/', registrar_usuario, name='registro_usuario'),
    path('api/login/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair_alias'),
    path('api/token/refresh/', CustomTokenRefreshView.as_view(), name='token_refresh'),
    path('api/proximos-horarios/', proximos_horarios, name='proximos_horarios'),
]
