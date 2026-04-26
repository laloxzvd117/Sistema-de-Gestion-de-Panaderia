// ============================================================
//  Módulo: dashboard.js
//  - KPIs
//  - Gráfica de ingresos últimos 7 días (Chart.js)
//  - Tabla de ventas paginada
// ============================================================

let _todasVentasDash = [];
let _paginaVentas    = 1;
const _porPagina     = 10;

async function loadDashboard() {
  const permisos = usuario?.permisos || 3;
  try {
    const kpi = await api.getKPIs();
    document.getElementById('kpi-ventas').textContent   = kpi.ventas_hoy;
    document.getElementById('kpi-ingresos').textContent = fmt(kpi.ingresos_hoy);
    const kpiStock = document.getElementById('kpi-stock');
    const kpiEmp   = document.getElementById('kpi-emp');
    const kpiLotes = document.getElementById('kpi-lotes');
    if (kpiStock) kpiStock.textContent = kpi.stock_bajo;
    if (kpiEmp)   kpiEmp.textContent   = kpi.empleados_activos;
    if (kpiLotes) kpiLotes.textContent = kpi.lotes_hoy;

    if (permisos === 3) {
      ['kpi-card-stock','kpi-card-emp','kpi-card-lotes'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
      });
    }

    // Gráfica solo para admin/gerente
    if (permisos !== 3) {
      await cargarGraficaVentas();
    }

    // Tabla de ventas paginada
    _todasVentasDash = await api.getHistorialVentas();
    _paginaVentas = 1;
    if (permisos === 3) {
      _todasVentasDash = _todasVentasDash.filter(v => v.cajero === usuario.nombre);
    }
    renderTablaDash();

  } catch(e) { toast('Error cargando dashboard: ' + e.message, 'error'); }
}

async function cargarGraficaVentas() {
  try {
    const datos = await api.getVentasSemana();
    const labels   = datos.map(d => {
      const f = new Date(d.dia + 'T12:00:00');
      return f.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric' });
    });
    const ingresos = datos.map(d => d.ingresos);
    const ventas   = datos.map(d => d.ventas);

    const cont = document.getElementById('dash-grafica-cont');
    if (!cont) return;
    cont.style.display = 'block';

    // Destruir gráfica anterior si existe
    if (window._dashChart) { window._dashChart.destroy(); }

    const ctx = document.getElementById('dash-chart').getContext('2d');
    window._dashChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Ingresos ($)',
            data: ingresos,
            backgroundColor: 'rgba(217,119,6,0.7)',
            borderColor: '#D97706',
            borderWidth: 1.5,
            borderRadius: 6,
            yAxisID: 'y'
          },
          {
            label: 'Ventas',
            data: ventas,
            type: 'line',
            borderColor: '#059669',
            backgroundColor: 'rgba(5,150,105,0.1)',
            borderWidth: 2,
            pointBackgroundColor: '#059669',
            pointRadius: 4,
            tension: 0.3,
            yAxisID: 'y1'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { font: { size: 12 }, boxWidth: 14 } },
          tooltip: {
            callbacks: {
              label: ctx => ctx.dataset.label === 'Ingresos ($)'
                ? ' $' + ctx.parsed.y.toLocaleString('es-MX', { minimumFractionDigits: 2 })
                : ' ' + ctx.parsed.y + ' ventas'
            }
          }
        },
        scales: {
          y:  { position: 'left',  beginAtZero: true, ticks: { callback: v => '$' + v.toLocaleString('es-MX') } },
          y1: { position: 'right', beginAtZero: true, grid: { drawOnChartArea: false }, ticks: { stepSize: 1 } }
        }
      }
    });
  } catch(e) { console.warn('Error cargando gráfica:', e.message); }
}

function renderTablaDash() {
  const permisos  = usuario?.permisos || 3;
  const total     = _todasVentasDash.length;
  const totalPags = Math.ceil(total / _porPagina) || 1;
  const inicio    = (_paginaVentas - 1) * _porPagina;
  const pagina    = _todasVentasDash.slice(inicio, inicio + _porPagina);

  const tbody = tbBody('tbl-ventas-dash');
  tbody.innerHTML = '';
  pagina.forEach(v => {
    tbody.innerHTML += `<tr>
      <td>#${v.id}</td>
      <td>${v.cliente}</td>
      ${permisos !== 3 ? `<td>${v.cajero}</td>` : ''}
      <td><strong>${fmt(v.total)}</strong></td>
      <td>${new Date(v.fecha).toLocaleString('es-MX')}</td>
    </tr>`;
  });
  if (!pagina.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--text-muted)">Sin ventas registradas</td></tr>`;
  }

  // Ajustar encabezado según rol
  if (permisos === 3) {
    const thead = document.querySelector('#tbl-ventas-dash thead tr');
    if (thead) thead.innerHTML = '<th>#</th><th>Cliente</th><th>Total</th><th>Fecha</th>';
  }

  // Paginación
  const pagCont = document.getElementById('dash-paginacion');
  if (!pagCont) return;
  if (totalPags <= 1) { pagCont.innerHTML = ''; return; }

  let btns = '';
  btns += `<button class="btn btn-secondary btn-sm" onclick="cambiarPaginaDash(${_paginaVentas-1})" ${_paginaVentas===1?'disabled':''}>‹</button>`;
  for (let i = 1; i <= totalPags; i++) {
    btns += `<button class="btn btn-sm ${i===_paginaVentas?'btn-primary':'btn-secondary'}" onclick="cambiarPaginaDash(${i})">${i}</button>`;
  }
  btns += `<button class="btn btn-secondary btn-sm" onclick="cambiarPaginaDash(${_paginaVentas+1})" ${_paginaVentas===totalPags?'disabled':''}>›</button>`;
  btns += `<span style="font-size:.8rem;color:var(--text-muted);align-self:center">Página ${_paginaVentas} de ${totalPags} · ${total} ventas</span>`;
  pagCont.innerHTML = btns;
}

function cambiarPaginaDash(pag) {
  const total = _todasVentasDash.length;
  const totalPags = Math.ceil(total / _porPagina) || 1;
  if (pag < 1 || pag > totalPags) return;
  _paginaVentas = pag;
  renderTablaDash();
}
