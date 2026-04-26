// ============================================================
//  Módulo: reportes.js
// ============================================================

let reporteActual = 'volumen';

function exportarReporte() {
  const fi   = document.getElementById('rep-fi').value;
  const ff   = document.getElementById('rep-ff').value;
  const tipo = reporteActual;

  const tabla  = document.getElementById('tbl-rep');
  const heads  = Array.from(tabla.querySelectorAll('thead th')).map(th => th.textContent.trim());
  const filas  = Array.from(tabla.querySelectorAll('tbody tr')).map(tr =>
    Array.from(tr.querySelectorAll('td')).map(td => td.textContent.trim())
  );

  if (!filas.length) return toast('No hay datos para exportar', 'error');

  const titulos = { volumen: 'Volumen de Ventas', rentabilidad: 'Rentabilidad Neta', mermas: 'Mermas Productivas' };
  const titulo  = titulos[tipo] || tipo;
  const periodo = `${fi || 'inicio'} — ${ff || 'hoy'}`;
  const fecha   = new Date().toLocaleDateString('es-MX', { day:'2-digit', month:'long', year:'numeric' });

  const filasTR = filas.map((f, i) =>
    `<tr style="background:${i%2===0?'#fff':'#FFF8EC'}">
      ${f.map(c => `<td style="padding:8px 12px;border-bottom:1px solid #EEE;font-size:12px">${c}</td>`).join('')}
    </tr>`
  ).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
  <title>Reporte ${titulo}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 32px; color: #1a1a1a; }
    .header { text-align:center; margin-bottom:24px; border-bottom:3px solid #D97706; padding-bottom:16px; }
    .logo { font-size:28px; }
    .empresa { font-size:20px; font-weight:700; color:#3D1A00; margin:4px 0; }
    .subtitulo { font-size:13px; color:#888; }
    .reporte-titulo { font-size:18px; font-weight:700; color:#D97706; margin:16px 0 4px; }
    .periodo { font-size:12px; color:#666; margin-bottom:20px; }
    table { width:100%; border-collapse:collapse; margin-top:8px; }
    thead th { background:#3D1A00; color:#fff; padding:10px 12px; font-size:12px; text-align:left; }
    tfoot td { background:#D97706; color:#fff; padding:8px 12px; font-weight:700; font-size:12px; }
    .footer { margin-top:32px; text-align:center; font-size:11px; color:#aaa; border-top:1px solid #eee; padding-top:12px; }
    @media print { body { padding:16px; } button { display:none; } }
  </style></head><body>
  <div class="header">
    <div class="logo">🥖</div>
    <div class="empresa">ERP Panadería</div>
    <div class="subtitulo">Sistema de Gestión Integral</div>
  </div>
  <div class="reporte-titulo">📊 ${titulo}</div>
  <div class="periodo">Período: ${periodo} &nbsp;|&nbsp; Generado: ${fecha}</div>
  <table>
    <thead><tr>${heads.map(h => `<th>${h}</th>`).join('')}</tr></thead>
    <tbody>${filasTR}</tbody>
  </table>
  <div class="footer">ERP Panadería — Reporte generado el ${fecha}</div>
  <script>window.onload = function(){ window.print(); }<\/script>
  </body></html>`;

  const ventana = window.open('', '_blank', 'width=900,height=700');
  ventana.document.write(html);
  ventana.document.close();
}

function loadReportes() {
  const hoy    = new Date().toISOString().split('T')[0];
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
  const fi    = document.getElementById('rep-fi').value;
  const ff    = document.getElementById('rep-ff').value;
  const thead = document.querySelector('#tbl-rep thead');
  const tbody = document.querySelector('#tbl-rep tbody');
  tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:24px"><div class="spinner"></div></td></tr>';

  try {
    if (nombre === 'volumen') {
      const data = await api.getReporteVolumen(fi, ff);
      thead.innerHTML = '<tr><th>#</th><th>Producto</th><th>Unidades Vendidas</th><th>Ranking</th></tr>';
      tbody.innerHTML = '';
      data.forEach((r, i) => {
        const color = i === 0 ? '#D97706' : i === 1 ? '#9CA3AF' : i === 2 ? '#92400E' : 'var(--text-muted)';
        tbody.innerHTML += `<tr>
          <td>${r.id}</td>
          <td><strong>${r.nombre}</strong></td>
          <td>${r.total_vendido}</td>
          <td><span style="color:${color};font-weight:700">#${i+1}</span></td>
        </tr>`;
      });
    } else if (nombre === 'rentabilidad') {
      const data = await api.getReporteRentabilidad(fi, ff);
      thead.innerHTML = '<tr><th>Producto</th><th>Ingresos</th><th>Costo Prod.</th><th>Ganancia</th><th>Margen %</th></tr>';
      tbody.innerHTML = '';
      data.forEach(r => {
        const color = r.ganancia >= 0 ? 'var(--success)' : 'var(--danger)';
        tbody.innerHTML += `<tr>
          <td><strong>${r.producto}</strong></td>
          <td>${fmt(r.ingresos)}</td>
          <td>${fmt(r.costo_produccion)}</td>
          <td style="color:${color};font-weight:600">${fmt(r.ganancia)}</td>
          <td style="color:${color}">${r.margen_pct}%</td>
        </tr>`;
      });
    } else if (nombre === 'mermas') {
      const data = await api.getReporteMermas();
      thead.innerHTML = '<tr><th>Producto</th><th>Proyectado</th><th>Real</th><th>Merma (U)</th><th>% Merma</th></tr>';
      tbody.innerHTML = '';
      data.forEach(r => {
        const color = r.pct_merma > 20 ? 'var(--danger)' : r.pct_merma > 10 ? '#D97706' : 'var(--success)';
        tbody.innerHTML += `<tr>
          <td><strong>${r.producto}</strong></td>
          <td>${r.proyectado}</td>
          <td>${r.real}</td>
          <td>${r.merma}</td>
          <td><span class="badge" style="background:${color};color:#fff">${r.pct_merma}%</span></td>
        </tr>`;
      });
    }
  } catch(e) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--danger)">Error cargando reporte</td></tr>`;
  }
}
