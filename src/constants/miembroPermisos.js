/**
 * Estructura booleana de permisos por módulo para miembros del complejo.
 * Debe mantenerse alineada con la UI del dashboard (members.jsx).
 */
export const PERMISOS_DEFECTO = {
  reservas: {
    module_reservations: false,
    create_booking: false,
    move_reschedule: false,
    view_daily_income: false,
    settle_balance: false,
    free_bookings: false,
  },
  finanzas: {
    module_finance: false,
    view_cash_panel: false,
    view_zyra_settlements: false,
  },
  staff: {
    module_staff: false,
    manage_members: false,
  },
  canchas: {
    module_courts: false,
    add_court: false,
    modify_court_identity: false,
    toggle_court_active: false,
    maintenance_mode: false,
    configure_pricing: false,
    configure_web_section: false,
  },
  analitica: {
    module_analytics: false,
    view_analytics: false,
    view_activity_log: false,
    view_booking_history: false,
  },
};

export const PERMISOS_ADMINISTRADOR = {
  reservas: {
    module_reservations: true,
    create_booking: true,
    move_reschedule: true,
    view_daily_income: true,
    settle_balance: true,
    free_bookings: true,
  },
  finanzas: {
    module_finance: true,
    view_cash_panel: true,
    view_zyra_settlements: true,
  },
  staff: {
    module_staff: true,
    manage_members: true,
  },
  canchas: {
    module_courts: true,
    add_court: true,
    modify_court_identity: true,
    toggle_court_active: true,
    maintenance_mode: true,
    configure_pricing: true,
    configure_web_section: true,
  },
  analitica: {
    module_analytics: true,
    view_analytics: true,
    view_activity_log: true,
    view_booking_history: true,
  },
};

export const PERMISOS_RECEPCIONISTA = {
  ...PERMISOS_DEFECTO,
  reservas: {
    ...PERMISOS_DEFECTO.reservas,
    module_reservations: true,
    create_booking: true,
  },
};

export const PERMISOS_POR_ROL_BASE = {
  ADMINISTRADOR: PERMISOS_ADMINISTRADOR,
  RECEPCIONISTA: PERMISOS_RECEPCIONISTA,
  PERSONALIZADO: PERMISOS_DEFECTO,
};

export const obtenerPermisosPorRolBase = (rolBase) =>
  PERMISOS_POR_ROL_BASE[rolBase] ?? PERMISOS_RECEPCIONISTA;
