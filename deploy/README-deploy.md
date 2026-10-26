# Desplegar el backend (`api_pillbox`) en una VM con Docker

Guía paso a paso para poner `api_pillbox` en una VM Linux con Docker, HTTPS
real (Let's Encrypt) y el envío de notificaciones por cron (sin el scheduler
en memoria, que se duplicaría con varios workers).

## Servidor actual (desde el 2026-10-19)

| Dato | Valor |
|---|---|
| Proveedor | Microsoft Azure (cuenta gratuita, 200 USD de crédito por 30 días) |
| VM | `pillbox-api`, grupo de recursos `pillbox-rg`, Ubuntu 24.04 x64 |
| Tamaño | `Standard_B2als_v2` (2 vCPU, 4 GB) + 2 GB de swap |
| IP pública | `20.112.83.137` (IP Standard, estática) |
| Usuario SSH | `azureuser`, solo con clave (`PasswordAuthentication no`) |
| Clave SSH | `pillbox-api_key.pem` (Ed25519), descargada de Azure al crear la VM |
| Repo en la VM | `/home/azureuser/pastillero2026` |
| Dominio | `epillbox.duckdns.org` (cuenta de DuckDNS: la de **GitHub**) |
| Certificado | Let's Encrypt, cuenta `luis_sanchezmu@fet.edu.co`, renovación automática |

