from rest_framework_simplejwt.authentication import JWTAuthentication
from core.models import Usuario


class UsuarioJWTAuthentication(JWTAuthentication):
    """
    Clase de autenticación JWT personalizada que enlaza la validación de tokens
    de SimpleJWT con el modelo Usuario del proyecto api_pillbox.
    """
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.user_model = Usuario
