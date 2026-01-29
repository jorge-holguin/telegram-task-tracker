"use server"

import { createServerClient } from "@/lib/supabase/client"

export async function enviarNotificacionMasiva(videoId: string, videoTitulo: string, videoUrl: string) {
  const supabase = createServerClient()
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  
  if (!botToken) {
    return { error: "Token de Telegram no configurado" }
  }
  
  // Obtener todos los perfiles activos
  const { data: perfiles, error } = await supabase
    .from("perfiles")
    .select("telegram_id")
    .eq("activo", true)
  
  if (error || !perfiles) {
    return { error: "Error obteniendo perfiles" }
  }
  
  const mensaje = `📹 ¡Nuevo video disponible!\n\n*${videoTitulo}*\n\n🔗 Link: ${videoUrl}\n\nPor favor, ve el video y envía una captura de pantalla como evidencia.`
  
  const resultados = await Promise.allSettled(
    perfiles.map(async (perfil) => {
      const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: perfil.telegram_id,
          text: mensaje,
          parse_mode: "Markdown",
        }),
      })
      return response.json()
    })
  )
  
  const exitosos = resultados.filter((r) => r.status === "fulfilled").length
  const fallidos = resultados.filter((r) => r.status === "rejected").length
  
  return {
    success: true,
    mensaje: `Notificaciones enviadas: ${exitosos} exitosas, ${fallidos} fallidas`,
  }
}

export async function enviarVideoATelegram(videoId: string, videoTitulo: string, videoUrl: string) {
  const supabase = createServerClient()
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  
  if (!botToken) {
    return { error: "Token de Telegram no configurado" }
  }
  
  // Obtener todos los perfiles activos
  const { data: perfiles, error } = await supabase
    .from("perfiles")
    .select("telegram_id")
    .eq("activo", true)
  
  if (error || !perfiles) {
    return { error: "Error obteniendo perfiles" }
  }
  
  const caption = `📹 *${videoTitulo}*\n\n⬇️ Descarga este video y envía una captura de pantalla como evidencia.`
  
  const resultados = await Promise.allSettled(
    perfiles.map(async (perfil) => {
      // Enviar video como documento para que sea descargable
      const response = await fetch(`https://api.telegram.org/bot${botToken}/sendVideo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: perfil.telegram_id,
          video: videoUrl,
          caption: caption,
          parse_mode: "Markdown",
          supports_streaming: true,
        }),
      })
      return response.json()
    })
  )
  
  const exitosos = resultados.filter((r) => r.status === "fulfilled").length
  const fallidos = resultados.filter((r) => r.status === "rejected").length
  
  return {
    success: true,
    mensaje: `Videos enviados: ${exitosos} exitosos, ${fallidos} fallidos`,
  }
}

export async function enviarRecordatorios() {
  const supabase = createServerClient()
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  
  if (!botToken) {
    return { error: "Token de Telegram no configurado" }
  }
  
  // Obtener tareas pendientes con información del perfil y video
  const { data: tareasPendientes, error } = await supabase
    .from("vista_monitor_tareas")
    .select("*")
    .eq("estado", "PENDIENTE")
  
  if (error || !tareasPendientes) {
    return { error: "Error obteniendo tareas pendientes" }
  }
  
  // Agrupar por usuario para enviar un solo mensaje con todos los videos pendientes
  interface TareaData {
    telegram_id: number
    nombre_completo: string
    video_titulo: string
  }
  
  const tareasPorUsuario = (tareasPendientes as TareaData[]).reduce((acc, tarea) => {
    if (!acc[tarea.telegram_id]) {
      acc[tarea.telegram_id] = {
        nombre: tarea.nombre_completo,
        videos: [],
      }
    }
    acc[tarea.telegram_id].videos.push(tarea.video_titulo)
    return acc
  }, {} as Record<number, { nombre: string; videos: string[] }>)
  
  const resultados = await Promise.allSettled(
    Object.entries(tareasPorUsuario).map(async ([telegramId, data]) => {
      const videosList = data.videos.map((v) => `• ${v}`).join("\n")
      const mensaje = `⏰ *Recordatorio*\n\nHola ${data.nombre}, tienes ${data.videos.length} video(s) pendiente(s):\n\n${videosList}\n\nPor favor, envía las evidencias correspondientes.`
      
      const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: parseInt(telegramId),
          text: mensaje,
          parse_mode: "Markdown",
        }),
      })
      return response.json()
    })
  )
  
  const exitosos = resultados.filter((r) => r.status === "fulfilled").length
  
  return {
    success: true,
    mensaje: `Recordatorios enviados a ${exitosos} usuarios`,
  }
}
