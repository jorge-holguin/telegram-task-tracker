"use server"

import { createServerClient } from "@/lib/supabase/client"
import { revalidatePath } from "next/cache"

// Tipos de video: 'link' para URL externa, 'file' para video subido
export type TipoVideo = 'link' | 'file'

export async function getVideos() {
  const supabase = createServerClient()
  
  const { data, error } = await supabase
    .from("videos")
    .select("*")
    .order("creado_at", { ascending: false })
  
  if (error) {
    throw new Error(error.message)
  }
  
  return data
}

export async function createVideo(formData: FormData) {
  const supabase = createServerClient()
  
  const titulo = formData.get("titulo") as string
  const url_video = formData.get("url_video") as string
  const descripcion = formData.get("descripcion") as string | null
  const videoFile = formData.get("video_file") as File | null
  const tipoVideo = formData.get("tipo_video") as TipoVideo || 'link'

  if (!titulo) {
    return { error: "Título es requerido" }
  }

  let finalVideoUrl = url_video
  let archivoId: string | null = null

  // Si es un archivo de video, subirlo a Storage
  if (tipoVideo === 'file' && videoFile && videoFile.size > 0) {
    const fileExt = videoFile.name.split('.').pop()
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`
    
    const arrayBuffer = await videoFile.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('videos')
      .upload(fileName, buffer, {
        contentType: videoFile.type,
        upsert: false
      })
    
    if (uploadError) {
      return { error: `Error subiendo video: ${uploadError.message}` }
    }
    
    // Obtener URL pública
    const { data: urlData } = supabase.storage
      .from('videos')
      .getPublicUrl(fileName)
    
    finalVideoUrl = urlData.publicUrl
    archivoId = fileName
  } else if (tipoVideo === 'link' && !url_video) {
    return { error: "URL del video es requerida" }
  }

  const { data, error } = await supabase
    .from("videos")
    .insert({
      titulo,
      url_video: finalVideoUrl,
      descripcion,
      activo: true,
      tipo_video: tipoVideo,
      archivo_id: archivoId,
      fecha_expiracion: tipoVideo === 'file' ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() : null
    })
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/dashboard")
  return { data, success: true }
}

export async function toggleVideoStatus(videoId: string, activo: boolean) {
  const supabase = createServerClient()
  
  const { error } = await supabase
    .from("videos")
    .update({ activo })
    .eq("id", videoId)
  
  if (error) {
    return { error: error.message }
  }
  
  revalidatePath("/dashboard")
  return { success: true }
}

export async function deleteVideo(videoId: string) {
  const supabase = createServerClient()
  
  const { error } = await supabase
    .from("videos")
    .delete()
    .eq("id", videoId)
  
  if (error) {
    return { error: error.message }
  }
  
  revalidatePath("/dashboard")
  return { success: true }
}
