-- =============================================
-- Migración: Agregar campo 'rango' a perfiles
-- Ejecutar en el SQL Editor de Supabase
-- =============================================

-- Crear tipo ENUM para rangos de usuario
DO $$ BEGIN
    CREATE TYPE rango_usuario AS ENUM ('usuario', 'administrador');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Agregar columna rango a la tabla perfiles
ALTER TABLE perfiles 
ADD COLUMN IF NOT EXISTS rango rango_usuario DEFAULT 'usuario';

-- Índice para filtrar por rango
CREATE INDEX IF NOT EXISTS idx_perfiles_rango ON perfiles(rango);

-- Actualizar la vista de monitor de tareas para incluir el rango
CREATE OR REPLACE VIEW vista_monitor_tareas AS
SELECT 
    t.id as tarea_id,
    t.estado,
    t.url_evidencia,
    t.fecha_entrega,
    t.created_at as fecha_asignacion,
    v.id as video_id,
    v.titulo as video_titulo,
    v.url_video,
    p.id as perfil_id,
    p.telegram_id,
    p.nombre_completo,
    p.rango
FROM tareas t
JOIN videos v ON t.video_id = v.id
JOIN perfiles p ON t.perfil_id = p.id
ORDER BY t.created_at DESC;

-- Vista de ranking de usuarios
CREATE OR REPLACE VIEW vista_ranking_usuarios AS
SELECT 
    p.id as perfil_id,
    p.telegram_id,
    p.nombre_completo,
    p.rango,
    COUNT(CASE WHEN t.estado = 'COMPLETADO' THEN 1 END) as tareas_completadas,
    COUNT(CASE WHEN t.estado = 'PENDIENTE' THEN 1 END) as tareas_pendientes,
    COUNT(t.id) as total_tareas,
    CASE 
        WHEN COUNT(t.id) > 0 
        THEN ROUND(
            COUNT(CASE WHEN t.estado = 'COMPLETADO' THEN 1 END)::NUMERIC / 
            COUNT(t.id)::NUMERIC * 100, 2
        )
        ELSE 0 
    END as porcentaje_completado
FROM perfiles p
LEFT JOIN tareas t ON p.id = t.perfil_id
WHERE p.activo = TRUE
GROUP BY p.id, p.telegram_id, p.nombre_completo, p.rango
ORDER BY tareas_completadas DESC, porcentaje_completado DESC;

-- Comentario: Para hacer a un usuario administrador, ejecutar:
-- UPDATE perfiles SET rango = 'administrador' WHERE telegram_id = TU_TELEGRAM_ID;
