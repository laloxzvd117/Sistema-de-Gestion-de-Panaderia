// ============================================================
//  Módulo: logs.js — Historial de actividad (solo Admin)
// ============================================================

let _logsData    = [];
let _logsPagina  = 1;
const _logsPorPag = 15;

async function loadLogs() {
  try {
    const [resumen, logs] = await Promise.all([
      apiFetch('/logs/resumen'),
      apiFetch('/logs/?limite=200')
    ]);

    // KPIs
    document.getElementById('log-kpi-total').textContent  = resumen.total;
    document.getElementById('log-kpi-hoy').textContent    = resumen.hoy;
    document.getElementById('log-kpi-users').textContent  = resumen.usuarios;
    document.getElementById('log-kpi-top').textContent    = resumen.modulo_top;

    _logsData   = logs;
    _logsPagina = 1;
    renderLogs(_logsData);
  } catch(e) { toast('Error cargando logs: ' + e.message, 'error'); }
}

function filtrarLogs() {
  const busqueda = document.getElementById('log-busqueda').value.toLowerCase();
  const modulo   = document.getElementById('log-filtro-modulo').value;

  const filtrados = _logsData.filter(l => {
    const matchBusqueda = !busqueda ||
      l.descripcion.toLowerCase().includes(busqueda) ||
      l.empleado.toLowerCase().includes(busqueda) ||
      (l.referencia || '').toLowerCase().includes(busqueda);
    const matchModulo = !modulo || l.modulo === modulo;
    return matchBusqueda && matchModulo;
  });

  _logsPagina = 1;
  renderLogs(filtrados);
}

function renderLogs(logs) {
  const total     = logs.length;
  const totalPags = Math.ceil(total / _logsPorPag) || 1;
  const inicio    = (_logsPagina - 1) * _logsPorPag;
  const pagina    = logs.slice(inicio, inicio + _logsPorPag);
  const tbody     = tbBody('tbl-logs');
  tbody.innerHTML = '';

  const colores = {
    LOGIN:      '#3B82F6', LOGOUT:    '#6B7280',
    CREATE:     '#059669', UPDATE:    '#D97706',
    DELETE:     '#EF4444', VENTA:     '#8B5CF6',
    COMPRA:     '#0891B2', PRODUCCION:'#D97706',
  };

  pagina.forEach(l => {
    const color = colores[l.accion] || '#6B7280';
    tbody.innerHTML += `<tr>
      <td style="font-size:.75rem;color:var(--text-muted)">${l.fecha}</td>
      <td>
        <div style="font-weight:600">${l.empleado}</div>
        <div style="font-size:.73rem;color:var(--text-muted)">${l.rol}</div>
      </td>
      <td><span style="background:${color};color:#fff;padding:2px 10px;border-radius:999px;font-size:.72rem;font-weight:600">${l.accion}</span></td>
      <td><span style="font-size:.78rem;color:var(--text-muted);text-transform:uppercase">${l.modulo}</span></td>
      <td>
        <div>${l.descripcion}</div>
        ${l.referencia ? `<div style="font-size:.75rem;color:var(--amber-dark)">${l.referencia}</div>` : ''}
      </td>
    </tr>`;
  });

  if (!pagina.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--text-muted)">Sin registros encontrados</td></tr>';
  }

  // Paginación
  const pagCont = document.getElementById('logs-paginacion');
  if (!pagCont) return;
  if (totalPags <= 1) {
    pagCont.innerHTML = `<span style="font-size:.8rem;color:var(--text-muted)">${total} registros</span>`;
    return;
  }
  let btns = `<button class="btn btn-secondary btn-sm" onclick="cambiarPagLogs(${_logsPagina-1})" ${_logsPagina===1?'disabled':''}>‹</button>`;
  const desde = Math.max(1, _logsPagina - 2);
  const hasta  = Math.min(totalPags, _logsPagina + 2);
  for (let i = desde; i <= hasta; i++) {
    btns += `<button class="btn btn-sm ${i===_logsPagina?'btn-primary':'btn-secondary'}" onclick="cambiarPagLogs(${i})">${i}</button>`;
  }
  btns += `<button class="btn btn-secondary btn-sm" onclick="cambiarPagLogs(${_logsPagina+1})" ${_logsPagina===totalPags?'disabled':''}>›</button>`;
  btns += `<span style="font-size:.8rem;color:var(--text-muted);align-self:center">Pág ${_logsPagina}/${totalPags} · ${total} registros</span>`;
  pagCont.innerHTML = btns;
}

function cambiarPagLogs(pag) {
  const totalPags = Math.ceil(_logsData.length / _logsPorPag) || 1;
  if (pag < 1 || pag > totalPags) return;
  _logsPagina = pag;
  filtrarLogs();
}

// ── Función global para registrar logs desde otros módulos ───
async function registrarLog(accion, modulo, descripcion, referencia = null) {
  if (!usuario?.id) return;
  try {
    await apiFetch('/logs/', {
      method: 'POST',
      body: JSON.stringify({
        id_empleado: usuario.id,
        accion, modulo, descripcion, referencia
      })
    });
  } catch(e) { /* silencioso — logs no deben interrumpir flujo */ }
}

// ── Perfil de usuario ────────────────────────────────────────
function loadPerfil() {
  if (!usuario) return;
  const inicial = usuario.nombre.charAt(0).toUpperCase();
  document.getElementById('perfil-avatar').textContent  = inicial;
  document.getElementById('perfil-nombre').textContent  = usuario.nombre;
  document.getElementById('perfil-rol').textContent     = usuario.rol;
  document.getElementById('perfil-nombre2').textContent = usuario.nombre;
  document.getElementById('perfil-rol2').textContent    = usuario.rol;
  document.getElementById('perfil-sesion').textContent  =
    new Date().toLocaleString('es-MX', { day:'2-digit', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' });
}