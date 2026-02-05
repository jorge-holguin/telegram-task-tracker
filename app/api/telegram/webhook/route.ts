import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/client"
import sharp from "sharp"

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ""

type Rango = 'usuario' | 'administrador'

interface TelegramUpdate {
  update_id: number
  message?: {
    message_id: number
    from: {
      id: number
      first_name: string
      last_name?: string
      username?: string
    }
    chat: {
      id: number
      type: string
    }
    date: number
    text?: string
    photo?: Array<{
      file_id: string
      file_unique_id: string
      width: number
      height: number
      file_size?: number
    }>
    video?: {
      file_id: string
      file_unique_id: string
      width: number
      height: number
      duration: number
      file_size?: number
    }
  }
  callback_query?: {
    id: string
    from: {
      id: number
      first_name: string
    }
    message?: {
      message_id: number
      chat: {
        id: number
      }
    }
    data?: string
  }
}

interface UserSession {
  step: 'waiting_video' | 'waiting_title' | 'waiting_evidence' | 'waiting_broadcast' | 'waiting_new_name'
  videoFileId?: string
  selectedTaskId?: string
}

// Estado temporal para flujos (en memoria, se pierde al reiniciar)
const userSessions: Map<number, UserSession> = new Map()

async function sendMessage(chatId: number, text: string, parseMode?: string) {
  try {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: parseMode || "Markdown",
      }),
    })
    
    const data = await response.json()
    
    if (!data.ok) {
      console.error("Telegram API error:", data)
    }
    
    return data
  } catch (error) {
    console.error("SendMessage error:", error)
    throw error
  }
}

async function getFileUrl(fileId: string): Promise<string | null> {
  const response = await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`
  )
  const data = await response.json()
  
  if (data.ok && data.result.file_path) {
    return `https://api.telegram.org/file/bot${BOT_TOKEN}/${data.result.file_path}`
  }
  return null
}

async function handleStart(telegramId: number, chatId: number, firstName: string) {
  const supabase = createServerClient()
  
  const { data: existingPerfil } = await supabase
    .from("perfiles")
    .select("*")
    .eq("telegram_id", telegramId)
    .single()
  
  if (existingPerfil) {
    await sendMessage(
      chatId,
      `¡Hola de nuevo, ${existingPerfil.nombre_completo}! 👋\n\nEnvía una captura de pantalla para registrar tu evidencia.`
    )
    return
  }
  
  await sendMessage(
    chatId,
    `¡Bienvenido a VidProof! 🎬\n\nPor favor, envía tu *nombre completo* para registrarte.`
  )
}

async function handleMiEvidencia(telegramId: number, chatId: number) {
  const supabase = createServerClient()
  
  // Verificar que el usuario existe
  const { data: perfil } = await supabase
    .from("perfiles")
    .select("id, nombre_completo")
    .eq("telegram_id", telegramId)
    .single()
  
  if (!perfil) {
    await sendMessage(
      chatId,
      "No estás registrado. Envía /start para registrarte primero."
    )
    return
  }
  
  // Obtener las últimas tareas del usuario (completadas y pendientes)
  const { data: tareas } = await supabase
    .from("tareas")
    .select("id, estado, url_evidencia, fecha_entrega, videos(titulo)")
    .eq("perfil_id", perfil.id)
    .order("created_at", { ascending: false })
    .limit(10)
  
  if (!tareas || tareas.length === 0) {
    await sendMessage(
      chatId,
      `👤 *${perfil.nombre_completo}*\n\nNo tienes tareas asignadas aún.`
    )
    return
  }
  
  let mensaje = `👤 *${perfil.nombre_completo}*\n\n📋 *Tus últimas tareas:*\n\n`
  
  let completadas = 0
  let pendientes = 0
  
  for (const tarea of tareas) {
    const videoData = tarea.videos as unknown as { titulo: string } | null
    const videoTitulo = videoData?.titulo || "Video desconocido"
    
    if (tarea.estado === "COMPLETADO") {
      completadas++
      const fecha = tarea.fecha_entrega 
        ? new Date(tarea.fecha_entrega).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        : "Sin fecha"
      mensaje += `✅ *${videoTitulo}*\n   Completado: ${fecha}\n`
      if (tarea.url_evidencia) {
        mensaje += `   📸 [Ver evidencia](${tarea.url_evidencia})\n`
      }
    } else {
      pendientes++
      mensaje += `⏳ *${videoTitulo}* - Pendiente\n`
    }
    mensaje += "\n"
  }
  
  mensaje += `───────────────────\n`
  mensaje += `✅ Completadas: ${completadas}\n`
  mensaje += `⏳ Pendientes: ${pendientes}`
  
  await sendMessage(chatId, mensaje)
}

