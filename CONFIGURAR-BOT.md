# 🤖 Configuración del Bot de Telegram - Paso a Paso

## Estado Actual
✅ Bot creado: **@control_videos_bot**  
✅ Bot agregado al grupo  
✅ Token válido en `.env.local`  
❌ **Webhook NO configurado** ← Por eso no responde

## 🎯 Objetivo
Configurar el webhook para que Telegram sepa dónde enviar los mensajes del bot.

---

## 📋 PASO 1: Instalar ngrok

ngrok crea un túnel HTTPS desde internet hacia tu localhost:3000

### Windows:
1. Ve a [ngrok.com/download](https://ngrok.com/download)
2. Descarga ngrok para Windows
3. Extrae el archivo `ngrok.exe` en una carpeta (ej: `C:\ngrok\`)
4. Agrega esa carpeta al PATH o úsalo desde ahí

### Alternativa con npm:
```bash
npm install -g ngrok
```

---

## 📋 PASO 2: Obtener Authtoken de ngrok

1. Regístrate gratis en [ngrok.com/signup](https://ngrok.com/signup)
2. Copia tu authtoken del dashboard
3. Configura ngrok:

```bash
ngrok config add-authtoken TU_AUTHTOKEN_AQUI
```

---

## 📋 PASO 3: Iniciar ngrok

**Importante**: Abre una terminal NUEVA y deja esta corriendo:

```bash
ngrok http 3000
```

Verás algo como:
```
Session Status                online
Forwarding                    https://abc123def456.ngrok.io -> http://localhost:3000
```

**COPIA LA URL HTTPS** (ej: `https://abc123def456.ngrok.io`)

---

## 📋 PASO 4: Configurar el Webhook

Abre OTRA terminal y ejecuta el script de configuración:

```bash
node scripts/setup-bot.js
```

Cuando te pida la URL, pega la URL de ngrok (ej: `https://abc123def456.ngrok.io`)

El script configurará automáticamente el webhook.

---

## 📋 PASO 5: Verificar que Funciona

### Verificar Webhook:
```bash
curl https://api.telegram.org/bot8058907728:AAF-Bd2C91GMTZYVo5QzWIvOv5oTVsdslsM/getWebhookInfo
```

Deberías ver tu URL de ngrok configurada.

### Probar el Bot:

1. **En mensaje privado al bot:**
   - Abre @control_videos_bot en Telegram
   - Envía: `/start`
   - El bot debe responder: "¡Bienvenido a VidProof! 🎬"

2. **En el grupo:**
   - El bot necesita permisos de administrador para leer mensajes
   - O menciona el bot: `@control_videos_bot /start`

---

## 📋 PASO 6: Mantener Todo Corriendo

Para que el bot funcione, necesitas tener corriendo:

1. ✅ Terminal 1: `npm run dev` (Puerto 3000)
2. ✅ Terminal 2: `ngrok http 3000` (Túnel HTTPS)

**Si cierras ngrok**, la URL cambia y debes reconfigurar el webhook (volver al Paso 4).

---

## 🎬 Flujo Completo del Bot

### Usuario Nuevo:
1. Usuario envía `/start`
2. Bot pide nombre completo
3. Usuario envía su nombre
4. Bot registra al usuario en la base de datos
5. Bot crea tareas automáticamente para videos existentes

### Enviar Evidencia:
1. Usuario envía una foto (captura del video)
2. Bot busca la tarea pendiente más antigua
3. Bot sube la foto a Supabase Storage
4. Bot marca la tarea como COMPLETADA
5. Bot confirma: "¡Evidencia recibida para el video [Nombre]!"

### Crear Video (desde Dashboard):
1. Admin crea video en el dashboard
2. Sistema crea tareas para todos los usuarios
3. Bot envía notificación masiva a todos los usuarios

---

## 🔧 Problemas Comunes

### "El bot no responde"
✅ Verifica que ngrok esté corriendo  
✅ Verifica que `npm run dev` esté corriendo  
✅ Verifica el webhook: `curl https://api.telegram.org/bot8058907728:AAF-Bd2C91GMTZYVo5QzWIvOv5oTVsdslsM/getWebhookInfo`

### "El bot no lee mensajes en el grupo"
✅ Haz al bot administrador del grupo  
✅ O deshabilita "Group Privacy" en @BotFather:
   - Habla con @BotFather
   - Envía: `/mybots`
   - Selecciona: @control_videos_bot
   - Bot Settings > Group Privacy > Turn Off

### "La URL de ngrok cambió"
✅ Cada vez que reinicias ngrok, la URL cambia (gratis)  
✅ Reconfigura el webhook con la nueva URL  
✅ O usa ngrok pago para URL estática

---

## 🚀 Producción

Para producción (sin ngrok):

1. **Despliega en Vercel:**
   ```bash
   vercel --prod
   ```

2. **Configura el webhook:**
   ```bash
   curl -X POST https://tu-app.vercel.app/api/telegram/setup
   ```

3. Ya no necesitas ngrok, el bot funcionará 24/7

---

## 📱 Comandos del Bot

| Comando | Descripción |
|---------|-------------|
| `/start` | Registrarse o ver bienvenida |
| Enviar foto | Registrar evidencia de video |
| Texto | Si no estás registrado, se guarda como tu nombre |

---

## ✅ Checklist de Verificación

- [ ] ngrok instalado y configurado con authtoken
- [ ] Terminal 1: `npm run dev` corriendo
- [ ] Terminal 2: `ngrok http 3000` corriendo
- [ ] URL de ngrok copiada
- [ ] Script `setup-bot.js` ejecutado con URL de ngrok
- [ ] Webhook configurado correctamente
- [ ] Bot responde a `/start` en chat privado
- [ ] Bot tiene permisos en el grupo (admin o privacy off)
