# 🚀 Guía de Despliegue en Serv00 (Hosting Gratuito Persistente) + WhatsApp QR

Esta guía detalla paso a paso cómo alojar la plataforma **#VOY CON EL KZ** en **Serv00** (servidor gratuito sin tarjeta de crédito en Europa/Polonia) y conectar tu número de WhatsApp real de la campaña mediante **código QR** sin pagar APIs de Meta o Twilio.

---

## 📋 ¿Por qué Serv00?
* **100% Gratuito y sin tarjeta de crédito.**
* **Procesos persistentes:** A diferencia de Render o Vercel gratuitos, en Serv00 los procesos en segundo plano (como el bot de WhatsApp y el cronograma de notificaciones) **no se apagan tras 15 minutos de inactividad**.
* **Almacenamiento persistente:** La base de datos SQLite y las credenciales de WhatsApp (`server/whatsapp_session/`) no se borran al reiniciar.

---

## 🛠️ Paso 1: Crear y Configurar tu Cuenta en Serv00

1. Regístrate gratis en [https://www.serv00.com/](https://www.serv00.com/).
2. Revisa tu correo electrónico: recibirás tu usuario, contraseña, servidor SSH (ej: `sX.serv00.com`) y panel de control DevilWEB.
3. Inicia sesión en el panel web de Serv00.

### ⚠️ Habilitar ejecución de procesos propios (OBLIGATORIO)
Por defecto, Serv00 bloquea procesos en segundo plano. Para activarlos:
1. En el panel de Serv00 ve a **Additional services** (Servicios adicionales).
2. Busca la opción **Run your own applications** (Ejecutar tus propias aplicaciones).
3. Cambia el estado a **Enabled** (Habilitado).
*(También se puede activar por SSH ejecutando: `devil binexec on`)*.

---

## 🌐 Paso 2: Reservar un Puerto TCP para tu Aplicación

1. En el panel de Serv00, ve a **Port reservation** (Reserva de puertos) -> **Add port**.
2. Tipo: **TCP**.
3. El sistema te asignará un puerto aleatorio (por ejemplo: `34567`). **Guarda este número.**

---

## 🖥️ Paso 3: Conectar por SSH y Clonar el Proyecto

Abre una terminal (PowerShell en Windows, Terminal en Mac/Linux) y conéctate:

```bash
ssh usuario@sX.serv00.com
```
*(Reemplaza `usuario` y `sX` con los datos de tu correo).*

Una vez dentro:

```bash
# 1. Verificar versión de Node.js (Serv00 incluye Node 18/20/22)
node -v
npm -v

# 2. Ir a tu carpeta personal y clonar el repositorio
cd ~
git clone https://github.com/Sebas0415/cronograma-campana-kz.git
cd cronograma-campana-kz

# 3. Instalar dependencias de producción
npm install --omit=dev
```

---

## ⚙️ Paso 4: Crear el Archivo de Entorno (`.env`)

Crea un archivo `.env` en la raíz del proyecto:

```bash
cat << 'EOF' > .env
PORT=34567
NODE_ENV=production
JWT_SECRET=kz_campana_secreto_super_seguro_2026_serv00
WA_PROVIDER=baileys_qr
EOF
```
*(Cambia `34567` por el puerto TCP que te asignó Serv00 en el Paso 2).*

---

## 🚀 Paso 5: Configurar el Dominio Web en Serv00

En el panel DevilWEB de Serv00:
1. Ve a **WWW Websites** -> **Add new website**.
2. Dominio: tu subdominio asignado (ej: `tuusuario.serv00.net`) o tu dominio propio.
3. Tipo de sitio web (**Website type**): selecciona **Proxy**.
4. Proxy target: `http://localhost:34567` *(el puerto reservado en el Paso 2)*.
5. Guarda los cambios. ¡Tu sitio tendrá SSL HTTPS gratuito automático!

---

## 🔄 Paso 6: Iniciar la Aplicación de Forma Persistente (PM2)

En Serv00 puedes usar `pm2` para mantener la plataforma viva 24/7 y que reviva automáticamente si el servidor se reinicia:

```bash
# Instalar pm2 en tu cuenta si no está instalado
npm install -g pm2

# Iniciar la plataforma de campaña
pm2 start server/index.js --name "campana-kz"

# Guardar la lista de procesos para reinicios automáticos
pm2 save
```

Para verificar que esté corriendo:
```bash
pm2 status
pm2 logs campana-kz
```

---

## 📱 Paso 7: Vincular WhatsApp con Código QR desde la Web

1. Abre tu navegador e ingresa a tu enlace de Serv00: `https://tuusuario.serv00.net` (o tu dominio).
2. Inicia sesión con tus credenciales de administrador:
   * **Usuario:** `admin`
   * **Contraseña:** `Admin2026*!`
3. En el menú lateral, haz clic en **WhatsApp** (o `#whatsapp`).
4. Ve a la pestaña **Configuración**.
5. En **4. Proveedor de Salida de WhatsApp**, selecciona:
   👉 `📱 WhatsApp Nativo por Código QR (Serv00 / Local - Sin API de Pago)`.
6. Aparecerá el panel de vinculación:
   * Haz clic en el botón verde **"Generar Código QR de Vinculación"**.
   * En pocos segundos verás el código QR en pantalla.
7. Toma el celular con la línea dedicada de la campaña:
   * Abre **WhatsApp**.
   * Ve a **Dispositivos vinculados** -> **Vincular un dispositivo**.
   * Escanea el código QR que ves en tu navegador.
8. ¡Listo! El panel cambiará automáticamente a un estado verde: **"🟢 Conectado y Operativo"**, mostrando el número de teléfono vinculado.
9. Haz clic en **Guardar Configuración de WhatsApp** al final de la página.

---

## 🛡️ Seguridad y Buenas Prácticas de Campaña
1. **Línea Dedicada:** Usa siempre un chip prepago exclusivo para la campaña. No uses la línea personal del candidato.
2. **Persistencia:** La sesión de WhatsApp se almacena de forma segura en `server/whatsapp_session/`. Si el servidor se reinicia, Baileys reconecta automáticamente sin pedirte escanear el QR otra vez.
3. **Cierre de Sesión:** Si necesitas cambiar de número en cualquier momento, ve a `#whatsapp` -> Configuración y haz clic en **"Desvincular y Cerrar Sesión"**.
