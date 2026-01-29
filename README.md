# VidProof - Plataforma de Gestión de Cumplimiento

Plataforma SaaS privada para gestionar el cumplimiento de trabajadores mediante videos. Incluye un Dashboard administrativo y un Bot de Telegram como interfaz para usuarios.

## Stack Tecnológico

- **Frontend**: Next.js 15 (App Router), Tailwind CSS, Shadcn/UI
- **Backend**: Supabase (Auth, PostgreSQL, Storage) - **Usando nuevas Publishable/Secret Keys**
- **Bot**: Telegram Bot API (Webhooks)
- **Estado**: TanStack Query (React Query)

## Configuración Inicial

### 1. Configurar Supabase

1. Crea un proyecto en [Supabase](https://supabase.com)
2. Ve al **SQL Editor** y ejecuta el contenido de `schema.sql`
3. Crea un bucket de Storage llamado `evidencias` (público)
4. Ve a **Settings > API Keys** y habilita las nuevas Publishable/Secret keys
5. Copia las credenciales del proyecto

### 2. Configurar Variables de Entorno

Copia `.env.example` a `.env.local` y completa:

```env
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_tu_publishable_key
SUPABASE_SECRET_KEY=sb_secret_tu_secret_key
TELEGRAM_BOT_TOKEN=tu_bot_token
NEXT_PUBLIC_APP_URL=https://tu-dominio.com
CRON_SECRET=un_secret_aleatorio
```

### 3. Crear Bot de Telegram

1. Habla con [@BotFather](https://t.me/BotFather) en Telegram
2. Usa `/newbot` y sigue las instrucciones
3. Copia el token y agrégalo a `.env.local`

### 4. Instalar Dependencias

```bash
npm install
```

### 5. Ejecutar en Desarrollo

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000)

## Configurar Webhook de Telegram

Después de desplegar, configura el webhook:

```bash
curl -X POST https://tu-dominio.com/api/telegram/setup
```

O visita `GET /api/telegram/setup` para ver el estado actual.

## Estructura del Proyecto

```
vidproof/
├── app/
│   ├── actions/          # Server Actions
│   ├── api/
│   │   ├── cron/         # Cron jobs
│   │   └── telegram/     # Webhook del bot
│   └── dashboard/        # Panel de control
├── components/
│   ├── dashboard/        # Componentes del dashboard
│   ├── providers/        # Context providers
│   └── ui/               # Componentes UI reutilizables
├── lib/
│   └── supabase/         # Cliente Supabase
├── types/                # Tipos TypeScript
└── schema.sql            # Schema de la base de datos
```

## Funcionalidades

### Dashboard

- **Estadísticas**: % cumplimiento, usuarios activos, videos pendientes
- **Gestión de Videos**: Crear videos con notificación automática
- **Monitor de Seguimiento**: Tabla con filtros, vista de evidencias, rechazo

### Bot de Telegram

- `/start`: Registro de nuevos usuarios
- **Envío de fotos**: Registro automático de evidencias
- **Notificaciones**: Alertas de nuevos videos y rechazos

### Automatización

- **Cron cada 4 horas**: Recordatorios automáticos de tareas pendientes

## Despliegue

### Vercel (Recomendado)

1. Conecta el repositorio a Vercel
2. Configura las variables de entorno
3. Despliega

El archivo `vercel.json` configura automáticamente el cron job.

### Configurar Webhook Post-Deploy

Después de desplegar, ejecuta:

```bash
curl -X POST https://tu-app.vercel.app/api/telegram/setup
```

## Comandos

```bash
npm run dev      # Desarrollo
npm run build    # Build de producción
npm run start    # Servidor de producción
npm run lint     # Linter
```

## Modelo de Datos

- **perfiles**: Usuarios registrados via Telegram
- **videos**: Videos que deben ver los usuarios
- **tareas**: Relación usuario-video con estado de cumplimiento

Ver `schema.sql` para detalles completos.