async function handleReporte(chatId: number) {
  const supabase = createServerClient()
  
  // Obtener todas las tareas pendientes con información de usuarios
  const { data: tareasPendientes } = await supabase
    .from("vista_monitor_tareas")
    .select("*")
    .eq("estado", "PENDIENTE")
  
  if (!tareasPendientes || tareasPendientes.length === 0) {
    await sendMessage(
      chatId,
      "✅ *Reporte de Pendientes*\n\n¡Excelente! Todos los usuarios han completado sus tareas."
    )
    return
  }
  
  // Agrupar por usuario
  interface TareaData {
    nombre_completo: string
    video_titulo: string
  }
  
  const tareasPorUsuario = (tareasPendientes as TareaData[]).reduce((acc, tarea) => {
    if (!acc[tarea.nombre_completo]) {
      acc[tarea.nombre_completo] = []
    }
    acc[tarea.nombre_completo].push(tarea.video_titulo)
    return acc
  }, {} as Record<string, string[]>)
  
  // Formatear mensaje
  let reporte = "📊 *Reporte de Tareas Pendientes*\n\n"
  reporte += `Total de tareas pendientes: ${tareasPendientes.length}\n`
  reporte += `Usuarios con pendientes: ${Object.keys(tareasPorUsuario).length}\n\n`
  reporte += "───────────────────\n\n"
  
  for (const [nombre, videos] of Object.entries(tareasPorUsuario)) {
    reporte += `👤 *${nombre}* (${videos.length})\n`
    videos.forEach(video => {
      reporte += `   • ${video}\n`
    })
    reporte += "\n"
  }
  
  await sendMessage(chatId, reporte)
}

async function handleTextMessage(
  telegramId: number,
  chatId: number,
  text: string,
  firstName: string
) {
  const supabase = createServerClient()
  
  const { data: existingPerfil } = await supabase
    .from("perfiles")
    .select("*")
    .eq("telegram_id", telegramId)
    .single()
  
  if (!existingPerfil) {
    const nombreCompleto = text.trim()
    
    if (nombreCompleto.length < 3) {
      await sendMessage(chatId, "Por favor, envía un nombre válido (mínimo 3 caracteres).")
      return
    }
    
    const { error } = await supabase.from("perfiles").insert({
      telegram_id: telegramId,
      nombre_completo: nombreCompleto,
      activo: true,
    })
    
    if (error) {
      await sendMessage(chatId, "Hubo un error al registrarte. Por favor, intenta de nuevo.")
      return
    }
    
    // Obtener el perfil recién creado
    const { data: nuevoPerfil } = await supabase
      .from("perfiles")
      .select("id")
      .eq("telegram_id", telegramId)
      .single()
    
    // Crear tareas para videos activos
    if (nuevoPerfil) {
      const { data: videos } = await supabase
        .from("videos")
        .select("id")
        .eq("activo", true)
      
      if (videos && videos.length > 0) {
        await supabase.from("tareas").insert(
          videos.map((v: { id: string }) => ({
            video_id: v.id,
            perfil_id: nuevoPerfil.id,
            estado: "PENDIENTE",
          }))
        )
      }
    }
    
    await sendMessage(
      chatId,
      `¡Registro exitoso, ${nombreCompleto}! ✅\n\nCuando veas un video, envía una captura de pantalla como evidencia.`
    )
    return
  }
  
  await sendMessage(
    chatId,
    `Hola ${existingPerfil.nombre_completo}, para registrar una evidencia, envía una *foto* (captura de pantalla del video).`
  )
}

async function handlePhoto(
  telegramId: number,
  chatId: number,
  photo: TelegramUpdate["message"]
) {
  const supabase = createServerClient()
  
  const { data: perfil } = await supabase
    .from("perfiles")
    .select("id, nombre_completo")
    .eq("telegram_id", telegramId)
    .single()
  
  if (!perfil) {
    await sendMessage(
      chatId,
      "Primero debes registrarte. Envía /start para comenzar."
    )
    return
  }
  
  // Buscar la tarea pendiente más antigua
  const { data: tareaPendiente } = await supabase
    .from("tareas")
    .select("id, video_id, videos(titulo)")
    .eq("perfil_id", perfil.id)
    .eq("estado", "PENDIENTE")
    .order("created_at", { ascending: true })
    .limit(1)
    .single()
  
  if (!tareaPendiente) {
    await sendMessage(
      chatId,
      "¡No tienes tareas pendientes! 🎉 Ya completaste todas tus evidencias."
    )
    return
  }
  
  // Obtener la foto más grande
  const photos = photo?.photo
  if (!photos || photos.length === 0) {
    await sendMessage(chatId, "Error al procesar la imagen. Intenta de nuevo.")
    return
  }
  
  const largestPhoto = photos[photos.length - 1]
  const fileUrl = await getFileUrl(largestPhoto.file_id)
  
  if (!fileUrl) {
    await sendMessage(chatId, "Error al obtener la imagen. Intenta de nuevo.")
    return
  }
  
  // Descargar la imagen
  const imageResponse = await fetch(fileUrl)
  const imageBuffer = await imageResponse.arrayBuffer()
  
  // Comprimir la imagen con sharp (reduce tamaño ~70%)
  let compressedBuffer: Buffer
  try {
    compressedBuffer = await sharp(Buffer.from(imageBuffer))
      .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 70, mozjpeg: true })
      .toBuffer()
  } catch (compressError) {
    console.error("Error compressing image:", compressError)
    // Si falla la compresión, usar la imagen original
    compressedBuffer = Buffer.from(imageBuffer)
  }
  
  // Subir a Supabase Storage
  const fileName = `${telegramId}/${tareaPendiente.id}_${Date.now()}.jpg`
  
  const { error: uploadError } = await supabase.storage
    .from("evidencias")
    .upload(fileName, compressedBuffer, {
      contentType: "image/jpeg",
      upsert: true,
    })
  
  if (uploadError) {
    console.error("Error uploading:", uploadError)
    await sendMessage(
      chatId,
      "Error al guardar la imagen. Por favor, intenta de nuevo."
    )
    return
  }
  
  // Obtener URL pública
  const { data: urlData } = supabase.storage
    .from("evidencias")
    .getPublicUrl(fileName)
  
  // Actualizar la tarea
  const { error: updateError } = await supabase
    .from("tareas")
    .update({
      estado: "COMPLETADO",
      url_evidencia: urlData.publicUrl,
      fecha_entrega: new Date().toISOString(),
    })
    .eq("id", tareaPendiente.id)
  
  if (updateError) {
    await sendMessage(chatId, "Error al actualizar la tarea. Intenta de nuevo.")
    return
  }
  
  // Obtener el título del video
  interface VideoData {
    titulo: string
  }
  const videoTitulo = (tareaPendiente.videos as unknown as VideoData)?.titulo || "el video"
  
  // Contar tareas pendientes restantes
  const { count } = await supabase
    .from("tareas")
    .select("*", { count: "exact", head: true })
    .eq("perfil_id", perfil.id)
    .eq("estado", "PENDIENTE")
  
  const pendientesMsg = count && count > 0
    ? `\n\nTienes ${count} tarea(s) pendiente(s).`
    : "\n\n¡Has completado todas tus tareas! 🎉"
  
  await sendMessage(
    chatId,
    `✅ ¡Evidencia recibida para *${videoTitulo}*!${pendientesMsg}`
  )
}

