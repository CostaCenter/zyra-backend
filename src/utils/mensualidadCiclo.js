/** Utilidades de ciclo mensual: mismo día del mes con ajuste al último día si no existe. */

export function toDateOnly(value) {
  if (!value) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return value.toISOString().slice(0, 10);
  }
  const str = String(value).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return null;
  const d = new Date(`${str}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return str;
}

export function addDaysToDateOnly(dateStr, days) {
  const base = toDateOnly(dateStr);
  if (!base) return null;
  const d = new Date(`${base}T12:00:00`);
  d.setDate(d.getDate() + days);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

export function diasEnMes(year, month) {
  return new Date(year, month, 0).getDate();
}

export function fechaCorteEnMes(year, month, diaCorteFijo) {
  const maxDay = diasEnMes(year, month);
  const day = Math.min(diaCorteFijo, maxDay);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Primera fecha de corte = fecha_ingreso + dias_gracia. */
export function calcularPrimeraFechaCorte(fechaIngreso, diasGracia = 0) {
  const ingreso = toDateOnly(fechaIngreso);
  if (!ingreso) return null;
  return addDaysToDateOnly(ingreso, diasGracia ?? 0);
}

/** Día fijo del mes anclado a la primera fecha de corte. */
export function extraerDiaCorteMensual(primeraFechaCorte) {
  const fecha = toDateOnly(primeraFechaCorte);
  if (!fecha) return null;
  return parseInt(fecha.slice(8, 10), 10);
}

export function calcularDiaCorteMensual(fechaIngreso, diasGracia = 0) {
  return extraerDiaCorteMensual(calcularPrimeraFechaCorte(fechaIngreso, diasGracia));
}

/** Siguiente mes conservando el día fijo (ej. 31 → feb 28/29 → mar 31). */
export function siguienteFechaCorteMensual(fechaCorteActual, diaCorteFijo) {
  const fecha = toDateOnly(fechaCorteActual);
  if (!fecha || !diaCorteFijo) return null;

  const [year, month] = fecha.split('-').map(Number);
  let nextMonth = month + 1;
  let nextYear = year;
  if (nextMonth > 12) {
    nextMonth = 1;
    nextYear += 1;
  }

  return fechaCorteEnMes(nextYear, nextMonth, diaCorteFijo);
}

export function calcularSiguienteFechaCorteMensual(fechaIngreso, diasGracia, ultimaFechaCorte) {
  if (!ultimaFechaCorte) {
    return calcularPrimeraFechaCorte(fechaIngreso, diasGracia);
  }
  const diaCorte = calcularDiaCorteMensual(fechaIngreso, diasGracia);
  return siguienteFechaCorteMensual(ultimaFechaCorte, diaCorte);
}
