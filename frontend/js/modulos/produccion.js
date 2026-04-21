// ============================================================
//  Módulo: produccion.js
// ============================================================

// ── PRODUCCIÓN ───────────────────────────────────────────────
let produccionTab = 'planificar';

async function loadProduccion() {
  try {
    await initProductosProduccion();
    const prods = _todosProductosProduccion.filter(p => p.activo === 1 || p.activo === true);
    // Llenar ambos selects
    const opts = prods.map(p => `<option value="${p.id}">${p.nombre} (${p.categoria})</option>`).join('');
    const selPlan = document.getElementById('plan-producto');
    const selReg  = document.getElementById('reg-producto');
    if (selPlan) selPlan.innerHTML = opts;
    if (selReg)  selReg.innerHTML  = opts;

    // Cargar lotes pendientes para el tab registrar
    await cargarLotesPendientes();
    // Cargar historial
    await cargarHistorialProduccion();
  } catch(e) { toast('Error: ' + e.message, 'error'); }
}

function switchProduccionTab(tab) {
  produccionTab = tab;
  document.querySelectorAll('.prod-tab').forEach(b => b.classList.remove('active'));
  document.querySelector(`.prod-tab[data-tab="${tab}"]`).classList.add('active');
  document.querySelectorAll('.prod-panel').forEach(p => p.style.display = 'none');
  document.getElementById(`panel-${tab}`).style.display = 'block';
}

async function onProductoChange(selectId) {
  const id = parseInt(document.getElementById(selectId).value);
  if (!id) return;
  const cont = document.getElementById('plan-insumos');
  if (!cont) return;
  const cantidadRaw = parseInt(document.getElementById('plan-estimada').value);
  const cantidad = cantidadRaw > 0 ? cantidadRaw : null;
  if (!cantidad) {
    cont.innerHTML = '<div style="font-size:.85rem;color:var(--text-muted);padding:8px 0">Ingresa la cantidad planificada para ver los insumos requeridos.</div>';
    return;
  }
  try {
    const data = await api.getRecetaProducto(id, cantidad);
    if (!data.receta) {
      cont.innerHTML = '<div class="empty-state"><div class="icon">⚠️</div><p>Sin receta configurada para este producto</p></div>';
      return;
    }
    const hayInsuficiente = data.insumos.some(i => !i.suficiente);
    cont.innerHTML = `
      <div style="font-size:.82rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px">
        📋 ${data.receta.nombre} · Para ${cantidad} pzas (base: ${data.receta.rendimiento_base} pzas)
      </div>
      ${hayInsuficiente ? '<div class="badge badge-red" style="margin-bottom:8px;padding:6px 12px">⚠️ Hay insumos insuficientes</div>' : '<div class="badge badge-green" style="margin-bottom:8px;padding:6px 12px">✅ Insumos suficientes</div>'}
      <div class="table-wrap">
        <table>
          <thead><tr><th>Insumo</th><th>Requerido</th><th>Unidad</th><th>Stock</th><th>Estado</th></tr></thead>
          <tbody>
            ${data.insumos.map(i => `<tr>
              <td><strong>${i.nombre}</strong></td>
              <td>${i.cantidad_requerida}</td>
              <td>${i.unidad}</td>
              <td>${i.stock_actual}</td>
              <td>${i.suficiente ? '<span class="badge badge-green">OK</span>' : '<span class="badge badge-red">Insuficiente</span>'}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  } catch(e) { cont.innerHTML = '<p style="color:var(--danger)">Error cargando receta</p>'; }
}

async function planificarLote() {
  const id_producto       = parseInt(document.getElementById('plan-producto').value);
  const cantidad_estimada = parseInt(document.getElementById('plan-estimada').value);
  if (!id_producto)                                return toast('Selecciona un producto', 'error');
  if (!cantidad_estimada || cantidad_estimada <= 0) return toast('Ingresa una cantidad válida', 'error');

  // Verificar insumos suficientes antes de proceder
  try {
    const verificacion = await api.getRecetaProducto(id_producto, cantidad_estimada);
    const insuficientes = verificacion.insumos.filter(i => !i.suficiente);
    if (insuficientes.length > 0) {
      const lista = insuficientes.map(i => '- ' + i.nombre + ': necesita ' + i.cantidad_requerida + ' ' + i.unidad + ', hay ' + i.stock_actual).join('\n');
      confirmarAccion(
        'Stock insuficiente',
        'No se puede producir. Insumos faltantes:\n\n' + lista + '\n\nAgrega insumos antes de continuar.',
        null,
        'info'
      );
      return;
    }
  } catch(e) { /* si falla la verificación, continúa */ }

  await ejecutarPlanificarLote(id_producto, cantidad_estimada);
}

