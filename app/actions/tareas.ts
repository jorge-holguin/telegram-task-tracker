"use server"

import { createServerClient } from "@/lib/supabase/client"
import { revalidatePath } from "next/cache"
import type { VistaMonitorTareas, VistaEstadisticas } from "@/types/database"

export async function getEstadisticas(): Promise<VistaEstadisticas> {
  const supabase = createServerClient()
  
  const { data, error } = await supabase
    .from("vista_estadisticas")
    .select("*")
    .single()
  
  if (error) {
    return {
      usuarios_activos: 0,
      videos_activos: 0,
      tareas_pendientes: 0,
      tareas_completadas: 0,
      porcentaje_cumplimiento: 0,
    }
  }
  
  return data
}

export async function getMonitorTareas(filters?: {
  estado?: string
  videoId?: string
  perfilId?: string
}): Promise<VistaMonitorTareas[]> {
  const supabase = createServerClient()
  
  let query = supabase
    .from("vista_monitor_tareas")
    .select("*")
    .order("fecha_asignacion", { ascending: false })
  
  if (filters?.estado && filters.estado !== "todos") {
    query = query.eq("estado", filters.estado)
  }
  
  if (filters?.videoId && filters.videoId !== "todos") {
    query = query.eq("video_id", filters.videoId)
  }
  
  if (filters?.perfilId && filters.perfilId !== "todos") {
    query = query.eq("perfil_id", filters.perfilId)
  }
  
  const { data, error } = await query
  
  if (error) {
    throw new Error(error.message)
  }
  
  return data || []
}

export async function rechazarEvidencia(tareaId: string, telegramId: number) {
  const supabase = createServerClient()
  
  const { error } = await supabase
    .from("tareas")
    .update({
      estado: "PENDIENTE",
      url_evidencia: null,
      fecha_entrega: null,
    })
    .eq("id", tareaId)
  
  if (error) {
    return { error: error.message }
  }
  
  // Enviar notificación al usuario via Telegram
  try {
    await notificarRechazoTelegram(telegramId)
  } catch (e) {
    console.error("Error enviando notificación de rechazo:", e)
  }
  
  revalidatePath("/dashboard")
  return { success: true }
}

async function notificarRechazoTelegram(telegramId: number) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) return
  
  const mensaje = "⚠️ Tu evidencia ha sido rechazada. Por favor, envía una nueva captura de pantalla del video."
  
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: telegramId,
      text: mensaje,
    }),
  })
}

export async function exportarCSV(): Promise<string> {
  const tareas = await getMonitorTareas()
  
  const headers = ["Usuario", "Telegram ID", "Video", "Estado", "Fecha Asignación", "Fecha Entrega", "URL Evidencia"]
  
  const rows = tareas.map((t) => [
    t.nombre_completo,
    t.telegram_id.toString(),
    t.video_titulo,
    t.estado,
    t.fecha_asignacion ? new Date(t.fecha_asignacion).toLocaleDateString("es-ES") : "",
    t.fecha_entrega ? new Date(t.fecha_entrega).toLocaleDateString("es-ES") : "",
    t.url_evidencia || "",
  ])
  
  const csvContent = [
    headers.join(","),
    ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
  ].join("\n")
  
  return csvContent
}
