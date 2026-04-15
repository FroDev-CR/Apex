import { createContext, useContext, useState } from 'react';

const ES = {
  nav_reports: 'Reportes', nav_invoices: 'Facturas', nav_settings: 'Config',
  tab_overview: 'Resumen', tab_salary: 'Salarios', tab_receivables: 'Por Cobrar',
  tab_revenue: 'Ingresos', tab_margin: 'Margen',
  preset_today_yesterday: 'Ayer y hoy',
  preset_this_month: 'Este mes', preset_last_month: 'Mes anterior',
  preset_last_90: 'Últimos 90 días', preset_this_year: 'Este año', preset_all: 'Todo',
  export_excel: 'Excel', export_pdf: 'PDF / Imagen', export_title: 'Exportar',
  filter_btn: 'Filtros', filter_clear: 'Limpiar',
  filter_customer: 'Buscar cliente...', filter_type_all: 'Todos los tipos',
  filter_mono: 'Solo MONO SLAB', filter_no_mono: 'Sin MONO SLAB',
  filter_all_inv: 'Todas', filter_unpaid: 'Solo pendientes de pago',
  kpi_invoiced: 'Facturado', kpi_receivable: 'Por Cobrar', kpi_collab_cost: 'Costo Collab',
  kpi_gross_margin: 'Margen Bruto', kpi_collabs: 'Colaboradores', kpi_m2: 'm²',
  kpi_paid: 'Cobrado', kpi_invoices: 'Facturas', kpi_margin_pct: '% Margen',
  salary_title: 'Pago a Colaboradores', salary_total: 'Total a pagar',
  salary_empty: 'Sin facturas POUR MONO SLAB en este período',
  receivables_title: 'Cuentas por Cobrar', receivables_total: 'Total pendiente',
  receivables_empty: 'Todo pagado en este período',
  col_invoice: 'Factura', col_client: 'Cliente', col_date: 'Fecha',
  col_collab: 'Colaborador', col_type: 'Tipo', col_total: 'Total',
  col_balance: 'Saldo', col_pay: 'Pago collab', col_m2: 'm²', col_invoices: 'Facturas',
  unassigned: 'Sin asignar', loading: 'Cargando...', page: 'Página',
  prev: '← Anterior', next: 'Siguiente →', of: 'de',
  settings_title: 'Configuración', language: 'Idioma',
  ext_pay_add: 'Agregar pago externo', ext_pay_name: 'Nombre del pago',
  ext_pay_amount: 'Cantidad', ext_pay_auto: 'Pago automático',
  ext_pay_auto_hint: 'Se agregará automáticamente según el horario', ext_pay_day: 'Día del mes',
  ext_pay_time: 'Hora', ext_pay_save: 'Guardar pago', ext_pay_cancel: 'Cancelar',
  ext_pay_title: 'Pagos externos', ext_pay_delete: 'Eliminar',
};

const EN = {
  nav_reports: 'Reports', nav_invoices: 'Invoices', nav_settings: 'Settings',
  tab_overview: 'Overview', tab_salary: 'Payroll', tab_receivables: 'Receivables',
  tab_revenue: 'Revenue', tab_margin: 'Margin',
  preset_today_yesterday: 'Today & Yesterday',
  preset_this_month: 'This month', preset_last_month: 'Last month',
  preset_last_90: 'Last 90 days', preset_this_year: 'This year', preset_all: 'All time',
  export_excel: 'Excel', export_pdf: 'PDF / Image', export_title: 'Export',
  filter_btn: 'Filters', filter_clear: 'Clear',
  filter_customer: 'Search customer...', filter_type_all: 'All types',
  filter_mono: 'MONO SLAB only', filter_no_mono: 'No MONO SLAB',
  filter_all_inv: 'All', filter_unpaid: 'Unpaid only',
  kpi_invoiced: 'Invoiced', kpi_receivable: 'Receivable', kpi_collab_cost: 'Collab Cost',
  kpi_gross_margin: 'Gross Margin', kpi_collabs: 'Collaborators', kpi_m2: 'm²',
  kpi_paid: 'Collected', kpi_invoices: 'Invoices', kpi_margin_pct: 'Margin %',
  salary_title: 'Collaborator Payroll', salary_total: 'Total to pay',
  salary_empty: 'No POUR MONO SLAB invoices in this period',
  receivables_title: 'Accounts Receivable', receivables_total: 'Total pending',
  receivables_empty: 'All paid in this period',
  col_invoice: 'Invoice', col_client: 'Customer', col_date: 'Date',
  col_collab: 'Collaborator', col_type: 'Type', col_total: 'Total',
  col_balance: 'Balance', col_pay: 'Collab pay', col_m2: 'm²', col_invoices: 'Invoices',
  unassigned: 'Unassigned', loading: 'Loading...', page: 'Page',
  prev: '← Prev', next: 'Next →', of: 'of',
  settings_title: 'Settings', language: 'Language',
  ext_pay_add: 'Add external payment', ext_pay_name: 'Payment name',
  ext_pay_amount: 'Amount', ext_pay_auto: 'Automatic payment',
  ext_pay_auto_hint: 'Will be added automatically on schedule', ext_pay_day: 'Day of month',
  ext_pay_time: 'Time', ext_pay_save: 'Save payment', ext_pay_cancel: 'Cancel',
  ext_pay_title: 'External payments', ext_pay_delete: 'Delete',
};

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('apex_lang') || 'es');
  const dict = lang === 'es' ? ES : EN;
  const t = (key) => dict[key] ?? key;
  const toggle = () => {
    const next = lang === 'es' ? 'en' : 'es';
    setLang(next);
    localStorage.setItem('apex_lang', next);
  };
  return (
    <LanguageContext.Provider value={{ lang, t, toggle }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);