async function ejecutarPlanificarLote(id_producto, cantidad_estimada) {
  try {
    const res = await api.planificarLote({ id_producto, id_empleado: usuario.id, cantidad_estimada });
    document.getElementById('plan-resultado').innerHTML = `
      <div class="card" style="background:var(--amber-light);border-color:var(--amber);margin-top:12px">
        <div style="font-weight:700;color:var(--amber-dark);font-size:1rem;margin-bottom:6px">✅ Lote planificado</div>
        <div style="font-size:1.3rem;font-weight:700;color:var(--brown);margin-bottom:4px">${res.codigo_lote}</div>
        <div style="font-size:.85rem;color:var(--text-muted)">Insumos descontados del inventario. Usa este código para registrar el resultado.</div>
      </div>`;
    document.getElementById('plan-estimada').value = '';
    await cargarLotesPendientes();
    await cargarHistorialProduccion();
  } catch(e) { toast('Error: ' + e.message, 'error'); }
}

async function cargarLotesPendientes(busqueda = '') {
  try {
    const lotes = await api.getLotesPendientes(busqueda);
    const sel = document.getElementById('reg-codigo');
    if (!sel) return;
    sel.innerHTML = '<option value="">-- Selecciona un lote --</option>' +
      lotes.map(l => `<option value="${l.id_proceso}">${l.label}</option>`).join('');
    if (!lotes.length && busqueda) {
      sel.innerHTML = '<option value="">Sin lotes con ese nombre</option>';
    }
  } catch(e) {}
}

async function registrarResultadoLote() {
  const id_proceso       = parseInt(document.getElementById('reg-codigo').value);
  const cantidad_lograda = parseInt(document.getElementById('reg-lograda').value);
  const horas_trabajadas = parseFloat(document.getElementById('reg-horas').value);
  if (!id_proceso)       return toast('Selecciona un lote', 'error');
  if (!cantidad_lograda) return toast('Ingresa la cantidad lograda', 'error');
  if (!horas_trabajadas) return toast('Ingresa las horas trabajadas', 'error');
  try {
    const res = await apiFetch(`/produccion/registrar-lote/${id_proceso}`, {
      method: 'PATCH',
      body: JSON.stringify({ cantidad_lograda, horas_trabajadas, id_empleado: usuario.id })
    });
    const tieneMerma = res.merma > 0;
    document.getElementById('reg-resultado').innerHTML = `
      <div class="card" style="background:#ECFDF5;border-color:#059669;margin-top:12px">
        <div style="font-weight:700;color:#065F46;margin-bottom:8px">✅ ${res.codigo_lote} registrado</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:.85rem">
          <div>Estimado: <strong>${res.cantidad_estimada} pzas</strong></div>
          <div>Logrado: <strong>${res.cantidad_lograda} pzas</strong></div>
          <div>Costo unitario: <strong>${fmt(res.costo_unitario)}</strong></div>
          <div>Costo total: <strong>${fmt(res.costo_total_lote)}</strong></div>
        </div>
        ${tieneMerma ? `<div style="margin-top:10px;padding:8px 12px;background:#FEF3C7;border-radius:8px;border-left:3px solid #D97706;font-size:.83rem;color:#92400E">
          ⚠️ Merma: <strong>${res.merma} pzas</strong> (${(res.merma/res.cantidad_estimada*100).toFixed(1)}%) — Insumos excedentes devueltos al inventario
        </div>` : ''}
      </div>`;
    ['lograda','horas'].forEach(f => document.getElementById(`reg-${f}`).value = '');
    document.getElementById('reg-codigo').value = '';
    if (document.getElementById('reg-busqueda')) document.getElementById('reg-busqueda').value = '';
    await cargarLotesPendientes();
    await cargarHistorialProduccion();
  } catch(e) { toast('Error: ' + e.message, 'error'); }
}

