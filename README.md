# 🗳️ Software de Cronograma y Notificaciones WhatsApp | #VOY CON EL KZ

Sistema integral de gestión de agenda territorial, cronograma de actividades diarias, comitivas de avanzada, panel de reportes ejecutivos y motor dual de notificaciones por WhatsApp para la campaña política oficial **"#VOY CON EL KZ"**.

![Logo Oficial #VOY CON EL KZ](/logo-kz.jpg)

---

## 🚀 Inicio Rápido

El servidor ya incluye el frontend compilado y la API en un solo proceso.

```bash
# Para iniciar la aplicación (Backend + Frontend unificado)
npm start
```

Abrir en el navegador: **[http://localhost:5000](http://localhost:5000)**

---

## 🔑 Credenciales de Acceso Precargadas

| Rol de Campaña | Correo Electrónico | Contraseña | Funciones |
|---|---|---|---|
| **Administrador General** | `admin@voyconelkz.com` | `kz2026!` | Control total, edición de agenda, difusión masiva y configuración |
| **Candidato KZ** | `candidato@voyconelkz.com` | `kz2026!` | Visualización de agenda, reportes de efectividad y hojas de ruta |
| **Coordinador de Avanzada** | `avanzada@voyconelkz.com` | `kz2026!` | Registro de actividades en territorio, logística y avisos de comitiva |

*(La pantalla de inicio de sesión incluye botones de 1-clic para entrar directamente con cualquiera de estos roles).*

---

## 📱 Módulo de Notificaciones por WhatsApp (Ambas Opciones)

### Opción 1: Enlaces Directos 1-Clic (WhatsApp Web y Móvil)
- **Cero costo y sin aprobación de Meta**: Funciona de inmediato desde cualquier computadora o celular.
- **Formato Enriquecido**: Genera automáticamente mensajes con negritas, emojis, horarios, ubicaciones con enlace a Google Maps y el eslogan oficial `#VOYCONELKZ`.
- **Modos de difusión**:
  - **Agenda Diaria Completa**: Resumen consolidado hora a hora de todos los eventos del día.
  - **Recordatorio Puntual**: Envío al coordinador o equipo asignado con detalles logísticos.
  - **Convocatoria a Líderes**: Invitación para que simpatizantes y comitiva acompañen al candidato.

### Opción 2: Gateway Automatizado / API
- **Disparo Masivo**: Botón para despachar la agenda matutina a todos los contactos del directorio de una sola vez.
- **Supervisión Automática en Segundo Plano (Cron)**: Revisa cada 10 minutos las actividades programadas y despacha recordatorios a la comitiva 60 minutos antes del inicio.
- **Proveedores Soportados**:
  - *Simulador Activo de Campaña*: Para pruebas y verificación visual sin costo en tiempo real.
  - *Evolution API / Baileys*: Conexión directa mediante escaneo de código QR de WhatsApp.
  - *Twilio WhatsApp Business API*: Integración REST con credenciales Account SID y Auth Token.
  - *Meta WhatsApp Cloud API*: Graph API oficial de Meta.
- **Historial de Mensajes**: Registro con fecha, hora, estado de entrega y destinatario.

---

## 📅 Módulos del Sistema

1. **Cronograma Diario**:
   - Vista cronológica del día seleccionado.
   - Control de estados: *Programado*, *En curso*, *Cumplido*, *Reprogramado*, *Cancelado*.
   - Filtros por categoría política (Mitin, Recorrido, Reunión, Prensa, Caravana, Volanteo, Almuerzo).
   - Requerimientos logísticos (sonido, transporte, banderas, refrigerios).
2. **Calendario de Campaña**:
   - Vista mensual interactiva con indicadores de eventos por día.
3. **Panel de Reportes**:
   - Métricas clave: % de cumplimiento de agenda, eventos en territorio, resumen por categoría.
   - Rendimiento por responsable y coordinador de avanzada.
4. **Directorio y Comitivas**:
   - Registro de avanzada, seguridad, comisiones de prensa y líderes barriales.
5. **Ficha de Ruta Oficial (Imprimible / PDF)**:
   - Formato membretado con el logo `#VOY CON EL KZ` listo para imprimir con un clic (`Ctrl + P` o botón Imprimir) para la comitiva de seguridad y caravana.

---

## 🛠️ Tecnologías Utilizadas

- **Backend**: Node.js, Express 5, SQLite (`sql.js` con persistencia en disco), JWT, BcryptJS, Node-Cron.
- **Frontend**: React 18, TypeScript, Tailwind CSS, Lucide Icons, Date-Fns.
- **Diseño**: Paleta cromática oficial de `#VOY CON EL KZ` (Azul Marino `#12263F`, Celeste `#38b6ff`, Blanco).
