# android-config

Archivos de configuración nativa de Android que Capacitor necesita pero que
no viven en `pillbox-app/` (el proyecto Android nativo se genera aparte, en
una carpeta fuera del repo — ver conversación/README de deploy).

- **google-services.json**: config de Firebase Cloud Messaging (push nativo
  en Android). Se descarga desde Firebase Console > Configuración del
  proyecto > Tus apps > `com.pillbox.app`. Va copiado en
  `<proyecto-android>/android/app/google-services.json`.

  No es un secreto (Google lo documenta así para apps móviles: la API key
  ahí no otorga acceso sin las reglas de seguridad del proyecto), por eso se
  versiona. La clave que sí es secreta es la cuenta de servicio para *enviar*
  push desde el backend (`FIREBASE_CREDENTIALS_JSON` en el `.env` de la VM) —
  esa nunca se commitea.
