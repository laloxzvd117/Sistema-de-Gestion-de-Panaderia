// ============================================================
//  Módulo: proveedores.js
// ============================================================

// ── PROVEEDORES ───────────────────────────────────────────────
let _itemsCompra       = [];
let _todosInsumosCompra = [];

function switchProvTab(tab, btn) {
  document.querySelectorAll('.prov-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.prov-panel').forEach(p => p.style.display = 'none');
  document.getElementById(`prov-panel-${tab}`).style.display = 'block';
  if (tab === 'lista')        cargarProveedores();
  if (tab === 'nueva-compra') iniciarNuevaCompra();
  if (tab === 'historial')    cargarHistorialCompras();
}

async function loadProveedores() {
  document.querySelectorAll('.prov-panel').forEach(p => p.style.display = 'none');
  document.getElementById('prov-panel-lista').style.display = 'block';
  document.querySelectorAll('.prov-tab').forEach(b => b.classList.remove('active'));
  document.querySelector('.prov-tab[data-tab="lista"]').classList.add('active');
  await cargarProveedores();
}

async function cargarProveedores() {
  try {
    const provs = await api.getProveedores();
    const tbody = tbBody('tbl-proveedores');
    tbody.innerHTML = '';
    provs.forEach(p => {
      tbody.innerHTML += `<tr>
        <td>${p.id}</td>
        <td><strong>${p.nombre}</strong></td>
        <td>${p.direccion}</td>
        <td>${p.telefono}</td>
        <td><span class="badge badge-blue">${p.total_compras}</span></td>
        <td>${fmt(p.monto_total)}</td>
        <td style="display:flex;gap:4px">
          <button class="btn btn-secondary btn-sm" onclick='editarProveedor(${JSON.stringify(p)})'>✏️</button>
          <button class="btn btn-danger btn-sm" onclick="eliminarProveedor(${p.id})">🗑️</button>
        </td>
      </tr>`;
    });
    if (!provs.length) tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--text-muted)">Sin proveedores registrados</td></tr>';
  } catch(e) { toast('Error: ' + e.message, 'error'); }
}

function abrirModalProveedor() {
  document.getElementById('modal-prov-titulo').textContent = 'Nuevo Proveedor';
  document.getElementById('prov-id').value = '';
  ['nombre','direccion','tel'].forEach(f => document.getElementById(`prov-${f}`).value = '');
  abrirModal('modal-proveedor');
}

function editarProveedor(p) {
  document.getElementById('modal-prov-titulo').textContent = 'Editar Proveedor';
  document.getElementById('prov-id').value       = p.id;
  document.getElementById('prov-nombre').value   = p.nombre;
  document.getElementById('prov-direccion').value= p.direccion;
  document.getElementById('prov-tel').value      = p.telefono;
  abrirModal('modal-proveedor');
}

async function guardarProveedor() {
  const id     = document.getElementById('prov-id').value;
  const nombre = document.getElementById('prov-nombre').value.trim();
  const dir    = document.getElementById('prov-direccion').value.trim();
  const tel    = document.getElementById('prov-tel').value.trim();
  if (!nombre || !dir || !tel) return toast('Completa todos los campos', 'error');
  try {
    if (id) {
      await api.actualizarProv(id, { nombre_proveedor: nombre, direccion: dir, numero_telefono: tel });
      toast('Proveedor actualizado');
    } else {
      await api.crearProveedor({ nombre_proveedor: nombre, direccion: dir, numero_telefono: tel });
      toast('Proveedor registrado');
    }
    cerrarModal('modal-proveedor');
    cargarProveedores();
  } catch(e) { toast('Error: ' + e.message, 'error'); }
}

async function eliminarProveedor(id) {
  confirmarAccion(
    'Eliminar proveedor',
    'Se eliminara el proveedor. Solo es posible si no tiene compras registradas.',
    async () => {
      try { await api.eliminarProv(id); toast('Proveedor eliminado'); cargarProveedores(); }
      catch(e) { toast('Error: ' + e.message, 'error'); }
    }
  );
}

// ── NUEVA COMPRA ──────────────────────────────────────────────
async function iniciarNuevaCompra() {
  _itemsCompra = [];
  renderItemsCompra();
  recalcularCompra();
  document.getElementById('compra-fecha').value = new Date().toISOString().split('T')[0];
  document.getElementById('compra-descripcion').value = '';
  document.getElementById('compra-item-busqueda').value = '';
  document.getElementById('compra-item-cantidad').value = '';
  document.getElementById('compra-item-precio').value = '';
  try {
    const [provs, insumos] = await Promise.all([api.getProveedores(), api.getInventario()]);
    document.getElementById('compra-proveedor').innerHTML =
      provs.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('');
    _todosInsumosCompra = insumos;
    renderInsumosCompra(insumos);
  } catch(e) { toast('Error cargando datos: ' + e.message, 'error'); }
}

function filtrarInsumosCompra(texto) {
  const filtrados = texto
    ? _todosInsumosCompra.filter(i => i.nombre.toLowerCase().includes(texto.toLowerCase()))
    : _todosInsumosCompra;
  renderInsumosCompra(filtrados);
}

function renderInsumosCompra(insumos) {
  document.getElementById('compra-item-insumo').innerHTML =
    insumos.map(i => `<option value="${i.id}" data-nombre="${i.nombre}" data-unidad="${i.unidad}">${i.nombre} (${i.unidad})</option>`).join('');
}