Servidor anterior: VM de Oracle Cloud `157.137.231.99` (usuario `ubuntu`).
Se dejó con `web` detenido, el cron de notificaciones comentado y el respaldo
`~/pillbox-2026-10-19.dump`; ver [Migrar a otro servidor](#migrar-a-otro-servidor).

> **Pendiente antes del día 30 (≈ 2026-11-18)**, cuando caduca el crédito:
> 1. Pasar la cuenta a "pago por uso" (si no, Azure deshabilita la suscripción).
> 2. VM → **Tamaño** → `Standard_B2ats_v2` (gratis 12 meses, 1 GB de RAM;
>    misma familia, se cambia sin reinstalar; la swap de 2 GB ya está puesta).
> 3. Disco del SO: quedó en 30 GB; ampliarlo a **64 GiB SSD Premium (P6)**,
>    que es el que incluye la oferta gratuita (requiere detener la VM).
> 4. Revisar en **Cost Management** que no quede nada cobrando.

Archivos que ya están preparados en el repo:

```
pastillero2026/
├── docker-compose.yml
├── api_pillbox/
│   ├── Dockerfile
│   ├── entrypoint.sh            # espera a Postgres, migra, collectstatic, Gunicorn
│   ├── .dockerignore
│   └── env.production.example   # plantilla de api_pillbox/.env
└── deploy/
    ├── nginx/
    │   ├── pillbox.conf.initial   # usar primero (sin HTTPS)
    │   └── pillbox.conf.ssl       # usar después de obtener el certificado
    └── README-deploy.md           # este archivo
```

En la VM existen además dos archivos que **no** están en git:

- `api_pillbox/.env`: variables de Django (SECRET_KEY, BD, correo, VAPID,
  `FIREBASE_CREDENTIALS_JSON` en línea, etc.).
- `.env` en la **raíz** del repo: Docker Compose lo lee para sustituir
  `${DB_NAME}`, `${DB_USER}` y `${DB_PASSWORD}` dentro de `docker-compose.yml`
  (el healthcheck y las variables `POSTGRES_*` del contenedor `db`). Debe tener
  los mismos valores de BD que `api_pillbox/.env`.

## Fase 1 — Crear la VM

### Azure (servidor actual)

En el portal: **Máquina virtual → Crear → Máquina virtual de Azure**
(si aparece el asistente de "valores predeterminados", pulsa *Omitir este paso*):

- Región: East US 2 / West US 2 (cerca de Colombia y con serie B disponible).
- Imagen: **Ubuntu Server 24.04 LTS – x64 Gen2**.
- Tamaño: una de la **serie B v2 sin "d"** (p. ej. `B2als_v2`). Están en el
  grupo "Otros tamaños" del selector. Evita las tallas con "d" (disco temporal
  que se borra) y las v6/v7 (NVMe): no se pueden redimensionar después a la
  `B2ats_v2` gratuita.
- **No** marcar "Ejecución de Azure Spot" (Azure puede apagarla cuando quiera).
- Autenticación: clave pública SSH, usuario `azureuser`, generar par de claves
  nuevo y **descargar el `.pem`** (solo se ofrece una vez).
- Puertos de entrada: **SSH (22), HTTP (80), HTTPS (443)**. Azure no trae
  iptables activo dentro de la VM, así que con el grupo de seguridad de red basta.
- Disco del SO: 64 GiB, SSD Premium.
- Administración: **apagado automático desactivado**.

En Windows, guarda la clave fuera de OneDrive y con permisos solo para tu
usuario (si no, OpenSSH la rechaza con `UNPROTECTED PRIVATE KEY FILE`):

```powershell
Copy-Item pillbox-api_key.pem $HOME\.ssh\pillbox-azure.pem
icacls $HOME\.ssh\pillbox-azure.pem /inheritance:r /grant:r "$($env:USERNAME):(R)"
ssh -i $HOME\.ssh\pillbox-azure.pem azureuser@20.112.83.137
```

### Oracle Cloud (servidor anterior, Always Free)

1. **Compute → Instances → Create Instance**, imagen Ubuntu 24.04, shape
   `VM.Standard.A1.Flex` (ARM) o la x86 gratuita, IPv4 pública activada.
2. Abrir 80 y 443 en **dos** capas: la Security List de la VCN (ingreso
   `0.0.0.0/0`, TCP 80 y 443) y el iptables que viene activo en la imagen:

   ```bash
   sudo iptables -I INPUT -p tcp --dport 80 -j ACCEPT
   sudo iptables -I INPUT -p tcp --dport 443 -j ACCEPT
   sudo netfilter-persistent save   # sudo apt install iptables-persistent si no existe
   ```

## Fase 2 — Dominio (DuckDNS)

Let's Encrypt no emite certificados para una IP pelada. Usamos
`epillbox.duckdns.org` (entrar en https://www.duckdns.org con la cuenta de
**GitHub**). En la fila `epillbox`, cambia *current ip* a la IP de la VM y
pulsa *update ip*. El TTL es de 60 s, así que el cambio se nota casi enseguida:

```bash
nslookup epillbox.duckdns.org 8.8.8.8
```

**No cambies de dominio**: `https://epillbox.duckdns.org/api/` está compilado
en el APK (`pillbox-app/src/environments/environment.ts`) y guardado en la NVS
de cada ESP32 al vincularse. Otro dominio obligaría a sacar un APK nuevo y a
revincular los pastilleros.

## Fase 3 — Preparar la VM (swap, Docker, SSH)

```bash
# Swap de 2 GB (imprescindible en tallas de 1 GB de RAM)
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

sudo apt update && sudo apt upgrade -y
sudo apt install -y docker.io docker-compose-v2 git
sudo systemctl enable --now docker
sudo usermod -aG docker $USER

# SSH solo con clave
sudo sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo systemctl reload ssh
# cierra sesión y vuelve a entrar para que el grupo docker tome efecto
```

## Fase 4 — Clonar el repo y configurar los `.env`

```bash
git clone https://github.com/SHADOWGOST4/pastillero2026.git ~/pastillero2026
cd ~/pastillero2026/api_pillbox
cp env.production.example .env
nano .env   # completa SECRET_KEY, ALLOWED_HOSTS, DB_PASSWORD, etc.
```

Si estás **migrando** de un servidor existente, no generes valores nuevos:
copia tal cual `api_pillbox/.env` y el `.env` de la raíz del servidor viejo
(ver [Migrar a otro servidor](#migrar-a-otro-servidor)). Conservar la
`SECRET_KEY` mantiene válidos los tokens de la app y de los ESP32.

Para una instalación nueva, crea también el `.env` de la raíz con
`DB_NAME`, `DB_USER` y `DB_PASSWORD` (los mismos de `api_pillbox/.env`), y
genera una `SECRET_KEY`:

```bash
python3 -c "import secrets,string; print(''.join(secrets.choice(string.ascii_letters+string.digits+'!@#$%^&*(-_=+)') for _ in range(50)))"
```

Pon `epillbox.duckdns.org` en `ALLOWED_HOSTS` y `https://epillbox.duckdns.org`
en `CORS_ALLOWED_ORIGINS`, junto con `https://localhost` (el origen del WebView
de la app Android/Capacitor). Define `FRONTEND_URL=https://epillbox.duckdns.org`:
se usa para el enlace del correo de verificación, que el propio backend sirve
en `/verificar-correo`.

## Fase 5 — Primer arranque (HTTP, sin certificado todavía)

```bash
cd ~/pastillero2026
cp deploy/nginx/pillbox.conf.initial deploy/nginx/pillbox.conf
sed -i "s/TU_DOMINIO_AQUI/epillbox.duckdns.org/" deploy/nginx/pillbox.conf

docker compose up -d --build
docker compose logs -f web   # revisa que migre y arranque sin errores
```

Prueba sin depender del DNS (debe responder `401`, no un error):

```bash
curl -i -H "Host: epillbox.duckdns.org" http://IP_DE_LA_VM/api/proximos-horarios/
```

## Fase 6 — Certificado HTTPS con Certbot

Con el dominio ya apuntando a esta VM (Fase 2):

```bash
docker compose run --rm --entrypoint certbot certbot certonly \
  --webroot -w /var/www/certbot \
  -d epillbox.duckdns.org \
  --email luis_sanchezmu@fet.edu.co --agree-tos --no-eff-email --non-interactive
```

Ojo con `--entrypoint certbot`: el servicio `certbot` del `docker-compose.yml`
tiene como entrypoint el bucle de renovación, así que sin ese flag los
argumentos se ignoran y el comando se queda colgado para siempre.

Después cambia a la configuración con HTTPS:

```bash
cp deploy/nginx/pillbox.conf.ssl deploy/nginx/pillbox.conf
sed -i "s/TU_DOMINIO_AQUI/epillbox.duckdns.org/g" deploy/nginx/pillbox.conf
docker compose exec nginx nginx -t && docker compose restart nginx
curl -i https://epillbox.duckdns.org/api/proximos-horarios/   # 401 esperado
```

El contenedor `certbot` queda corriendo en bucle y renueva el certificado solo
cuando se acerca a expirar.

## Fase 7 — Notificaciones push por cron (sin duplicar el scheduler)

`core/apps.py` deja apagado el scheduler en memoria cuando `DEBUG=False`, y
`python manage.py enviar_notificaciones` lo reemplaza. Va en el **crontab del
sistema** (no dentro del contenedor, para que sobreviva a un restart), junto
con la rotación de su log. En Azure (`crontab -e` como `azureuser`):

```
* * * * * cd /home/azureuser/pastillero2026 && docker compose exec -T web python manage.py enviar_notificaciones >> /home/azureuser/pillbox-notificaciones.log 2>&1
15 3 * * * /usr/sbin/logrotate -s /home/azureuser/.logrotate.status /home/azureuser/logrotate-pillbox.conf
```

Con `~/logrotate-pillbox.conf`:

```
/home/azureuser/pillbox-notificaciones.log {
    daily
    rotate 7
    compress
    missingok
    notifempty
    copytruncate
}
```

El log solo recibe líneas cuando hay tomas pendientes; vacío es normal. Para
confirmar que el cron corre: `grep CRON /var/log/syslog | tail`.

## Fase 8 — Firmware ESP32 (certificado raíz)

El ESP32 valida el servidor con el `ROOT_CA` de
`firmware/esp32_pillbox/secrets.h`, que es **ISRG Root X1** (válido hasta 2035),
y guarda la `api_url` en su NVS al vincularse. Mientras el dominio sea el mismo
y el certificado sea de Let's Encrypt, **no hay que recargar firmware ni
revincular**.

El certificado emitido en octubre de 2026 es ECDSA y su cadena es
`epillbox → YE1 → Root YE → ISRG Root X2 → ISRG Root X1` (los dos últimos
eslabones son certificados cruzados, válidos hasta 2032-09-02). Se comprobó
que valida usando solo ISRG Root X1:

```bash
openssl s_client -connect epillbox.duckdns.org:443 -servername epillbox.duckdns.org -showcerts
# guardar los certificados 2..4 en inter.pem y el 1 en hoja.pem, y:
openssl verify -CAfile isrg-root-x1.pem -untrusted inter.pem hoja.pem   # → OK
```

Si en una próxima carga de firmware quieres más margen, añade también
ISRG Root X2 (https://letsencrypt.org/certs/isrgrootx2.pem) al `ROOT_CA`.

## Fase 9 — Actualizar el código en el servidor

```bash
cd ~/pastillero2026
git pull
docker compose up -d --build
```

`entrypoint.sh` aplica las migraciones en cada arranque, así que no hace falta
ejecutar `migrate` a mano.

## Migrar a otro servidor

Procedimiento usado el 2026-10-19 para pasar de Oracle a Azure (unos 15 min
sin servicio, la mayor parte esperando el cambio de DNS y el certificado):

1. **Nuevo servidor, sin corte**: Fases 1, 3 y 4 (clonar), copiar desde el
   viejo `api_pillbox/.env`, el `.env` de la raíz y `~/logrotate-pillbox.conf`
   (ajustando la ruta de `/home/<usuario>/`), preparar `pillbox.conf` desde
   `pillbox.conf.initial` y construir la imagen: `docker compose build web`.
2. **Servidor viejo, inicio del corte**: guardar el crontab, comentar la línea
   de `enviar_notificaciones` y detener la API (la BD sigue arriba):

   ```bash
   crontab -l > ~/crontab-$(date +%F).bak
   crontab -e                      # comenta la línea de enviar_notificaciones
   cd ~/pastillero2026 && docker compose stop web
   docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > ~/pillbox-$(date +%F).dump
   ```

3. Copiar el `.dump` al servidor nuevo (`scp`, pasando por tu PC si hace falta).
4. **Servidor nuevo**: restaurar en un volumen vacío y levantar el resto:

   ```bash
   cd ~/pastillero2026
   docker compose up -d db          # espera a que esté (healthy)
   docker compose exec -T db sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-privileges' < ~/pillbox-AAAA-MM-DD.dump
   docker compose up -d             # web aplica las migraciones nuevas
   ```

   Compara el número de filas por tabla en ambos lados, por ejemplo con:

   ```sql
   select table_name, (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', table_schema, table_name), false, true, '')))[1]::text::int
   from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by 1;
   ```

5. Cambiar la IP en DuckDNS (Fase 2), sacar el certificado y activar SSL
   (Fase 6) e instalar el cron (Fase 7).
6. Probar el inicio de sesión en la app y que el ESP32 sincronice
   (`docker compose logs nginx | grep /api/iot/`).
7. Dejar el servidor viejo apagado unos días como respaldo antes de borrarlo.
   Para volver atrás: apuntar DuckDNS a la IP vieja, `docker compose start web`
   y descomentar el cron (lo que se haya escrito en el nuevo entretanto se pierde).

Resultado de la migración Oracle → Azure: 25 tablas con conteos idénticos
(5 usuarios, 2 dispositivos, 19 horarios, 1118 registros de toma…), y al
arrancar se aplicó `core.0024_hashear_passwords_texto_plano` (PR #31): las
contraseñas guardadas en texto plano pasaron a hash y siguen siendo las mismas
para iniciar sesión.

## Notas de seguridad para producción

- El `.env` del servidor debe tener credenciales **distintas** a las de tu
  `.env` de desarrollo local. No reutilices la contraseña de Postgres `0000`
  ni ninguna clave que haya estado antes en el repo o en capturas.
- No definas `RUN_INPROCESS_SCHEDULER=true` en este `.env`: con `DEBUG=False`
  ya se apaga solo (el cron de la Fase 7 lo reemplaza).
- Guarda las claves SSH en `~/.ssh` con permisos restringidos y fuera de
  carpetas sincronizadas (OneDrive, Drive…). Son la única forma de entrar.
- El puerto 22 está abierto a todo Internet pero solo acepta claves; si
  quieres, limítalo a tu IP en el grupo de seguridad de red de Azure.
