-- Migración: Crear tabla usuario_complejo para relación muchos-a-muchos
-- Permite que múltiples usuarios tengan acceso a múltiples complejos

CREATE TABLE IF NOT EXISTS usuario_complejo (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    complejo_id INTEGER NOT NULL,
    rol_en_complejo VARCHAR(50) DEFAULT 'ACCESO',
    creado_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign keys
    CONSTRAINT fk_usuario_complejo_user
        FOREIGN KEY (user_id) 
        REFERENCES "user"(id)
        ON DELETE CASCADE,
    
    CONSTRAINT fk_usuario_complejo_complejo
        FOREIGN KEY (complejo_id) 
        REFERENCES complejos(id)
        ON DELETE CASCADE,
    
    -- Constraint único: un usuario no puede tener múltiples registros del mismo complejo
    CONSTRAINT unique_user_complejo 
        UNIQUE (user_id, complejo_id)
);

-- Índices para mejorar el rendimiento
CREATE INDEX idx_usuario_complejo_user_id ON usuario_complejo(user_id);
CREATE INDEX idx_usuario_complejo_complejo_id ON usuario_complejo(complejo_id);

-- Comentarios para documentación
COMMENT ON TABLE usuario_complejo IS 'Tabla intermedia para relación muchos-a-muchos entre usuarios y complejos';
COMMENT ON COLUMN usuario_complejo.user_id IS 'ID del usuario con acceso';
COMMENT ON COLUMN usuario_complejo.complejo_id IS 'ID del complejo al que tiene acceso';
COMMENT ON COLUMN usuario_complejo.rol_en_complejo IS 'Rol del usuario en el complejo: DUEÑO, ADMIN, ACCESO, EMPLEADO';

-- Opcional: Migrar dueños existentes a la tabla de accesos
-- Esto crea registros en usuario_complejo para todos los dueños actuales con rol DUEÑO
INSERT INTO usuario_complejo (user_id, complejo_id, rol_en_complejo, creado_at)
SELECT 
    dueño_id, 
    id, 
    'DUEÑO',
    CURRENT_TIMESTAMP
FROM complejos
WHERE dueño_id IS NOT NULL
ON CONFLICT (user_id, complejo_id) DO NOTHING;
