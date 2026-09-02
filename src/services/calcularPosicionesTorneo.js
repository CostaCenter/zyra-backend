import sequelize from '../config/database.js';

/**
 * Calcula la tabla de posiciones al vuelo a partir de partidos FINALIZADO.
 */
export const calcularPosicionesTorneo = async (torneoId, grupoDivisionId = null) => {
  const [filas] = await sequelize.query(
    `
    WITH partidos_base AS (
      SELECT
        p.id,
        p.score_local_final,
        p.score_visitante_final,
        pl.team_id AS local_team_id,
        tl.name AS local_team_nombre,
        tl.logo_url AS local_team_logo,
        pv.team_id AS visitante_team_id,
        tv.name AS visitante_team_nombre,
        tv.logo_url AS visitante_team_logo
      FROM partidos p
      INNER JOIN "Partido_Participantes" pl ON pl.partido_id = p.id AND pl.es_local = true
      INNER JOIN "Partido_Participantes" pv ON pv.partido_id = p.id AND pv.es_local = false
      INNER JOIN "Team" tl ON tl.id = pl.team_id
      INNER JOIN "Team" tv ON tv.id = pv.team_id
      WHERE p.torneo_id = :torneoId
        AND p.state = 'FINALIZADO'
        AND (:grupoDivisionId IS NULL OR p.grupo_division_id = :grupoDivisionId)
    ),
    apariciones AS (
      SELECT
        local_team_id AS team_id,
        local_team_nombre AS team_nombre,
        local_team_logo AS team_logo_url,
        1 AS partidos_jugados,
        CASE WHEN score_local_final > score_visitante_final THEN 1 ELSE 0 END AS ganados,
        CASE WHEN score_local_final < score_visitante_final THEN 1 ELSE 0 END AS perdidos,
        score_local_final AS sets_favor,
        score_visitante_final AS sets_contra,
        CASE
          WHEN score_local_final > score_visitante_final THEN 2
          WHEN score_local_final < score_visitante_final THEN 1
          ELSE 0
        END AS puntos
      FROM partidos_base
      UNION ALL
      SELECT
        visitante_team_id,
        visitante_team_nombre,
        visitante_team_logo,
        1,
        CASE WHEN score_visitante_final > score_local_final THEN 1 ELSE 0 END,
        CASE WHEN score_visitante_final < score_local_final THEN 1 ELSE 0 END,
        score_visitante_final,
        score_local_final,
        CASE
          WHEN score_visitante_final > score_local_final THEN 2
          WHEN score_visitante_final < score_local_final THEN 1
          ELSE 0
        END
      FROM partidos_base
    )
    SELECT
      team_id,
      MAX(team_nombre) AS team_nombre,
      MAX(team_logo_url) AS team_logo_url,
      SUM(partidos_jugados)::int AS partidos_jugados,
      SUM(ganados)::int AS ganados,
      SUM(perdidos)::int AS perdidos,
      SUM(sets_favor)::int AS sets_favor,
      SUM(sets_contra)::int AS sets_contra,
      SUM(puntos)::int AS puntos,
      (SUM(sets_favor) - SUM(sets_contra))::int AS diferencia_sets
    FROM apariciones
    GROUP BY team_id
    ORDER BY puntos DESC, diferencia_sets DESC, team_nombre ASC
    `,
    {
      replacements: {
        torneoId,
        grupoDivisionId: grupoDivisionId ?? null
      }
    }
  );

  return filas;
};
