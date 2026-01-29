"use server"

import { createServerClient } from "@/lib/supabase/client"
import type { Perfil } from "@/types/database"

export async function getPerfiles(): Promise<Perfil[]> {
  const supabase = createServerClient()
  
  const { data, error } = await supabase
    .from("perfiles")
    .select("*")
    .eq("activo", true)
    .order("nombre_completo", { ascending: true })
  
  if (error) {
    throw new Error(error.message)
  }
  
  return data || []
}

export async function getPerfilByTelegramId(telegramId: number): Promise<Perfil | null> {
  const supabase = createServerClient()
  
  const { data, error } = await supabase
    .from("perfiles")
    .select("*")
    .eq("telegram_id", telegramId)
    .single()
  
  if (error) {
    return null
  }
  
  return data
}

export async function createPerfil(telegramId: number, nombreCompleto: string): Promise<Perfil> {
  const supabase = createServerClient()
  
  const { data, error } = await supabase
    .from("perfiles")
    .insert({
      telegram_id: telegramId,
      nombre_completo: nombreCompleto,
      activo: true,
    })
    .select()
    .single()
  
  if (error) {
    throw new Error(error.message)
  }
  
  // Crear tareas para todos los videos activos
  const { data: videos } = await supabase
    .from("videos")
    .select("id")
    .eq("activo", true)
  
  if (videos && videos.length > 0) {
    await supabase.from("tareas").insert(
      videos.map((v) => ({
        video_id: v.id,
        perfil_id: data.id,
        estado: "PENDIENTE" as const,
      }))
    )
  }
  
  return data
}