async function cargarHistorialProduccion() {
  try {
    const hist = await api.getHistorialProduccion();
    const tbody = tbBody('tbl-produccion');
    if (!tbody) return;
    tbody.innerHTML = '';
    hist.forEach(h => {
      tbody.innerHTML += `<tr>
        <td><strong>${h.producto}</strong></td>
        <td>${h.fecha}</td>
        <td>${h.cantidad}</td>
        <td>${fmt(h.costo_unitario)}</td>
      </tr>`;
    });
    if (!hist.length) tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:32px;color:var(--text-muted)">Sin lotes registrados</td></tr>';
  } catch(e) {}
}

// ── PRODUCTOS ────────────────────────────────────────────────
async function loadProductos() {
  try {
    const items = await api.getProductos();
    const tbody = tbBody('tbl-productos');
    tbody.innerHTML = '';
    items.forEach(p => {
      const badge = p.activo ? '<span class="badge badge-green">Activo</span>' : '<span class="badge badge-gray">Inactivo</span>';
      tbody.innerHTML += `<tr>
        <td>${p.id}</td>
        <td><strong>${p.nombre}</strong></td>
        <td><span class="badge badge-amber">${p.categoria}</span></td>
        <td>${fmt(p.precio)}</td>
        <td>${p.tiempo_elaboracion} min</td>
        <td>${badge}</td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick='editarProducto(${JSON.stringify(p)})'>✏️</button>
          <button class="btn btn-secondary btn-sm" onclick="toggleProducto(${p.id}, ${p.activo})">${p.activo ? '🚫' : '✅'}</button>
        </td>
      </tr>`;
    });
  } catch(e) { toast('Error: ' + e.message, 'error'); }
}

function abrirModalProducto() {
  document.getElementById('modal-producto-title').textContent = 'Nuevo Producto';
  document.getElementById('producto-id').value = '';
  ['nombre','precio','tiempo'].forEach(f => document.getElementById(`producto-${f}`).value = '');
  abrirModal('modal-producto');
}

function editarProducto(p) {
  document.getElementById('modal-producto-title').textContent = 'Editar Producto';
  document.getElementById('producto-id').value     = p.id;
  document.getElementById('producto-nombre').value = p.nombre;
  document.getElementById('producto-cat').value    = p.categoria;
  document.getElementById('producto-precio').value = p.precio;
  document.getElementById('producto-tiempo').value = p.tiempo_elaboracion;
  abrirModal('modal-producto');
}

async function guardarProducto() {
  const id     = document.getElementById('producto-id').value;
  const nombre = document.getElementById('producto-nombre').value.trim();
  const cat    = document.getElementById('producto-cat').value;
  const precio = parseFloat(document.getElementById('producto-precio').value);
  const tiempo = parseInt(document.getElementById('producto-tiempo').value);
  if (!nombre || isNaN(precio)) return toast('Nombre y precio son requeridos', 'error');
  try {
    if (id) { await api.actualizarProducto(id, { nombre, categoria: cat, precio, tiempo_elaboracion: tiempo }); toast('Producto actualizado'); }
    else    { await api.crearProducto({ nombre, categoria: cat, precio, tiempo_elaboracion: tiempo }); toast('Producto creado'); }
    cerrarModal('modal-producto');
    loadProductos();
  } catch(e) { toast('Error: ' + e.message, 'error'); }
}

async function toggleProducto(id, activo) {
  confirmarAccion(
    activo ? 'Desactivar producto' : 'Activar producto',
    activo ? '¿Desactivar este producto? No aparecerá en el POS.' : '¿Activar este producto? Volverá a aparecer en el POS.',
    async () => {
      try {
        await api.actualizarProducto(id, { activo: activo ? 0 : 1 });
        toast(activo ? 'Producto desactivado' : 'Producto activado');
        _todosProductosProduccion = []; // limpiar caché de producción
        loadProductos();
      } catch(e) { toast('Error: ' + e.message, 'error'); }
    }
  );
}

