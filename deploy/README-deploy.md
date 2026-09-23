# Desplegar el backend en Oracle Cloud (Always Free)

Guía paso a paso para poner `api_pillbox` en una VM gratuita de Oracle Cloud
con Docker, HTTPS real (Let's Encrypt) y el envío de notificaciones por cron
(sin el scheduler en memoria, que se duplicaría con varios workers).

Archivos que ya están preparados en el repo:

```
pastillero2026/
├── docker-compose.yml
├── api_pillbox/
│   ├── Dockerfile
│   ├── entrypoint.sh
│   ├── .dockerignore
│   └── .env.production.example
└── deploy/
    ├── nginx/
    │   ├── pillbox.conf.initial   # usar primero (sin HTTPS)
    │   └── pillbox.conf.ssl       # usar después de obtener el certificado
    └── README-deploy.md           # este archivo
```

## Fase 1 — Cuenta y VM en Oracle Cloud

1. Crea una cuenta en https://www.oracle.com/cloud/free/ (pide tarjeta para
   verificar identidad, pero el tier "Always Free" no cobra mientras te
   quedes dentro de sus límites).
2. En la consola OCI: **Compute → Instances → Create Instance**.
3. Elige una imagen **Ubuntu 24.04** (o 22.04).
4. En "Shape", cambia a **Ampere (ARM) → VM.Standard.A1.Flex**, y dentro del
   free tier deja algo como 2 OCPU / 12 GB RAM (ajusta según lo que tu
   cuenta permita gratis — la consola te avisa si te pasas del tier
   gratuito).
5. En networking, deja que cree una VCN nueva y asegúrate de que la opción
   "Assign a public IPv4 address" esté activada.
6. Descarga la clave SSH privada que te ofrece Oracle al crear la instancia
   (o sube tu propia clave pública). La necesitarás para conectarte.
7. Crea la instancia y anota la **IP pública**.

### Abrir los puertos 80 y 443

Oracle bloquea el tráfico entrante por defecto en dos capas distintas —hay
que abrir el puerto en **ambas** o no entra nada:

- **Security List / Network Security Group** (en la consola OCI): ve a la
  VCN de tu instancia → Security Lists → agrega reglas de ingreso para
  `0.0.0.0/0`, puertos TCP `80` y `443`.
- **Firewall de Ubuntu dentro de la VM** (iptables/netfilter, ya viene
  activo en las imágenes de Oracle). Conéctate por SSH y ejecuta:

  ```bash
  sudo iptables -I INPUT -p tcp --dport 80 -j ACCEPT
  sudo iptables -I INPUT -p tcp --dport 443 -j ACCEPT
  sudo netfilter-persistent save   # si no existe, instálalo: sudo apt install iptables-persistent
  ```

## Fase 2 — Un dominio gratis para HTTPS (DuckDNS)

