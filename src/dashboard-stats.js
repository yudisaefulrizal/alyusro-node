import { query } from './db.js';
import { esc } from './dashboard-shell.js';

const programs = ['Taud', 'Kuttab', 'Madrasah', "Darul 'Ilmi", "Ma'had 'Aly"];
const colors = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#6b7280'];
const widgets = [
  ['widget_JumlahAlumni', 'Alumni', 'lulus'],
  ['widget_JumlahSantri', 'Santri', 'santri'],
];

export function createDashboardStats(read = query) {
  return async function dashboardStats(access) {
    const visible = widgets.filter(([permission]) => access.permissions.includes(permission));
    if (!visible.length) return '';
    // Match the legacy database collation for program/status comparisons. Only
    // aggregate the five programs and statuses used by the authorized widgets.
    const statuses = visible.map(([, , status]) => status);
    const rows = await read(`SELECT jenjang, status, COUNT(*) AS total FROM santris WHERE jenjang IN (${programs.map(() => '?').join(',')}) AND status IN (${statuses.map(() => '?').join(',')}) GROUP BY jenjang, status`, [...programs, ...statuses]);
    return visible.map(([, title, status]) => {
      const values = programs.map(program => rows.filter(row => String(row.jenjang).toLowerCase() === program.toLowerCase() && String(row.status).toLowerCase() === status).reduce((sum, row) => sum + Number(row.total), 0));
      const max = Math.max(1, ...values);
      return `<section class="widget stats-widget"><h2>${title}</h2><p class="stats-total">Total: <strong>${values.reduce((a, b) => a + b, 0)}</strong></p><dl class="stats-chart" aria-label="Jumlah ${title.toLowerCase()} per jenjang">${programs.map((program, i) => `<div><dt>${esc(program)}</dt><dd><span class="stats-track" aria-hidden="true"><span style="height:${values[i] / max * 100}%;background:${colors[i]}"></span></span><strong>${values[i]}</strong></dd></div>`).join('')}</dl></section>`;
    }).join('');
  };
}
export const dashboardStats = createDashboardStats();
