// ============================================================
//  Módulo: inventario.js
// ============================================================

// ── INVENTARIO ───────────────────────────────────────────────
let _todosInsumos = [];

async function loadInventario() {
  try {
    _todosInsumos = await api.getInventario();
    const busqueda = document.getElementById('insumos-busqueda')?.value || '';
    renderInsumos(busqueda ? _todosInsumos.filter(i =>
      i.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      i.unidad.toLowerCase().includes(busqueda.toLowerCase())
    ) : _todosInsumos);
  } catch(e) { toast('Error: ' + e.message, 'error'); }
}

async function filtrarInsumos(texto) {
  if (!_todosInsumos.length) {
    _todosInsumos = await api.getInventario();
  }
  const filtrados = texto
    ? _todosInsumos.filter(i =>
        i.nombre.toLowerCase().includes(texto.toLowerCase()) ||
        i.unidad.toLowerCase().includes(texto.toLowerCase()))
    : _todosInsumos;
  renderInsumos(filtrados);
}

function renderInsumos(items) {
  try {
    const tbody = tbBody('tbl-inv');
    tbody.innerHTML = '';
    if (!items.length) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--text-muted)">Sin resultados</td></tr>';
      return;
    }
    items.forEach(i => {
      const estado = i.stock < 5 ? '<span class="badge badge-red">Crítico</span>'
                   : i.stock < 15 ? '<span class="badge badge-amber">Bajo</span>'
                   : '<span class="badge badge-green">OK</span>';
      tbody.innerHTML += `<tr>
        <td>${i.id}</td>
        <td><strong>${i.nombre}</strong></td>
        <td>${i.stock}</td>
        <td>${i.unidad}</td>
        <td>${fmt(i.costo_unitario)}</td>
        <td>${estado}</td>
        <td style="display:flex;gap:4px">
          <button class="btn btn-secondary btn-sm" onclick='editarInsumo(${JSON.stringify(i)})' title="Editar">✏️</button>
          <button class="btn btn-danger btn-sm" onclick="eliminarInsumo(${i.id})" title="Eliminar permanentemente">🗑️</button>
        </td>
      </tr>`;
    });
  } catch(e) { toast('Error renderizando insumos: ' + e.message, 'error'); }
}

function abrirModalInsumo() {
  document.getElementById('modal-insumo-title').textContent = 'Nuevo Insumo';
  document.getElementById('insumo-id').value = '';
  ['nombre','stock','costo'].forEach(f => document.getElementById(`insumo-${f}`).value = '');
  abrirModal('modal-insumo');
}

function editarInsumo(i) {
  document.getElementById('modal-insumo-title').textContent = 'Editar Insumo';
  document.getElementById('insumo-id').value      = i.id;
  document.getElementById('insumo-nombre').value  = i.nombre;
  document.getElementById('insumo-stock').value   = i.stock;
  document.getElementById('insumo-unidad').value  = i.unidad;
  document.getElementById('insumo-costo').value   = i.costo_unitario;
  abrirModal('modal-insumo');
}

async function guardarInsumo() {
  const id     = document.getElementById('insumo-id').value;
  const nombre = document.getElementById('insumo-nombre').value.trim();
  const stock  = parseFloat(document.getElementById('insumo-stock').value);
  const unidad = document.getElementById('insumo-unidad').value;
  const costo  = parseFloat(document.getElementById('insumo-costo').value || 0);
  if (!nombre || isNaN(stock)) return toast('Nombre y stock son requeridos', 'error');
  try {
    if (id) { await api.actualizarInsumo(id, { nombre_insumo: nombre, stock_actual: stock, unidad_medida: unidad, costo_unitario: costo }); toast('Insumo actualizado'); }
    else    { await api.crearInsumo({ nombre_insumo: nombre, stock_actual: stock, unidad_medida: unidad, costo_unitario: costo }); toast('Insumo creado'); }
    cerrarModal('modal-insumo');
    loadInventario();
  } catch(e) { toast('Error: ' + e.message, 'error'); }
}

async function eliminarInsumo(id) {
  confirmarAccion(
    'Eliminar insumo',
    'Esta accion eliminara el insumo permanentemente y no se puede deshacer. ¿Confirmas?',
    async () => {
      try { await api.eliminarInsumo(id); toast('Insumo eliminado'); loadInventario(); }
      catch(e) { toast('Error: ' + e.message, 'error'); }
    }
  );
}
