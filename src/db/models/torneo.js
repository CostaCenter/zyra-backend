import { DataTypes } from 'sequelize';

export default (sequelize) => {
  return sequelize.define('torneos', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    complejo_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    sport_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    nombre: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    photo: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    creado_por_user_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    club_organizador_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    nivel_arbitraje_default: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: 'BASICO',
      validate: {
        isIn: [['BASICO', 'AVANZADO']]
      }
    },
    reglas_arbitraje_json: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {}
    },
    modalidad: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: 'piso | playa | null (deportes sin modalidad)'
    },
    estado: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'PLANEACION',
      validate: {
        isIn: [['PLANEACION', 'INSCRIPCIONES', 'EN_CURSO', 'FINALIZADO', 'CANCELADO']]
      }
    },
    visibilidad: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: 'PUBLICO',
      validate: {
        isIn: [['PUBLICO', 'PRIVADO']]
      }
    },
    codigo_acceso: {
      type: DataTypes.STRING(10),
      allowNull: true
    },
    max_equipos: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    imagen_portada_url: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    fecha_hora_inicio: {
      type: DataTypes.DATE,
      allowNull: true
    },
    lugar: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    costo_inscripcion: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    premiacion: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    orden_sorteo: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: { sorteos: [] }
    },
    max_jugadores_equipo: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    numero_canchas: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1
    },
    tipo_duracion: {
      type: DataTypes.STRING(20),
      allowNull: true,
      defaultValue: 'RELAMPAGO',
      validate: {
        isIn: [['RELAMPAGO', 'MULTIPLE_DIAS']]
      }
    },
    fecha_fin: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    hora_inicio_diaria: {
      type: DataTypes.TIME,
      allowNull: true,
      defaultValue: '08:00:00'
    },
    hora_fin_diaria: {
      type: DataTypes.TIME,
      allowNull: true,
      defaultValue: '22:00:00'
    },
    descanso_minimo_minutos: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 30
    },
    duracion_promedio_set_minutos: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 30
    },
    descanso_entre_sets_minutos: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 5
    },
    duracion_estimada_partido_minutos: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 60
    },
    numero_grupos: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    clasificados_por_grupo: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    metodo_distribucion: {
      type: DataTypes.STRING(20),
      allowNull: true,
      validate: {
        isIn: [['ALEATORIO', 'MANUAL']]
      }
    },
    requiere_partido_grupos_para_eliminatoria: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    creado_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    es_dato_prueba: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    horario_actualizado_en: {
      type: DataTypes.DATE,
      allowNull: true
    },
    horario_actualizado_resumen: {
      type: DataTypes.JSONB,
      allowNull: true
    }
  }, {
    tableName: 'torneos',
    timestamps: false
  });
};