Let's Encrypt no emite certificados para una IP pelada, necesitas un nombre
de dominio. La opción gratis más simple es [DuckDNS](https://www.duckdns.org/):

1. Entra con tu cuenta de GitHub/Google.
2. Crea un subdominio, por ejemplo `pillbox2026.duckdns.org`.
3. Apúntalo a la IP pública de tu VM de Oracle.

(Si tu universidad te puede dar un subdominio de `fet.edu.co` apuntando a
esa IP, también sirve — simplemente usa ese nombre en vez del de DuckDNS en
todo lo que sigue.)

## Fase 3 — Instalar Docker en la VM

Conéctate por SSH (`ssh -i tu_clave.key ubuntu@IP_PUBLICA`) y ejecuta:

```bash
sudo apt update && sudo apt install -y docker.io docker-compose-v2 git
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
# cierra sesión y vuelve a entrar por SSH para que el grupo tome efecto
```

## Fase 4 — Clonar el repo y configurar `.env`

```bash
git clone <URL_DE_TU_REPO> pastillero2026
cd pastillero2026/api_pillbox
cp .env.production.example .env
nano .env   # completa SECRET_KEY, ALLOWED_HOSTS, DB_PASSWORD, etc.
```

Para generar una `SECRET_KEY` nueva sin tener aún el contenedor construido:

```bash
python3 -c "import secrets,string; print(''.join(secrets.choice(string.ascii_letters+string.digits+'!@#$%^&*(-_=+)') for _ in range(50)))"
```

Pon en `ALLOWED_HOSTS` y en `CORS_ALLOWED_ORIGINS` el dominio de DuckDNS que
creaste (ej. `pillbox2026.duckdns.org`).

## Fase 5 — Primer arranque (HTTP, sin certificado todavía)

```bash
cd ~/pastillero2026
cp deploy/nginx/pillbox.conf.initial deploy/nginx/pillbox.conf
sed -i "s/TU_DOMINIO_AQUI/pillbox2026.duckdns.org/" deploy/nginx/pillbox.conf

docker compose up -d --build
docker compose logs -f web   # revisa que migre y arranque sin errores
```

En este punto la API ya responde por `http://pillbox2026.duckdns.org/api/...`.

## Fase 6 — Obtener el certificado HTTPS con Certbot

```bash
docker compose run --rm certbot certonly \
  --webroot -w /var/www/certbot \
  -d pillbox2026.duckdns.org \
  --email tu-correo@dominio.com --agree-tos --no-eff-email
```

Si sale bien, el certificado queda en el volumen `certbot_conf`. Ahora
cambia a la configuración con HTTPS:

```bash
cp deploy/nginx/pillbox.conf.ssl deploy/nginx/pillbox.conf
sed -i "s/TU_DOMINIO_AQUI/pillbox2026.duckdns.org/g" deploy/nginx/pillbox.conf
docker compose restart nginx
```

Prueba `https://pillbox2026.duckdns.org/api/proximos-horarios/` (te debe
pedir autenticación, no dar error de conexión/certificado).

El contenedor `certbot` del `docker-compose.yml` ya queda corriendo en loop
renovando el certificado automáticamente cada vez que se acerca a expirar.

## Fase 7 — Notificaciones push por cron (sin duplicar el scheduler)

Ya vimos que `core/apps.py` deja apagado el scheduler en memoria cuando
`DEBUG=False`, y que existe `python manage.py enviar_notificaciones` para
reemplazarlo. Agrega esto al **crontab del sistema operativo** (no dentro
del contenedor, para que sobreviva a un `docker compose restart`):

```bash
crontab -e
```

Y agrega la línea (ejecuta el comando dentro del contenedor `web` cada
minuto):

```
* * * * * cd /home/ubuntu/pastillero2026 && docker compose exec -T web python manage.py enviar_notificaciones >> /home/ubuntu/pillbox-notificaciones.log 2>&1
```

## Fase 8 — Actualizar el firmware ESP32

El `ROOT_CA` que tienes en `secrets.h` seguramente es el de tu túnel
(devtunnels.ms). Con Let's Encrypt necesitas el certificado raíz **ISRG
Root X1**, que puedes descargar de
https://letsencrypt.org/certs/isrgrootx1.pem y pegar tal cual dentro del
bloque `ROOT_CA` en `secrets.h`. También actualiza `API_BASE_URL` a
`https://pillbox2026.duckdns.org/api/iot`.

## Fase 9 — Actualizar la app / futuros despliegues

Cuando hagas cambios (como la verificación de correo):

```bash
cd ~/pastillero2026
git pull
docker compose up -d --build
```

`entrypoint.sh` aplica migraciones automáticamente en cada arranque, así
que no hace falta ejecutar `migrate` a mano.

## Notas de seguridad para producción

- El `.env` de esta VM debe tener credenciales **distintas** a las de tu
  `.env` de desarrollo local (ya lo dice la plantilla). No reutilices la
  contraseña de Postgres `0000` ni ninguna clave que haya estado antes en
  el repo o en capturas de pantalla.
- No definas `RUN_INPROCESS_SCHEDULER=true` en este `.env`: con `DEBUG=False`
  ya se apaga solo, que es lo correcto aquí (el cron de la Fase 7 lo
  reemplaza).
- Guarda la clave SSH de Oracle en un lugar seguro; es la única forma de
  entrar a la VM si algo falla.
