// ============================================================
//  Módulo: reportes.js
// ============================================================

// ── REPORTES ─────────────────────────────────────────────────
let reporteActual = 'volumen';

function loadReportes() {
  const hoy = new Date().toISOString().split('T')[0];
  const hace30 = new Date(Date.now() - 30*24*3600*1000).toISOString().split('T')[0];
  document.getElementById('rep-fi').value = hace30;
  document.getElementById('rep-ff').value = hoy;
  document.getElementById('rep-fi').onchange = () => cargarReporte(reporteActual);
  document.getElementById('rep-ff').onchange = () => cargarReporte(reporteActual);
  cargarReporte('volumen');
}

function switchTab(nombre, btn) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  reporteActual = nombre;
  cargarReporte(nombre);
}

async function cargarReporte(nombre) {
  const fi = document.getElementById('rep-fi').value;
  const ff = document.getElementById('rep-ff').value;
  const thead = document.querySelector('#tbl-rep thead');
  const tbody = document.querySelector('#tbl-rep tbody');
  tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:24px"><div class="spinner"></div></td></tr>';
  try {
    let datos, cols;
    if (nombre === 'volumen') {
      datos = await api.getReporteVolumen(fi, ff);
      cols  = ['#', 'Producto', 'Unidades Vendidas', 'Ranking'];
      thead.innerHTML = `<tr>${cols.map(c=>`<th>${c}</th>`).join('')}</tr>`;
      tbody.innerHTML = datos.map(r => `<tr><td>${r.id}</td><td><strong>${r.producto}</strong></td><td>${r.volumen}</td><td><span class="badge badge-amber">#${r.ranking}</span></td></tr>`).join('') || '<tr><td colspan="4" style="text-align:center;padding:32px;color:var(--text-muted)">Sin datos en el período</td></tr>';
    } else if (nombre === 'rentabilidad') {
      datos = await api.getReporteRentabilidad(fi, ff);
      cols  = ['#', 'Producto', 'Ingreso Bruto', 'Costo Manufactura', 'Ganancia Neta'];
      thead.innerHTML = `<tr>${cols.map(c=>`<th>${c}</th>`).join('')}</tr>`;
      tbody.innerHTML = datos.map(r => `<tr>
        <td>${r.id}</td><td><strong>${r.producto}</strong></td>
        <td>${fmt(r.ingreso_bruto)}</td>
        <td>${fmt(r.costo_manufactura)}</td>
        <td><strong style="color:var(--success)">${fmt(r.ganancia_neta)}</strong></td>
      </tr>`).join('') || '<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--text-muted)">Sin datos en el período</td></tr>';
    } else {
      datos = await api.getReporteMermas();
      cols  = ['Producto', 'Proyectado', 'Real', 'Merma (u)', '% Merma'];
      thead.innerHTML = `<tr>${cols.map(c=>`<th>${c}</th>`).join('')}</tr>`;
      tbody.innerHTML = datos.map(r => {
        const badge = r.pct_merma > 10 ? 'badge-red' : r.pct_merma > 5 ? 'badge-amber' : 'badge-green';
        return `<tr>
          <td><strong>${r.producto}</strong></td>
          <td>${r.proyectado}</td><td>${r.real}</td><td>${r.merma}</td>
          <td><span class="badge ${badge}">${r.pct_merma.toFixed(2)}%</span></td>
        </tr>`;
      }).join('') || '<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--text-muted)">Sin datos de producción</td></tr>';
    }
  } catch(e) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--danger)">${e.message}</td></tr>`;
  }
}

// ── Filtrar select de producción ──────────────────────────────