async function handleVideoCommand(telegramId: number, chatId: number) {
  // Iniciar sesión de subida de video
  userSessions.set(telegramId, { step: 'waiting_video' })
  
  await sendMessage(
    chatId,
    `📹 *Subir Nuevo Video*\n\nEnvía el video que quieres compartir con todos los participantes.\n\n⚠️ El video será comprimido automáticamente por Telegram.`
  )
}

async function handleVideoReceived(telegramId: number, chatId: number, video: TelegramUpdate["message"]) {
  const session = userSessions.get(telegramId)
  
  if (!session || session.step !== 'waiting_video') {
    await sendMessage(
      chatId,
      "Para subir un video, primero envía el comando /video"
    )
    return
  }
  
  const videoData = video?.video
  if (!videoData) {
    await sendMessage(chatId, "Error al procesar el video. Intenta de nuevo.")
    return
  }
  
  // Guardar el file_id del video
  userSessions.set(telegramId, {
    step: 'waiting_title',
    videoFileId: videoData.file_id,
  })
  
  await sendMessage(
    chatId,
    `✅ Video recibido (${Math.round((videoData.file_size || 0) / 1024 / 1024 * 100) / 100} MB)\n\nAhora envía el *título* del video:`
  )
}

async function handleVideoTitle(telegramId: number, chatId: number, titulo: string) {
  const session = userSessions.get(telegramId)
  
  if (!session || session.step !== 'waiting_title' || !session.videoFileId) {
    return false // No está en flujo de video
  }
  
  const supabase = createServerClient()
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  
  await sendMessage(chatId, `⏳ Procesando y enviando video a todos los participantes...`)
  
  // Crear el video en la base de datos
  const { data: videoDb, error: videoError } = await supabase
    .from("videos")
    .insert({
      titulo: titulo.trim(),
      url_video: `telegram:${session.videoFileId}`, // Guardamos el file_id de Telegram
      descripcion: "Video subido desde Telegram",
      activo: true,
      tipo_video: 'telegram',
      fecha_expiracion: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    })
    .select()
    .single()
  
  if (videoError) {
    await sendMessage(chatId, `❌ Error al guardar el video: ${videoError.message}`)
    userSessions.delete(telegramId)
    return true
  }
  
  // Obtener todos los perfiles activos
  const { data: perfiles } = await supabase
    .from("perfiles")
    .select("id, telegram_id")
    .eq("activo", true)
  
  if (!perfiles || perfiles.length === 0) {
    await sendMessage(chatId, `⚠️ Video guardado pero no hay usuarios registrados para notificar.`)
    userSessions.delete(telegramId)
    return true
  }
  
  // Crear tareas para todos los perfiles
  const tareas = perfiles.map(p => ({
    video_id: videoDb.id,
    perfil_id: p.id,
    estado: "PENDIENTE" as const,
  }))
  
  await supabase.from("tareas").insert(tareas)
  
  // Enviar el video a todos los participantes
  const caption = `📹 *${titulo.trim()}*\n\n⬇️ Descarga este video, resúbelo en tus redes sociales y envía una captura de pantalla como evidencia.`
  
  let exitosos = 0
  let fallidos = 0
  
  for (const perfil of perfiles) {
    try {
      const response = await fetch(`https://api.telegram.org/bot${botToken}/sendVideo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: perfil.telegram_id,
          video: session.videoFileId,
          caption: caption,
          parse_mode: "Markdown",
          supports_streaming: true,
        }),
      })
      
      const result = await response.json()
      if (result.ok) {
        exitosos++
      } else {
        fallidos++
        console.error(`Error enviando a ${perfil.telegram_id}:`, result)
      }
    } catch (err) {
      fallidos++
      console.error(`Error enviando a ${perfil.telegram_id}:`, err)
    }
  }
  
  // Limpiar sesión
  userSessions.delete(telegramId)
  
  await sendMessage(
    chatId,
    `✅ *Video publicado exitosamente!*\n\n📊 Resumen:\n• Título: *${titulo.trim()}*\n• Enviado a: ${exitosos} usuarios\n• Fallidos: ${fallidos}\n• Expira en: 7 días\n\nLos usuarios deben enviar una captura de pantalla como evidencia.`
  )
  
  return true
}

// =============================================
// Función para verificar si es administrador
// =============================================
async function isAdmin(telegramId: number): Promise<boolean> {
  const supabase = createServerClient()
  const { data: perfil } = await supabase
    .from("perfiles")
    .select("rango")
    .eq("telegram_id", telegramId)
    .single()
  
  return perfil?.rango === 'administrador'
}

// =============================================
// Comando /help - Lista todos los comandos
// =============================================
async function handleHelp(telegramId: number, chatId: number) {
  const admin = await isAdmin(telegramId)
  
  let mensaje = `📋 *Comandos Disponibles*\n\n`
  mensaje += `*Generales:*\n`
  mensaje += `/start - Registrarte o reiniciar\n`
  mensaje += `/help - Ver esta ayuda\n`
  mensaje += `/cancelar - Cancelar operación actual\n\n`
  
  mensaje += `*Evidencias:*\n`
  mensaje += `/evidencia - Subir evidencia (selector de video)\n`
  mensaje += `/mievidencia - Ver tus tareas\n`
  mensaje += `/pendientes - Ver solo tareas pendientes\n\n`
  
  mensaje += `*Información:*\n`
  mensaje += `/videos - Ver videos activos\n`
  mensaje += `/stats - Tu progreso personal\n`
  mensaje += `/perfil - Ver/editar tu perfil\n`
  mensaje += `/ranking - Top de usuarios\n`
  mensaje += `/recordatorio - Solicitar recordatorio\n`
  
  if (admin) {
    mensaje += `\n*👑 Comandos de Admin:*\n`
    mensaje += `/video - Subir nuevo video\n`
    mensaje += `/reporte - Reporte de pendientes\n`
    mensaje += `/broadcast - Mensaje masivo\n`
    mensaje += `/usuarios - Lista de usuarios\n`
    mensaje += `/desactivar - Desactivar usuario\n`
  }
  
  await sendMessage(chatId, mensaje)
}

// =============================================
// Comando /pendientes - Muestra solo tareas pendientes
// =============================================
async function handlePendientes(telegramId: number, chatId: number) {
  const supabase = createServerClient()
  
  const { data: perfil } = await supabase
    .from("perfiles")
    .select("id, nombre_completo")
    .eq("telegram_id", telegramId)
    .single()
  
  if (!perfil) {
    await sendMessage(chatId, "No estás registrado. Envía /start para registrarte.")
    return
  }
  
  const { data: tareas } = await supabase
    .from("tareas")
    .select("id, videos(titulo)")
    .eq("perfil_id", perfil.id)
    .eq("estado", "PENDIENTE")
    .order("created_at", { ascending: true })
  
  if (!tareas || tareas.length === 0) {
    await sendMessage(chatId, "🎉 ¡No tienes tareas pendientes! Has completado todo.")
    return
  }
  
  let mensaje = `⏳ *Tienes ${tareas.length} tarea(s) pendiente(s):*\n\n`
  
  tareas.forEach((tarea, index) => {
    const videoData = tarea.videos as unknown as { titulo: string } | null
    mensaje += `${index + 1}. ${videoData?.titulo || "Video sin título"}\n`
  })
  
  mensaje += `\n📸 Envía /evidencia para subir una captura.`
  
  await sendMessage(chatId, mensaje)
}

// =============================================
// Comando /videos - Lista videos activos
// =============================================
async function handleVideos(chatId: number) {
  const supabase = createServerClient()
  
  const { data: videos } = await supabase
    .from("videos")
    .select("titulo, descripcion, creado_at")
    .eq("activo", true)
    .order("creado_at", { ascending: false })
  
  if (!videos || videos.length === 0) {
    await sendMessage(chatId, "📹 No hay videos activos en este momento.")
    return
  }
  
  let mensaje = `📹 *Videos Activos (${videos.length}):*\n\n`
  
  videos.forEach((video, index) => {
    const fecha = new Date(video.creado_at).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit' })
    mensaje += `${index + 1}. *${video.titulo}*\n`
    mensaje += `   📅 ${fecha}\n\n`
  })
  
  await sendMessage(chatId, mensaje)
}

// =============================================
// Comando /stats - Estadísticas personales
// =============================================
async function handleStats(telegramId: number, chatId: number) {
  const supabase = createServerClient()
  
  const { data: perfil } = await supabase
    .from("perfiles")
    .select("id, nombre_completo, fecha_registro")
    .eq("telegram_id", telegramId)
    .single()
  
  if (!perfil) {
    await sendMessage(chatId, "No estás registrado. Envía /start para registrarte.")
    return
  }
  
  const { data: tareas } = await supabase
    .from("tareas")
    .select("estado")
    .eq("perfil_id", perfil.id)
  
  const completadas = tareas?.filter(t => t.estado === "COMPLETADO").length || 0
  const pendientes = tareas?.filter(t => t.estado === "PENDIENTE").length || 0
  const total = tareas?.length || 0
  const porcentaje = total > 0 ? Math.round((completadas / total) * 100) : 0
  
  const fechaRegistro = new Date(perfil.fecha_registro).toLocaleDateString('es-PE')
  
  let barra = ""
  const lleno = Math.round(porcentaje / 10)
  for (let i = 0; i < 10; i++) {
    barra += i < lleno ? "▓" : "░"
  }
  
  let mensaje = `📊 *Estadísticas de ${perfil.nombre_completo}*\n\n`
  mensaje += `📅 Registrado: ${fechaRegistro}\n\n`
  mensaje += `${barra} ${porcentaje}%\n\n`
  mensaje += `✅ Completadas: ${completadas}\n`
  mensaje += `⏳ Pendientes: ${pendientes}\n`
  mensaje += `📋 Total: ${total}`
  
  await sendMessage(chatId, mensaje)
}

// =============================================
// Comando /perfil - Ver/editar perfil
// =============================================
async function handlePerfil(telegramId: number, chatId: number) {
  const supabase = createServerClient()
  
  const { data: perfil } = await supabase
    .from("perfiles")
    .select("*")
    .eq("telegram_id", telegramId)
    .single()
  
  if (!perfil) {
    await sendMessage(chatId, "No estás registrado. Envía /start para registrarte.")
    return
  }
  
  const fechaRegistro = new Date(perfil.fecha_registro).toLocaleDateString('es-PE')
  const rango = perfil.rango === 'administrador' ? '👑 Administrador' : '👤 Usuario'
  
  let mensaje = `👤 *Tu Perfil*\n\n`
  mensaje += `*Nombre:* ${perfil.nombre_completo}\n`
  mensaje += `*Telegram ID:* ${perfil.telegram_id}\n`
  mensaje += `*Rango:* ${rango}\n`
  mensaje += `*Estado:* ${perfil.activo ? '✅ Activo' : '❌ Inactivo'}\n`
  mensaje += `*Registrado:* ${fechaRegistro}\n\n`
  mensaje += `Para cambiar tu nombre, usa:\n/editarnombre [nuevo nombre]`
  
  await sendMessage(chatId, mensaje)
}

// =============================================
// Comando /editarnombre - Cambiar nombre
// =============================================
async function handleEditarNombre(telegramId: number, chatId: number, nuevoNombre: string) {
  const supabase = createServerClient()
  
  if (nuevoNombre.length < 3) {
    await sendMessage(chatId, "El nombre debe tener al menos 3 caracteres.")
    return
  }
  
  const { error } = await supabase
    .from("perfiles")
    .update({ nombre_completo: nuevoNombre.trim() })
    .eq("telegram_id", telegramId)
  
  if (error) {
    await sendMessage(chatId, "Error al actualizar el nombre. Intenta de nuevo.")
    return
  }
  
  await sendMessage(chatId, `✅ Nombre actualizado a: *${nuevoNombre.trim()}*`)
}

// =============================================
// Comando /ranking - Top de usuarios
// =============================================
async function handleRanking(chatId: number) {
  const supabase = createServerClient()
  
  const { data: ranking } = await supabase
    .from("vista_ranking_usuarios")
    .select("*")
    .limit(10)
  
  if (!ranking || ranking.length === 0) {
    await sendMessage(chatId, "No hay datos de ranking disponibles.")
    return
  }
  
  let mensaje = `🏆 *Top 10 Usuarios*\n\n`
  
  const medallas = ['🥇', '🥈', '🥉']
  
  ranking.forEach((user, index) => {
    const medalla = index < 3 ? medallas[index] : `${index + 1}.`
    mensaje += `${medalla} *${user.nombre_completo}*\n`
    mensaje += `   ✅ ${user.tareas_completadas} | ${user.porcentaje_completado}%\n`
  })
  
  await sendMessage(chatId, mensaje)
}

// =============================================
// Comando /recordatorio - Solicitar recordatorio manual
// =============================================
async function handleRecordatorio(telegramId: number, chatId: number) {
  const supabase = createServerClient()
  
  const { data: perfil } = await supabase
    .from("perfiles")
    .select("id, nombre_completo")
    .eq("telegram_id", telegramId)
    .single()
  
  if (!perfil) {
    await sendMessage(chatId, "No estás registrado. Envía /start para registrarte.")
    return
  }
  
  const { data: tareas } = await supabase
    .from("tareas")
    .select("videos(titulo)")
    .eq("perfil_id", perfil.id)
    .eq("estado", "PENDIENTE")
  
  if (!tareas || tareas.length === 0) {
    await sendMessage(chatId, "🎉 ¡No tienes tareas pendientes!")
    return
  }
  
  let mensaje = `⏰ *Recordatorio Solicitado*\n\n`
  mensaje += `Hola ${perfil.nombre_completo}, tienes ${tareas.length} video(s) pendiente(s):\n\n`
  
  tareas.forEach(tarea => {
    const videoData = tarea.videos as unknown as { titulo: string } | null
    mensaje += `• ${videoData?.titulo || "Video sin título"}\n`
  })
  
  mensaje += `\n📸 Envía una captura de pantalla como evidencia.`
  
  await sendMessage(chatId, mensaje)
}

// =============================================
// Comando /evidencia - Selector de video para evidencia
// =============================================
async function handleEvidenciaCommand(telegramId: number, chatId: number) {
  const supabase = createServerClient()
  
  const { data: perfil } = await supabase
    .from("perfiles")
    .select("id")
    .eq("telegram_id", telegramId)
    .single()
  
  if (!perfil) {
    await sendMessage(chatId, "No estás registrado. Envía /start para registrarte.")
    return
  }
  
  const { data: tareas } = await supabase
    .from("tareas")
    .select("id, videos(titulo)")
    .eq("perfil_id", perfil.id)
    .eq("estado", "PENDIENTE")
    .order("created_at", { ascending: true })
  
  if (!tareas || tareas.length === 0) {
    await sendMessage(chatId, "🎉 ¡No tienes tareas pendientes!")
    return
  }
  
  if (tareas.length === 1) {
    // Solo una tarea, seleccionarla automáticamente
    userSessions.set(telegramId, { step: 'waiting_evidence', selectedTaskId: tareas[0].id })
    const videoData = tareas[0].videos as unknown as { titulo: string } | null
    await sendMessage(chatId, `📸 Envía la captura de pantalla para:\n*${videoData?.titulo || "Video"}*`)
    return
  }
  
  // Múltiples tareas, mostrar selector
  let mensaje = `📋 *Selecciona el video para tu evidencia:*\n\n`
  
  tareas.forEach((tarea, index) => {
    const videoData = tarea.videos as unknown as { titulo: string } | null
    mensaje += `${index + 1}. ${videoData?.titulo || "Video sin título"}\n`
  })
  
  mensaje += `\nResponde con el *número* del video:`
  
  userSessions.set(telegramId, { step: 'waiting_evidence' })
  await sendMessage(chatId, mensaje)
}

// =============================================
// Manejar selección de video para evidencia
// =============================================
async function handleEvidenciaSelection(telegramId: number, chatId: number, selection: string) {
  const supabase = createServerClient()
  
  const { data: perfil } = await supabase
    .from("perfiles")
    .select("id")
    .eq("telegram_id", telegramId)
    .single()
  
  if (!perfil) return false
  
  const { data: tareas } = await supabase
    .from("tareas")
    .select("id, videos(titulo)")
    .eq("perfil_id", perfil.id)
    .eq("estado", "PENDIENTE")
    .order("created_at", { ascending: true })
  
  if (!tareas || tareas.length === 0) return false
  
  const index = parseInt(selection) - 1
  
  if (isNaN(index) || index < 0 || index >= tareas.length) {
    await sendMessage(chatId, `❌ Número inválido. Selecciona un número entre 1 y ${tareas.length}`)
    return true
  }
  
  const tareaSeleccionada = tareas[index]
  const videoData = tareaSeleccionada.videos as unknown as { titulo: string } | null
  
  userSessions.set(telegramId, { step: 'waiting_evidence', selectedTaskId: tareaSeleccionada.id })
  
  await sendMessage(chatId, `✅ Seleccionaste: *${videoData?.titulo || "Video"}*\n\n📸 Ahora envía la captura de pantalla:`)
  
  return true
}

// =============================================
// Manejar foto con tarea seleccionada
// =============================================
async function handlePhotoWithSelection(
  telegramId: number,
  chatId: number,
  photo: TelegramUpdate["message"],
  taskId: string
) {
  const supabase = createServerClient()
  
  const { data: perfil } = await supabase
    .from("perfiles")
    .select("id, nombre_completo")
    .eq("telegram_id", telegramId)
    .single()
  
  if (!perfil) {
    await sendMessage(chatId, "Primero debes registrarte. Envía /start para comenzar.")
    return
  }
  
  const { data: tarea } = await supabase
    .from("tareas")
    .select("id, video_id, videos(titulo)")
    .eq("id", taskId)
    .eq("perfil_id", perfil.id)
    .eq("estado", "PENDIENTE")
    .single()
  
  if (!tarea) {
    await sendMessage(chatId, "Esta tarea ya fue completada o no existe.")
    userSessions.delete(telegramId)
    return
  }
  
  const photos = photo?.photo
  if (!photos || photos.length === 0) {
    await sendMessage(chatId, "Error al procesar la imagen. Intenta de nuevo.")
    return
  }
  
  const largestPhoto = photos[photos.length - 1]
  const fileUrl = await getFileUrl(largestPhoto.file_id)
  
  if (!fileUrl) {
    await sendMessage(chatId, "Error al obtener la imagen. Intenta de nuevo.")
    return
  }
  
  const imageResponse = await fetch(fileUrl)
  const imageBuffer = await imageResponse.arrayBuffer()
  
  let compressedBuffer: Buffer
  try {
    compressedBuffer = await sharp(Buffer.from(imageBuffer))
      .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 70, mozjpeg: true })
      .toBuffer()
  } catch {
    compressedBuffer = Buffer.from(imageBuffer)
  }
  
  const fileName = `${telegramId}/${tarea.id}_${Date.now()}.jpg`
  
  const { error: uploadError } = await supabase.storage
    .from("evidencias")
    .upload(fileName, compressedBuffer, {
      contentType: "image/jpeg",
      upsert: true,
    })
  
  if (uploadError) {
    await sendMessage(chatId, "Error al guardar la imagen. Intenta de nuevo.")
    return
  }
  
  const { data: urlData } = supabase.storage.from("evidencias").getPublicUrl(fileName)
  
  await supabase
    .from("tareas")
    .update({
      estado: "COMPLETADO",
      url_evidencia: urlData.publicUrl,
      fecha_entrega: new Date().toISOString(),
    })
    .eq("id", tarea.id)
  
  userSessions.delete(telegramId)
  
  const videoData = tarea.videos as unknown as { titulo: string } | null
  
  const { count } = await supabase
    .from("tareas")
    .select("*", { count: "exact", head: true })
    .eq("perfil_id", perfil.id)
    .eq("estado", "PENDIENTE")
  
  const pendientesMsg = count && count > 0
    ? `\n\nTienes ${count} tarea(s) pendiente(s).`
    : "\n\n🎉 ¡Has completado todas tus tareas!"
  
  await sendMessage(chatId, `✅ ¡Evidencia recibida para *${videoData?.titulo || "el video"}*!${pendientesMsg}`)
}

// =============================================
// COMANDOS DE ADMINISTRADOR
// =============================================

// Comando /broadcast - Mensaje masivo
async function handleBroadcast(telegramId: number, chatId: number, mensaje: string) {
  if (!await isAdmin(telegramId)) {
    await sendMessage(chatId, "❌ Este comando es solo para administradores.")
    return
  }
  
  if (!mensaje || mensaje.trim().length === 0) {
    userSessions.set(telegramId, { step: 'waiting_broadcast' })
    await sendMessage(chatId, "📢 *Broadcast*\n\nEscribe el mensaje que quieres enviar a todos los usuarios:")
    return
  }
  
  const supabase = createServerClient()
  
  const { data: perfiles } = await supabase
    .from("perfiles")
    .select("telegram_id")
    .eq("activo", true)
  
  if (!perfiles || perfiles.length === 0) {
    await sendMessage(chatId, "No hay usuarios activos para notificar.")
    return
  }
  
  let exitosos = 0
  let fallidos = 0
  
  for (const perfil of perfiles) {
    try {
      const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: perfil.telegram_id,
          text: `📢 *Mensaje del Administrador*\n\n${mensaje}`,
          parse_mode: "Markdown",
        }),
      })
      const result = await response.json()
      if (result.ok) exitosos++
      else fallidos++
    } catch {
      fallidos++
    }
  }
  
  userSessions.delete(telegramId)
  await sendMessage(chatId, `✅ Broadcast enviado\n\n• Exitosos: ${exitosos}\n• Fallidos: ${fallidos}`)
}

// Comando /usuarios - Lista de usuarios
async function handleUsuarios(telegramId: number, chatId: number) {
  if (!await isAdmin(telegramId)) {
    await sendMessage(chatId, "❌ Este comando es solo para administradores.")
    return
  }
  
  const supabase = createServerClient()
  
  const { data: usuarios } = await supabase
    .from("perfiles")
    .select("nombre_completo, telegram_id, activo, rango")
    .order("nombre_completo")
  
  if (!usuarios || usuarios.length === 0) {
    await sendMessage(chatId, "No hay usuarios registrados.")
    return
  }
  
  const activos = usuarios.filter(u => u.activo).length
  const inactivos = usuarios.filter(u => !u.activo).length
  
  let mensaje = `👥 *Usuarios Registrados (${usuarios.length})*\n`
  mensaje += `✅ Activos: ${activos} | ❌ Inactivos: ${inactivos}\n\n`
  
  usuarios.forEach(user => {
    const estado = user.activo ? "✅" : "❌"
    const rango = user.rango === 'administrador' ? " 👑" : ""
    mensaje += `${estado} ${user.nombre_completo}${rango}\n`
    mensaje += `   ID: ${user.telegram_id}\n`
  })
  
  await sendMessage(chatId, mensaje)
}

// Comando /desactivar - Desactivar usuario
async function handleDesactivar(telegramId: number, chatId: number, targetId: string) {
  if (!await isAdmin(telegramId)) {
    await sendMessage(chatId, "❌ Este comando es solo para administradores.")
    return
  }
  
  if (!targetId) {
    await sendMessage(chatId, "Uso: /desactivar [telegram_id]\n\nEjemplo: /desactivar 123456789")
    return
  }
  
  const supabase = createServerClient()
  
  const { data: perfil } = await supabase
    .from("perfiles")
    .select("nombre_completo, activo")
    .eq("telegram_id", parseInt(targetId))
    .single()
  
  if (!perfil) {
    await sendMessage(chatId, `❌ No se encontró usuario con ID: ${targetId}`)
    return
  }
  
  const nuevoEstado = !perfil.activo
  
  await supabase
    .from("perfiles")
    .update({ activo: nuevoEstado })
    .eq("telegram_id", parseInt(targetId))
  
  const estadoTexto = nuevoEstado ? "activado ✅" : "desactivado ❌"
  await sendMessage(chatId, `Usuario *${perfil.nombre_completo}* ha sido ${estadoTexto}`)
}

// =============================================
// Verificar permisos para /video y /reporte
// =============================================
async function handleVideoCommandWithAuth(telegramId: number, chatId: number) {
  if (!await isAdmin(telegramId)) {
    await sendMessage(chatId, "❌ Este comando es solo para administradores.")
    return
  }
  
  userSessions.set(telegramId, { step: 'waiting_video' })
  await sendMessage(
    chatId,
    `📹 *Subir Nuevo Video*\n\nEnvía el video que quieres compartir con todos los participantes.\n\n⚠️ El video será comprimido automáticamente por Telegram.`
  )
}

async function handleReporteWithAuth(telegramId: number, chatId: number) {
  if (!await isAdmin(telegramId)) {
    await sendMessage(chatId, "❌ Este comando es solo para administradores.")
    return
  }
  
  await handleReporte(chatId)
}

export async function POST(request: NextRequest) {
  try {
    const update: TelegramUpdate = await request.json()
    
    // Responder inmediatamente a Telegram para evitar reenvíos
    const response = NextResponse.json({ ok: true })
    
    // Procesar el mensaje (no await, pero tampoco lo matamos)
    // Usar waitUntil si está disponible, o procesar sync
    processWebhook(update).catch(err => console.error("Webhook processing error:", err))
    
    return response
  } catch (error) {
    console.error("Webhook error:", error)
    return NextResponse.json({ ok: true })
  }
}

// Función separada para procesar el webhook
async function processWebhook(update: TelegramUpdate) {
  try {
    // Manejar callback queries (botones inline)
    if (update.callback_query) {
      const callbackQuery = update.callback_query
      const telegramId = callbackQuery.from.id
      const chatId = callbackQuery.message?.chat.id
      
      if (chatId && callbackQuery.data) {
        // Responder al callback para quitar el loading (no await, fire and forget)
        fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ callback_query_id: callbackQuery.id }),
        }).catch(() => {})
      }
      return
    }
    
    if (!update.message) return
    
    const { message } = update
    const telegramId = message.from.id
    const chatId = message.chat.id
    const firstName = message.from.first_name
    const text = message.text || ""
    
    // Verificar sesión activa
    const session = userSessions.get(telegramId)
    
    // ========== COMANDOS ==========
    if (text === "/start") {
      userSessions.delete(telegramId)
      await handleStart(telegramId, chatId, firstName)
    } 
    else if (text === "/help" || text === "/ayuda") {
      await handleHelp(telegramId, chatId)
    }
    else if (text === "/cancelar") {
      userSessions.delete(telegramId)
      await sendMessage(chatId, "❌ Operación cancelada.")
    }
    // Comandos de evidencia
    else if (text === "/evidencia") {
      await handleEvidenciaCommand(telegramId, chatId)
    }
    else if (text === "/mievidencia" || text === "/mi_evidencia") {
      await handleMiEvidencia(telegramId, chatId)
    }
    else if (text === "/pendientes") {
      await handlePendientes(telegramId, chatId)
    }
    // Comandos de información
    else if (text === "/videos") {
      await handleVideos(chatId)
    }
    else if (text === "/stats" || text === "/estadisticas") {
      await handleStats(telegramId, chatId)
    }
    else if (text === "/perfil") {
      await handlePerfil(telegramId, chatId)
    }
    else if (text.startsWith("/editarnombre ")) {
      const nuevoNombre = text.replace("/editarnombre ", "").trim()
      await handleEditarNombre(telegramId, chatId, nuevoNombre)
    }
    else if (text === "/ranking") {
      await handleRanking(chatId)
    }
    else if (text === "/recordatorio") {
      await handleRecordatorio(telegramId, chatId)
    }
    // Comandos de admin
    else if (text === "/video") {
      await handleVideoCommandWithAuth(telegramId, chatId)
    }
    else if (text === "/reporte") {
      await handleReporteWithAuth(telegramId, chatId)
    }
    else if (text === "/broadcast" || text.startsWith("/broadcast ")) {
      const msg = text.replace("/broadcast", "").trim()
      await handleBroadcast(telegramId, chatId, msg)
    }
    else if (text === "/usuarios") {
      await handleUsuarios(telegramId, chatId)
    }
    else if (text.startsWith("/desactivar")) {
      const targetId = text.replace("/desactivar", "").trim()
      await handleDesactivar(telegramId, chatId, targetId)
    }
    // Manejar video recibido (flujo de admin)
    else if (message.video) {
      if (session?.step === 'waiting_video') {
        await handleVideoReceived(telegramId, chatId, message)
      } else {
        await sendMessage(chatId, "Para subir un video como admin, primero envía /video")
      }
    }
    // Manejar foto recibida
    else if (message.photo) {
      if (session?.step === 'waiting_evidence' && session.selectedTaskId) {
        await handlePhotoWithSelection(telegramId, chatId, message, session.selectedTaskId)
      } else {
        await handlePhoto(telegramId, chatId, message)
      }
    }
    // Manejar texto según contexto de sesión
    else if (text) {
      if (session?.step === 'waiting_title') {
        const handled = await handleVideoTitle(telegramId, chatId, text)
        if (!handled) {
          await handleTextMessage(telegramId, chatId, text, firstName)
        }
      }
      else if (session?.step === 'waiting_evidence' && !session.selectedTaskId) {
        await handleEvidenciaSelection(telegramId, chatId, text)
      }
      else if (session?.step === 'waiting_broadcast') {
        await handleBroadcast(telegramId, chatId, text)
      }
      else if (session?.step === 'waiting_new_name') {
        await handleEditarNombre(telegramId, chatId, text)
        userSessions.delete(telegramId)
      }
      else {
        await handleTextMessage(telegramId, chatId, text, firstName)
      }
    }
  } catch (error) {
    console.error("Process webhook error:", error)
  }
}

export async function GET() {
  return NextResponse.json({ status: "Bot webhook is running" })
}
