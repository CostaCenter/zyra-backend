import { DataTypes } from 'sequelize';

export default (sequelize) => {
  return sequelize.define('partidos', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: true
    },
    time: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    cancha_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    sport_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    reserva_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    torneo_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    fase_torneo_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    grupo_division_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    nivel_arbitraje: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: 'BASICO',
      validate: {
        isIn: [['BASICO', 'AVANZADO']]
      }
    },
    tipo: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'OFICIAL, Deporte'
    },
    state: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'En cursor, pendiente, finalizado, cancelado, por confirmar marcador, DISPUTA (SI LOS MARCADORES NO COINCIDEN)'
    },
    datetime: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Dia del partido'
    },
    duracion_programada_minutos: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Duración usada al programar (estimada + margen, momento 1)'
    },
    finalizado_en: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Hora real de cierre del partido (momento 2)'
    },
    started_by_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'ID del usuario (Capitán o Dueño) que inició'
    },
    tipo_inicio: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: '"CAPITAN", "DUEÑO", "SISTEMA"'
    },
    score_local_final: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    score_visitante_final: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    arbitro_asignado_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    arbitro_confirmacion_estado: {
      type: DataTypes.STRING(12),
      allowNull: true,
      validate: {
        isIn: [['PENDIENTE', 'CONFIRMADO', 'RECHAZADO']]
      },
      comment: 'Confirmación del árbitro asignado'
    },
    jornada: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Número de jornada en round-robin (1..N-1)'
    },
    es_dato_prueba: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    alineacion_local: {
      type: DataTypes.JSONB,
      allowNull: true
    },
    alineacion_visitante: {
      type: DataTypes.JSONB,
      allowNull: true
    },
    equipo_que_saca_inicial: {
      type: DataTypes.STRING(12),
      allowNull: true
    }
  }, {
    tableName: 'partidos',
    timestamps: false
  });
};
