import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/client"
import sharp from "sharp"

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ""

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
}

// Estado temporal para el flujo de /video (en memoria, se pierde al reiniciar)
// Para producción, usar Redis o una tabla en Supabase
const videoUploadSessions: Map<number, { 
  step: 'waiting_video' | 'waiting_title'
  videoFileId?: string
  videoUrl?: string
}> = new Map()

async function sendMessage(chatId: number, text: string, parseMode?: string) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: parseMode || "Markdown",
    }),
  })
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
  videoUploadSessions.set(telegramId, { step: 'waiting_video' })
  
  await sendMessage(
    chatId,
    `📹 *Subir Nuevo Video*\n\nEnvía el video que quieres compartir con todos los participantes.\n\n⚠️ El video será comprimido automáticamente por Telegram.`
  )
}

async function handleVideoReceived(telegramId: number, chatId: number, video: TelegramUpdate["message"]) {
  const session = videoUploadSessions.get(telegramId)
  
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
  videoUploadSessions.set(telegramId, {
    step: 'waiting_title',
    videoFileId: videoData.file_id,
  })
  
  await sendMessage(
    chatId,
    `✅ Video recibido (${Math.round((videoData.file_size || 0) / 1024 / 1024 * 100) / 100} MB)\n\nAhora envía el *título* del video:`
  )
}

async function handleVideoTitle(telegramId: number, chatId: number, titulo: string) {
  const session = videoUploadSessions.get(telegramId)
  
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
    videoUploadSessions.delete(telegramId)
    return true
  }
  
  // Obtener todos los perfiles activos
  const { data: perfiles } = await supabase
    .from("perfiles")
    .select("id, telegram_id")
    .eq("activo", true)
  
  if (!perfiles || perfiles.length === 0) {
    await sendMessage(chatId, `⚠️ Video guardado pero no hay usuarios registrados para notificar.`)
    videoUploadSessions.delete(telegramId)
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
  videoUploadSessions.delete(telegramId)
  
  await sendMessage(
    chatId,
    `✅ *Video publicado exitosamente!*\n\n📊 Resumen:\n• Título: *${titulo.trim()}*\n• Enviado a: ${exitosos} usuarios\n• Fallidos: ${fallidos}\n• Expira en: 7 días\n\nLos usuarios deben enviar una captura de pantalla como evidencia.`
  )
  
  return true
}

export async function POST(request: NextRequest) {
  try {
    const update: TelegramUpdate = await request.json()
    
    if (!update.message) {
      return NextResponse.json({ ok: true })
    }
    
    const { message } = update
    const telegramId = message.from.id
    const chatId = message.chat.id
    const firstName = message.from.first_name
    
    // Verificar si está en flujo de subida de video
    const session = videoUploadSessions.get(telegramId)
    
    if (message.text === "/start") {
      videoUploadSessions.delete(telegramId) // Cancelar flujo si existe
      await handleStart(telegramId, chatId, firstName)
    } else if (message.text === "/video") {
      await handleVideoCommand(telegramId, chatId)
    } else if (message.text === "/reporte") {
      await handleReporte(chatId)
    } else if (message.text === "/mievidencia" || message.text === "/mi_evidencia") {
      await handleMiEvidencia(telegramId, chatId)
    } else if (message.text === "/cancelar") {
      videoUploadSessions.delete(telegramId)
      await sendMessage(chatId, "❌ Operación cancelada.")
    } else if (message.video) {
      // Si recibe video, verificar si está en flujo de /video
      if (session?.step === 'waiting_video') {
        await handleVideoReceived(telegramId, chatId, message)
      } else {
        await sendMessage(chatId, "Para subir un video, primero envía el comando /video")
      }
    } else if (message.photo) {
      await handlePhoto(telegramId, chatId, message)
    } else if (message.text) {
      // Si está esperando título del video
      if (session?.step === 'waiting_title') {
        const handled = await handleVideoTitle(telegramId, chatId, message.text)
        if (!handled) {
          await handleTextMessage(telegramId, chatId, message.text, firstName)
        }
      } else {
        await handleTextMessage(telegramId, chatId, message.text, firstName)
      }
    }
    
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Webhook error:", error)
    return NextResponse.json({ ok: true })
  }
}

export async function GET() {
  return NextResponse.json({ status: "Bot webhook is running" })
}
