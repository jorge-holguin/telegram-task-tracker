"use server"

import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/client"

export async function GET(request: NextRequest) {
  // Verificar el secret para autenticación
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  
  const supabase = createServerClient()
  
  try {
    // Obtener videos expirados
    const { data: videosExpirados, error: fetchError } = await supabase
      .from("videos")
      .select("id, archivo_id, titulo")
      .not("archivo_id", "is", null)
      .lt("fecha_expiracion", new Date().toISOString())
    
    if (fetchError) {
      console.error("Error fetching expired videos:", fetchError)
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }
    
    if (!videosExpirados || videosExpirados.length === 0) {
      return NextResponse.json({ 
        success: true, 
        mensaje: "No hay videos expirados para eliminar" 
      })
    }
    
    let eliminados = 0
    let errores = 0
    
    for (const video of videosExpirados) {
      // Eliminar archivo de Storage
      if (video.archivo_id) {
        const { error: storageError } = await supabase.storage
          .from("videos")
          .remove([video.archivo_id])
        
        if (storageError) {
          console.error(`Error eliminando archivo ${video.archivo_id}:`, storageError)
          errores++
          continue
        }
      }
      
      // Actualizar el video para quitar la referencia al archivo
      const { error: updateError } = await supabase
        .from("videos")
        .update({ 
          archivo_id: null,
          url_video: "Video expirado - archivo eliminado",
          activo: false
        })
        .eq("id", video.id)
      
      if (updateError) {
        console.error(`Error actualizando video ${video.id}:`, updateError)
        errores++
      } else {
        console.log(`Video eliminado: ${video.titulo}`)
        eliminados++
      }
    }
    
    return NextResponse.json({
      success: true,
      mensaje: `Limpieza completada: ${eliminados} videos eliminados, ${errores} errores`,
      detalles: {
        total: videosExpirados.length,
        eliminados,
        errores
      }
    })
  } catch (error) {
    console.error("Error en limpieza de videos:", error)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}
