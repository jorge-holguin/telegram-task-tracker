export type EstadoTarea = 'PENDIENTE' | 'COMPLETADO'

export interface Perfil {
  id: string
  telegram_id: number
  nombre_completo: string
  fecha_registro: string
  activo: boolean
  created_at: string
  updated_at: string
}

export interface Video {
  id: string
  titulo: string
  url_video: string
  descripcion: string | null
  activo: boolean
  creado_at: string
  updated_at: string
}

export interface Tarea {
  id: string
  video_id: string
  perfil_id: string
  estado: EstadoTarea
  url_evidencia: string | null
  fecha_entrega: string | null
  fecha_limite: string | null
  notificado: boolean
  created_at: string
  updated_at: string
}

export interface VistaEstadisticas {
  usuarios_activos: number
  videos_activos: number
  tareas_pendientes: number
  tareas_completadas: number
  porcentaje_cumplimiento: number
}

export interface VistaMonitorTareas {
  tarea_id: string
  estado: EstadoTarea
  url_evidencia: string | null
  fecha_entrega: string | null
  fecha_asignacion: string
  video_id: string
  video_titulo: string
  url_video: string
  perfil_id: string
  telegram_id: number
  nombre_completo: string
}

export interface Database {
  public: {
    Tables: {
      perfiles: {
        Row: Perfil
        Insert: Omit<Perfil, 'id' | 'created_at' | 'updated_at' | 'fecha_registro'>
        Update: Partial<Omit<Perfil, 'id'>>
      }
      videos: {
        Row: Video
        Insert: Omit<Video, 'id' | 'creado_at' | 'updated_at'>
        Update: Partial<Omit<Video, 'id'>>
      }
      tareas: {
        Row: Tarea
        Insert: Omit<Tarea, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Tarea, 'id'>>
      }
    }
    Views: {
      vista_estadisticas: {
        Row: VistaEstadisticas
      }
      vista_monitor_tareas: {
        Row: VistaMonitorTareas
      }
    }
  }
}