// ── EMPLEADOS CRUD COMPLETO ──────────────────────────────────
async function loadEmpleados() {
  try {
    const emps = await api.getEmpleados();
    const tbody = tbBody('tbl-emp');
    tbody.innerHTML = '';
    emps.forEach(e => {
      const badge = e.activo ? '<span class="badge badge-green">Activo</span>' : '<span class="badge badge-red">Baja</span>';
      const acciones = e.activo
        ? `<button class="btn btn-secondary btn-sm" onclick='editarEmpleado(${JSON.stringify(e)})' title="Editar">✏️</button>
           <button class="btn btn-secondary btn-sm" onclick="abrirModalPassword(${e.id}, '${e.nombre} ${e.apellidos}')" title="Cambiar contraseña">🔑</button>
           <button class="btn btn-danger btn-sm" onclick="bajaEmpleado(${e.id})" title="Dar baja">🚫</button>`
        : `<button class="btn btn-success btn-sm" onclick="reactivarEmpleado(${e.id})" title="Reactivar">✅</button>`;
      tbody.innerHTML += `<tr style="${!e.activo ? 'opacity:.55' : ''}">
        <td>${e.id}</td>
        <td><strong>${e.nombre} ${e.apellidos}</strong></td>
        <td>${e.cargo}</td>
        <td>${e.telefono}</td>
        <td>${fmt(e.sueldo)}</td>
        <td>${e.fecha_contratacion}</td>
        <td>${badge}</td>
        <td style="display:flex;gap:4px">${acciones}</td>
      </tr>`;
    });
    if (!emps.length) tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--text-muted)">Sin empleados registrados</td></tr>';
  } catch(e) { toast('Error: ' + e.message, 'error'); }
}

async function abrirModalEmpleado() {
  try {
    const cargos = await api.getCargos();
    document.getElementById('emp-id').value = '';
    document.getElementById('emp-modal-title').textContent = 'Nuevo Empleado';
    document.getElementById('emp-cargo').innerHTML = cargos.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
    document.getElementById('emp-fecha').value = new Date().toISOString().split('T')[0];
    document.getElementById('emp-pass-group').style.display = 'block';
    ['nombre','apellidos','tel','usuario','sueldo','pass'].forEach(f => document.getElementById(`emp-${f}`).value = '');
    document.getElementById('emp-horas').value = '160';
    abrirModal('modal-empleado');
  } catch(e) { toast('Error cargando cargos', 'error'); }
}

async function editarEmpleado(emp) {
  try {
    const cargos = await api.getCargos();
    document.getElementById('emp-id').value = emp.id;
    document.getElementById('emp-modal-title').textContent = 'Editar Empleado';
    document.getElementById('emp-cargo').innerHTML = cargos.map(c => `<option value="${c.id}" ${c.id == emp.id_cargo ? 'selected' : ''}>${c.nombre}</option>`).join('');
    document.getElementById('emp-nombre').value    = emp.nombre;
    document.getElementById('emp-apellidos').value = emp.apellidos;
    document.getElementById('emp-tel').value       = emp.telefono;
    document.getElementById('emp-usuario').value   = emp.usuario || emp.telefono;
    document.getElementById('emp-sueldo').value    = emp.sueldo;
    document.getElementById('emp-horas').value     = emp.horas;
    document.getElementById('emp-fecha').value     = emp.fecha_contratacion;
    document.getElementById('emp-pass-group').style.display = 'none';
    abrirModal('modal-empleado');
  } catch(e) { toast('Error: ' + e.message, 'error'); }
}