function agregarItemCompra() {
  const sel      = document.getElementById('compra-item-insumo');
  const opt      = sel.selectedOptions[0];
  const cantidad = parseFloat(document.getElementById('compra-item-cantidad').value);
  const precio   = parseFloat(document.getElementById('compra-item-precio').value);
  if (!opt || !cantidad || !precio || cantidad <= 0 || precio <= 0)
    return toast('Selecciona un insumo e ingresa cantidad y precio', 'error');

  const id_inventario = parseInt(opt.value);
  const existing = _itemsCompra.find(i => i.id_inventario === id_inventario);
  if (existing) {
    existing.cantidad += cantidad;
  } else {
    _itemsCompra.push({
      id_inventario,
      nombre: opt.dataset.nombre,
      unidad: opt.dataset.unidad,
      cantidad,
      precio
    });
  }
  document.getElementById('compra-item-cantidad').value = '';
  document.getElementById('compra-item-precio').value   = '';
  renderItemsCompra();
  recalcularCompra();
}

function quitarItemCompra(idx) {
  _itemsCompra.splice(idx, 1);
  renderItemsCompra();
  recalcularCompra();
}

function renderItemsCompra() {
  const tbody = tbBody('tbl-compra-items');
  if (!_itemsCompra.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--text-muted)">Agrega insumos a la compra</td></tr>';
    return;
  }
  tbody.innerHTML = _itemsCompra.map((i, idx) => `<tr>
    <td><strong>${i.nombre}</strong> <span style="color:var(--text-muted);font-size:.78rem">(${i.unidad})</span></td>
    <td>${i.cantidad}</td>
    <td>${fmt(i.precio)}</td>
    <td><strong>${fmt(i.cantidad * i.precio)}</strong></td>
    <td><button class="btn btn-danger btn-sm" onclick="quitarItemCompra(${idx})">✕</button></td>
  </tr>`).join('');
}

function recalcularCompra() {
  const sub   = _itemsCompra.reduce((a, i) => a + i.cantidad * i.precio, 0);
  const iva   = sub * 0.16;
  const total = sub + iva;
  document.getElementById('compra-sub').textContent   = fmt(sub);
  document.getElementById('compra-iva').textContent   = fmt(iva);
  document.getElementById('compra-total').textContent = fmt(total);
}

async function procesarCompra() {
  const id_proveedor = parseInt(document.getElementById('compra-proveedor').value);
  const fecha        = document.getElementById('compra-fecha').value;
  const descripcion  = document.getElementById('compra-descripcion').value.trim();
  if (!id_proveedor) return toast('Selecciona un proveedor', 'error');
  if (!fecha)        return toast('Ingresa la fecha', 'error');
  if (!descripcion)  return toast('Ingresa una descripcion', 'error');
  if (!_itemsCompra.length) return toast('Agrega al menos un insumo', 'error');

  confirmarAccion(
    'Registrar compra',
    'Se registrara la compra y se actualizara el stock e inventario de los insumos. Esta accion no se puede deshacer.',
    async () => {
      try {
        const res = await api.registrarCompra({
          id_proveedor, fecha, descripcion,
          items: _itemsCompra.map(i => ({ id_inventario: i.id_inventario, cantidad: i.cantidad, precio: i.precio }))
        });
        toast('Compra #' + res.id_compra + ' registrada. Total: ' + fmt(res.total));
        _itemsCompra = [];
        renderItemsCompra();
        recalcularCompra();
        document.getElementById('compra-descripcion').value = '';
      } catch(e) { toast('Error: ' + e.message, 'error'); }
    }
  );
}

// ── HISTORIAL COMPRAS ─────────────────────────────────────────
async function cargarHistorialCompras() {
  try {
    const compras = await api.getCompras();
    const tbody   = tbBody('tbl-historial-compras');
    tbody.innerHTML = '';
    compras.forEach(c => {
      tbody.innerHTML += `<tr>
        <td>#${c.id}</td>
        <td><strong>${c.proveedor}</strong></td>
        <td>${c.fecha}</td>
        <td>${c.descripcion}</td>
        <td>${fmt(c.subtotal)}</td>
        <td>${fmt(c.iva)}</td>
        <td><strong>${fmt(c.total)}</strong></td>
        <td><button class="btn btn-secondary btn-sm" onclick="verDetalleCompra(${c.id})">Ver</button></td>
      </tr>`;
    });
    if (!compras.length) tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--text-muted)">Sin compras registradas</td></tr>';
  } catch(e) { toast('Error: ' + e.message, 'error'); }
}

async function verDetalleCompra(id) {
  try {
    const c = await api.getDetalleCompra(id);
    document.getElementById('detalle-compra-titulo').textContent = 'Compra #' + c.id + ' - ' + c.proveedor;
    document.getElementById('detalle-compra-body').innerHTML = `
      <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:16px;font-size:.88rem">
        <div><strong>Proveedor:</strong> ${c.proveedor}</div>
        <div><strong>Fecha:</strong> ${c.fecha}</div>
        <div><strong>Descripcion:</strong> ${c.descripcion}</div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Insumo</th><th>Cantidad</th><th>P. Unitario</th><th>Subtotal</th></tr></thead>
          <tbody>
            ${c.items.map(i => `<tr>
              <td><strong>${i.insumo}</strong></td>
              <td>${i.cantidad} ${i.unidad}</td>
              <td>${fmt(i.precio_unitario)}</td>
              <td>${fmt(i.costo)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
      <div style="margin-top:16px;padding:12px 16px;background:var(--cream-mid);border-radius:8px">
        <div class="tot-row"><span>Subtotal</span><span>${fmt(c.subtotal)}</span></div>
        <div class="tot-row"><span>IVA (16%)</span><span>${fmt(c.iva)}</span></div>
        <div class="tot-row total"><span>Total</span><span>${fmt(c.total)}</span></div>
      </div>`;
    abrirModal('modal-detalle-compra');
  } catch(e) { toast('Error: ' + e.message, 'error'); }
}
