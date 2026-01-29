-- =============================================
-- VidProof - Schema SQL para Supabase
-- Ejecutar en el SQL Editor de Supabase
-- =============================================

-- Habilitar extensión UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Crear tipo ENUM para estados de tareas
CREATE TYPE estado_tarea AS ENUM ('PENDIENTE', 'COMPLETADO');

-- =============================================
-- Tabla: perfiles
-- Almacena información de usuarios registrados via Telegram
-- =============================================
CREATE TABLE perfiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    telegram_id BIGINT UNIQUE NOT NULL,
    nombre_completo TEXT NOT NULL,
    fecha_registro TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índice para búsquedas rápidas por telegram_id
CREATE INDEX idx_perfiles_telegram_id ON perfiles(telegram_id);

-- =============================================
-- Tabla: videos
-- Almacena los videos que los usuarios deben ver
-- =============================================
CREATE TABLE videos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    titulo TEXT NOT NULL,
    url_video TEXT NOT NULL,
    descripcion TEXT,
    activo BOOLEAN DEFAULT TRUE,
    creado_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índice para filtrar videos activos
CREATE INDEX idx_videos_activo ON videos(activo);

-- =============================================
-- Tabla: tareas
-- Relaciona videos con perfiles y rastrea cumplimiento
-- =============================================
CREATE TABLE tareas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    perfil_id UUID NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
    estado estado_tarea DEFAULT 'PENDIENTE',
    url_evidencia TEXT,
    fecha_entrega TIMESTAMP WITH TIME ZONE,
    fecha_limite TIMESTAMP WITH TIME ZONE,
    notificado BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Evitar duplicados: un usuario solo puede tener una tarea por video
    UNIQUE(video_id, perfil_id)
);

-- Índices para consultas frecuentes
CREATE INDEX idx_tareas_perfil_id ON tareas(perfil_id);
CREATE INDEX idx_tareas_video_id ON tareas(video_id);
CREATE INDEX idx_tareas_estado ON tareas(estado);
CREATE INDEX idx_tareas_pendientes ON tareas(perfil_id, estado) WHERE estado = 'PENDIENTE';

-- =============================================
-- Funciones y Triggers
-- =============================================

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para actualizar updated_at
CREATE TRIGGER update_perfiles_updated_at
    BEFORE UPDATE ON perfiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_videos_updated_at
    BEFORE UPDATE ON videos
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tareas_updated_at
    BEFORE UPDATE ON tareas
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- Función para crear tareas automáticamente al agregar video
-- =============================================
CREATE OR REPLACE FUNCTION crear_tareas_para_nuevo_video()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO tareas (video_id, perfil_id, estado)
    SELECT NEW.id, p.id, 'PENDIENTE'
    FROM perfiles p
    WHERE p.activo = TRUE;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_crear_tareas_nuevo_video
    AFTER INSERT ON videos
    FOR EACH ROW
    WHEN (NEW.activo = TRUE)
    EXECUTE FUNCTION crear_tareas_para_nuevo_video();

-- =============================================
-- Vistas para estadísticas del Dashboard
-- =============================================

-- Vista de estadísticas generales
CREATE OR REPLACE VIEW vista_estadisticas AS
SELECT 
    (SELECT COUNT(*) FROM perfiles WHERE activo = TRUE) as usuarios_activos,
    (SELECT COUNT(*) FROM videos WHERE activo = TRUE) as videos_activos,
    (SELECT COUNT(*) FROM tareas WHERE estado = 'PENDIENTE') as tareas_pendientes,
    (SELECT COUNT(*) FROM tareas WHERE estado = 'COMPLETADO') as tareas_completadas,
    CASE 
        WHEN (SELECT COUNT(*) FROM tareas) > 0 
        THEN ROUND(
            (SELECT COUNT(*) FROM tareas WHERE estado = 'COMPLETADO')::NUMERIC / 
            (SELECT COUNT(*) FROM tareas)::NUMERIC * 100, 2
        )
        ELSE 0 
    END as porcentaje_cumplimiento;

-- Vista detallada de tareas para el monitor
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
    p.nombre_completo
FROM tareas t
JOIN videos v ON t.video_id = v.id
JOIN perfiles p ON t.perfil_id = p.id
ORDER BY t.created_at DESC;

-- =============================================
-- Row Level Security (RLS)
-- =============================================

-- Habilitar RLS en todas las tablas
ALTER TABLE perfiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE tareas ENABLE ROW LEVEL SECURITY;

-- Políticas para permitir acceso desde el dashboard (service role)
-- Estas políticas permiten todas las operaciones para usuarios autenticados

CREATE POLICY "Permitir lectura de perfiles" ON perfiles
    FOR SELECT USING (true);

CREATE POLICY "Permitir inserción de perfiles" ON perfiles
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Permitir actualización de perfiles" ON perfiles
    FOR UPDATE USING (true);

CREATE POLICY "Permitir lectura de videos" ON videos
    FOR SELECT USING (true);

CREATE POLICY "Permitir inserción de videos" ON videos
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Permitir actualización de videos" ON videos
    FOR UPDATE USING (true);

CREATE POLICY "Permitir eliminación de videos" ON videos
    FOR DELETE USING (true);

CREATE POLICY "Permitir lectura de tareas" ON tareas
    FOR SELECT USING (true);

CREATE POLICY "Permitir inserción de tareas" ON tareas
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Permitir actualización de tareas" ON tareas
    FOR UPDATE USING (true);

-- =============================================
-- Storage Bucket para evidencias
-- Ejecutar después de crear las tablas
-- =============================================

-- Nota: Crear el bucket 'evidencias' manualmente en el panel de Supabase Storage
-- O usar la API de Storage:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('evidencias', 'evidencias', true);

-- =============================================
-- Datos de prueba (opcional)
-- =============================================

-- Insertar un usuario de prueba
-- INSERT INTO perfiles (telegram_id, nombre_completo) 
-- VALUES (123456789, 'Usuario de Prueba');

-- Insertar un video de prueba
-- INSERT INTO videos (titulo, url_video, descripcion)
-- VALUES ('Video de Bienvenida', 'https://youtube.com/watch?v=example', 'Video introductorio');
