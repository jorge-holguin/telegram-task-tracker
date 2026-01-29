-- =============================================
-- Migración: Agregar soporte para videos subidos
-- Ejecutar en el SQL Editor de Supabase
-- =============================================

-- Agregar nuevas columnas a la tabla videos
ALTER TABLE videos ADD COLUMN IF NOT EXISTS tipo_video TEXT DEFAULT 'link';
ALTER TABLE videos ADD COLUMN IF NOT EXISTS archivo_id TEXT;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS fecha_expiracion TIMESTAMP WITH TIME ZONE;

-- Índice para buscar videos por fecha de expiración (para limpieza automática)
CREATE INDEX IF NOT EXISTS idx_videos_fecha_expiracion ON videos(fecha_expiracion) WHERE fecha_expiracion IS NOT NULL;

-- Crear bucket de videos (ejecutar manualmente en Storage o usar la API)
-- Nombre: videos
-- Public: true