async function guardarEmpleado() {
  const id        = document.getElementById('emp-id').value;
  const nombre    = document.getElementById('emp-nombre').value.trim();
  const apellidos = document.getElementById('emp-apellidos').value.trim();
  const id_cargo  = parseInt(document.getElementById('emp-cargo').value);
  const telefono  = document.getElementById('emp-tel').value.trim();
  const usuario   = document.getElementById('emp-usuario').value.trim();
  const password  = document.getElementById('emp-pass').value;
  const sueldo    = parseFloat(document.getElementById('emp-sueldo').value);
  const horas     = parseInt(document.getElementById('emp-horas').value);
  const fecha     = document.getElementById('emp-fecha').value;
  const loginUser = usuario || telefono;
  if (!nombre || !apellidos || !loginUser || !sueldo) return toast('Completa nombre, apellidos, usuario y sueldo', 'error');
  try {
    if (id) {
      await api.actualizarEmpleado(id, { nombre, apellidos, id_cargo, telefono, usuario: loginUser, sueldo, horas, fecha_contratacion: fecha });
      toast('Empleado actualizado');
    } else {
      if (!password || password.length < 4) return toast('La contraseña debe tener mínimo 4 caracteres', 'error');
      const res = await api.crearEmpleado({ nombre, apellidos, id_cargo, telefono, usuario: loginUser, password, sueldo, horas, fecha_contratacion: fecha });
      toast(`Empleado registrado — Usuario: ${res.usuario || loginUser}`);
    }
    cerrarModal('modal-empleado');
    loadEmpleados();
  } catch(e) { toast('Error: ' + e.message, 'error'); }
}

function abrirModalPassword(id, nombre) {
  document.getElementById('pwd-emp-id').value = id;
  document.getElementById('pwd-emp-nombre').textContent = nombre;
  document.getElementById('pwd-nueva').value = '';
  document.getElementById('pwd-confirmar').value = '';
  abrirModal('modal-password');
}

async function guardarPassword() {
  const id       = document.getElementById('pwd-emp-id').value;
  const nueva    = document.getElementById('pwd-nueva').value;
  const confirmar = document.getElementById('pwd-confirmar').value;
  if (!nueva || nueva.length < 4) return toast('Mínimo 4 caracteres', 'error');
  if (nueva !== confirmar) return toast('Las contraseñas no coinciden', 'error');
  try {
    await api.cambiarPassword(id, nueva);
    toast('Contraseña actualizada correctamente');
    cerrarModal('modal-password');
  } catch(e) { toast('Error: ' + e.message, 'error'); }
}

async function bajaEmpleado(id) {
  abrirModalBaja(id);
}

function abrirModalBaja(id) {
  document.getElementById('baja-emp-id').value = id;
  document.getElementById('baja-motivo').value = '';
  abrirModal('modal-baja');
}

async function confirmarBaja() {
  const id     = document.getElementById('baja-emp-id').value;
  const motivo = document.getElementById('baja-motivo').value.trim();
  if (!motivo) return toast('Escribe el motivo de baja', 'error');
  try {
    await api.darBajaEmpleado(id, motivo);
    toast('Empleado dado de baja');
    cerrarModal('modal-baja');
    loadEmpleados();
  } catch(e) { toast('Error: ' + e.message, 'error'); }
}

async function reactivarEmpleado(id) {
  confirmarAccion(
    'Reactivar empleado',
    '¿Deseas reactivar a este empleado? Volverá a tener acceso al sistema.',
    async () => {
      try {
        await api.reactivarEmpleado(id);
        toast('Empleado reactivado');
        loadEmpleados();
      } catch(e) { toast('Error: ' + e.message, 'error'); }
    }
  );
}

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
let _todosProductosProduccion = [];

async function initProductosProduccion() {
  if (!_todosProductosProduccion.length) {
    _todosProductosProduccion = await api.getProductos(1);
  }
}

function filtrarSelectProduccion(selectId, texto) {
  const sel = document.getElementById(selectId);
  if (!sel || !_todosProductosProduccion.length) return;
  // Solo productos activos
  const activos = _todosProductosProduccion.filter(p => p.activo === 1 || p.activo === true);
  const filtrados = texto
    ? activos.filter(p =>
        p.nombre.toLowerCase().includes(texto.toLowerCase()) ||
        p.categoria.toLowerCase().includes(texto.toLowerCase()))
    : activos;
  sel.innerHTML = filtrados.length
    ? filtrados.map(p => `<option value="${p.id}">${p.nombre} (${p.categoria})</option>`).join('')
    : '<option value="">Sin resultados</option>';
  // Disparar cambio para actualizar insumos
  if (filtrados.length) onProductoChange(selectId);
}

