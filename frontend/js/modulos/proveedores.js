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
  document.getElementById('compra-preview').style.display = 'none';
  document.getElementById('compra-item-insumo').onchange = () => {
    actualizarUnidadesCompra();
    actualizarPreviewCompra();
  };
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

// Conversiones disponibles por unidad de inventario
const CONVERSIONES = {
  'g':        [{ label: 'gramos (g)',    factor: 1 },
               { label: 'kilogramos (kg)', factor: 1000 },
               { label: 'libras (lb)',   factor: 453.59 }],
  'ml':       [{ label: 'mililitros (ml)', factor: 1 },
               { label: 'litros (l)',    factor: 1000 }],
  'kg':       [{ label: 'kilogramos (kg)', factor: 1 }],
  'litros':   [{ label: 'litros (l)',    factor: 1 }],
  'Pieza':    [{ label: 'piezas',        factor: 1 }],
  'pza':      [{ label: 'piezas',        factor: 1 }],
  'unidades': [{ label: 'unidades',      factor: 1 }],
  'lata':     [{ label: 'latas',         factor: 1 }],
};

function renderInsumosCompra(insumos) {
  document.getElementById('compra-item-insumo').innerHTML =
    insumos.map(i => `<option value="${i.id}" data-nombre="${i.nombre}" data-unidad="${i.unidad}">${i.nombre} (${i.unidad})</option>`).join('');
  actualizarUnidadesCompra();
  actualizarPreviewCompra();
}

function actualizarUnidadesCompra() {
  const sel   = document.getElementById('compra-item-insumo');
  const opt   = sel?.selectedOptions[0];
  const unidad = opt?.dataset.unidad || '';
  const selU  = document.getElementById('compra-item-unidad');
  const conversiones = CONVERSIONES[unidad] || [{ label: unidad || 'unidad', factor: 1 }];
  selU.innerHTML = conversiones.map(c =>
    `<option value="${c.factor}">${c.label}</option>`
  ).join('');
  actualizarPreviewCompra();
}

function actualizarPreviewCompra() {
  const sel      = document.getElementById('compra-item-insumo');
  const opt      = sel?.selectedOptions[0];
  const cantidad = parseFloat(document.getElementById('compra-item-cantidad').value) || 0;
  const precio   = parseFloat(document.getElementById('compra-item-precio').value) || 0;
  const factor   = parseInt(document.getElementById('compra-item-unidad').value) || 1;
  const preview  = document.getElementById('compra-preview');

  if (!opt || !cantidad || !precio) { preview.style.display = 'none'; return; }

  const cantInventario = cantidad * factor;
  const subtotal       = cantidad * precio;
  const costoUnit      = precio / factor; // costo por unidad de inventario

  preview.style.display = 'block';
  preview.innerHTML = `
    <strong>${opt.dataset.nombre}</strong>: compras <strong>${cantidad}</strong> unidad(es) →
    se agregarán <strong>${cantInventario} ${opt.dataset.unidad}</strong> al inventario &nbsp;|&nbsp;
    Costo unitario en inventario: <strong>$${costoUnit.toFixed(4)}/${opt.dataset.unidad}</strong> &nbsp;|&nbsp;
    Subtotal: <strong>$${subtotal.toFixed(2)}</strong>
  `;
}

function agregarItemCompra() {
  const sel      = document.getElementById('compra-item-insumo');
  const opt      = sel.selectedOptions[0];
  const cantidad = parseFloat(document.getElementById('compra-item-cantidad').value);
  const precio   = parseFloat(document.getElementById('compra-item-precio').value);
  const factor   = parseInt(document.getElementById('compra-item-unidad').value) || 1;

  if (!opt || !cantidad || !precio || cantidad <= 0 || precio <= 0)
    return toast('Selecciona un insumo e ingresa cantidad y precio', 'error');

  const id_inventario  = parseInt(opt.value);
  const cantInventario = cantidad * factor;             // lo que entra al stock
  const costoUnit      = precio / factor;               // costo por unidad de inventario

  const existing = _itemsCompra.find(i => i.id_inventario === id_inventario);
  if (existing) {
    existing.cantidad_compra  += cantidad;
    existing.cantidad         += cantInventario;
  } else {
    _itemsCompra.push({
      id_inventario,
      nombre:           opt.dataset.nombre,
      unidad:           opt.dataset.unidad,
      cantidad_compra:  cantidad,               // unidades compradas (ej: 2 kg)
      cantidad:         cantInventario,          // lo que entra al inventario (ej: 2000 g)
      precio:           costoUnit,               // costo por unidad de inventario
      precio_compra:    precio,                  // precio pagado por unidad de compra
      factor
    });
  }
  document.getElementById('compra-item-cantidad').value = '';
  document.getElementById('compra-item-precio').value   = '';
  document.getElementById('compra-preview').style.display = 'none';
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
    <td>
      <strong>${i.nombre}</strong><br>
      <span style="font-size:.75rem;color:var(--text-muted)">
        ${i.cantidad_compra} unid. compradas → ${i.cantidad} ${i.unidad} al inventario
      </span>
    </td>
    <td>${fmt(i.precio_compra)} / unid. compra</td>
    <td>${fmt(i.precio)} / ${i.unidad}</td>
    <td><strong>${fmt(i.cantidad_compra * i.precio_compra)}</strong></td>
    <td><button class="btn btn-danger btn-sm" onclick="quitarItemCompra(${idx})">✕</button></td>
  </tr>`).join('');
}

function recalcularCompra() {
  const sub   = _itemsCompra.reduce((a, i) => a + i.cantidad_compra * i.precio_compra, 0);
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

  // Capturar datos del formulario antes del confirm (el modal puede limpiarlos)
  const provSel    = document.getElementById('compra-proveedor');
  const provNombre = provSel?.selectedOptions[0]?.text || 'Proveedor';
  const itemsSnap  = _itemsCompra.map(i => ({ ...i })); // copia

  confirmarAccion(
    'Registrar compra',
    'Se registrara la compra y se actualizara el stock e inventario de los insumos. Esta accion no se puede deshacer.',
    async () => {
      try {
        const res = await api.registrarCompra({
          id_proveedor, fecha, descripcion,
          items: itemsSnap.map(i => ({ id_inventario: i.id_inventario, cantidad: i.cantidad, precio: i.precio }))
        });
        toast('Compra #' + res.id_compra + ' registrada. Total: ' + fmt(res.total));

        // ── Generar ticket PDF automáticamente ──────────────────
        generarTicketCompra({
          id_compra:   res.id_compra,
          proveedor:   provNombre,
          descripcion: descripcion,
          fecha:       fecha,
          items: itemsSnap.map(i => ({
            insumo:          i.nombre,
            cantidad:        i.cantidad_compra,
            unidad_compra:   i.unidad,
            cantidad_inv:    i.cantidad,
            unidad_inv:      i.unidad,
            precio_unitario: i.precio_compra,
            subtotal:        i.cantidad_compra * i.precio_compra
          })),
          subtotal: res.subtotal,
          iva:      res.iva,
          total:    res.total
        });
        // ────────────────────────────────────────────────────────

        _itemsCompra = [];
        renderItemsCompra();
        recalcularCompra();
        document.getElementById('compra-descripcion').value = '';
      } catch(e) { toast('Error: ' + e.message, 'error'); }
    }
  );
}

// ── GENERADOR DE TICKET PDF ───────────────────────────────────
function generarTicketCompra(compra) {
  const fmtT = v => '$' + parseFloat(v).toFixed(2);
  const fecha = new Date(compra.fecha + 'T12:00:00').toLocaleDateString('es-MX', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
  const numTicket = String(compra.id_compra).padStart(6, '0');

  const filas = compra.items.map(i => `
    <tr>
      <td class="col-insumo">${i.insumo}</td>
      <td class="col-cant">${i.cantidad} u.</td>
      <td class="col-precio">${fmtT(i.precio_unitario)}</td>
      <td class="col-sub">${fmtT(i.subtotal)}</td>
    </tr>`).join('');

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>TicketCompra-${numTicket}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    font-family: 'Courier New', monospace;
    font-size: 11.5px;
    color: #111;
    background: #fff;
    width: 72mm;
    padding: 6px 8px 24px;
    margin: 0 auto;
  }
  /* ── Encabezado ── */
  .logo {
    text-align: center;
    padding-bottom: 8px;
    border-bottom: 2px dashed #333;
    margin-bottom: 8px;
  }
  .logo-icon { font-size: 28px; line-height: 1; }
  .logo-nombre {
    font-size: 15px;
    font-weight: bold;
    letter-spacing: 3px;
    text-transform: uppercase;
    margin: 2px 0 1px;
  }
  .logo-sub { font-size: 9px; letter-spacing: 1px; color: #555; }
  /* ── Titulo ticket ── */
  .ticket-titulo {
    text-align: center;
    font-size: 12px;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin: 6px 0 2px;
  }
  .ticket-num {
    text-align: center;
    font-size: 18px;
    font-weight: bold;
    letter-spacing: 2px;
    margin-bottom: 8px;
  }
  /* ── Info compra ── */
  .info-row {
    display: flex;
    justify-content: space-between;
    font-size: 10.5px;
    margin: 2px 0;
  }
  .info-label { color: #666; }
  .info-val { text-align: right; max-width: 42mm; word-break: break-word; }
  /* ── Separador ── */
  .sep { border: none; border-top: 1px dashed #aaa; margin: 7px 0; }
  /* ── Tabla insumos ── */
  .sec-title {
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #555;
    margin-bottom: 4px;
  }
  table { width: 100%; border-collapse: collapse; }
  thead tr { border-bottom: 1px solid #333; }
  th {
    font-size: 9px;
    text-transform: uppercase;
    padding: 2px 0;
    font-weight: bold;
  }
  td { padding: 3px 0; font-size: 11px; border-bottom: 1px dotted #ddd; vertical-align: top; }
  .col-insumo { width: 36%; }
  .col-cant   { width: 18%; text-align: center; }
  .col-precio { width: 22%; text-align: right; }
  .col-sub    { width: 24%; text-align: right; }
  th.col-cant, th.col-precio, th.col-sub { text-align: right; }
  th.col-cant { text-align: center; }
  /* ── Totales ── */
  .totales { margin-top: 8px; }
  .tot-row {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    margin: 2px 0;
  }
  .tot-row.total-final {
    font-size: 15px;
    font-weight: bold;
    border-top: 2px solid #333;
    padding-top: 5px;
    margin-top: 5px;
  }
  /* ── Footer ── */
  .nota {
    display: flex;
    justify-content: space-between;
    font-size: 9.5px;
    color: #555;
    margin-top: 6px;
  }
  .footer {
    text-align: center;
    font-size: 9px;
    color: #888;
    margin-top: 12px;
    border-top: 1px dashed #bbb;
    padding-top: 8px;
    line-height: 1.6;
  }
  @media print {
    body { width: 72mm; }
    @page { margin: 0; size: 72mm auto; }
  }
</style>
</head>
<body>

<div class="logo">
  <div class="logo-icon">🥖</div>
  <div class="logo-nombre">Panadería</div>
  <div class="logo-sub">ERP · Sistema de Gestión</div>
</div>

<div class="ticket-titulo">Orden de Compra</div>
<div class="ticket-num"># ${numTicket}</div>

<hr class="sep">

<div class="info-row">
  <span class="info-label">Fecha</span>
  <span class="info-val">${fecha}</span>
</div>
<div class="info-row">
  <span class="info-label">Proveedor</span>
  <span class="info-val"><strong>${compra.proveedor}</strong></span>
</div>
${compra.descripcion ? `<div class="info-row">
  <span class="info-label">Referencia</span>
  <span class="info-val">${compra.descripcion}</span>
</div>` : ''}

<hr class="sep">
<div class="sec-title">Insumos adquiridos</div>

<table>
  <thead>
    <tr>
      <th class="col-insumo">Insumo</th>
      <th class="col-cant">Cant.</th>
      <th class="col-precio">P.Unit</th>
      <th class="col-sub">Total</th>
    </tr>
  </thead>
  <tbody>${filas}</tbody>
</table>

<div class="totales">
  <div class="tot-row"><span>Subtotal</span><span>${fmtT(compra.subtotal)}</span></div>
  <div class="tot-row"><span>IVA (16%)</span><span>${fmtT(compra.iva)}</span></div>
  <div class="tot-row total-final"><span>TOTAL</span><span>${fmtT(compra.total)}</span></div>
</div>

<hr class="sep">
<div class="nota">
  <span>Inventario actualizado</span><span>✓</span>
</div>

<div class="footer">
  Emitido: ${new Date().toLocaleString('es-MX')}<br>
  ERP Panadería — Gestión de Compras
</div>

</body>
</html>`;

  const win = window.open('', '_blank', 'width=420,height=650,menubar=no,toolbar=no');
  if (!win) { toast('Activa las ventanas emergentes para generar el ticket', 'error'); return; }
  win.document.write(html);
  win.document.close();
  win.onload = () => setTimeout(() => {
    win.print();
    win.onafterprint = () => win.close();
  }, 250);
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
        <td style="display:flex;gap:4px">
          <button class="btn btn-secondary btn-sm" onclick="verDetalleCompra(${c.id})">Ver</button>
          <button class="btn btn-secondary btn-sm" onclick="reimprimirTicket(${c.id})" title="Reimprimir ticket">🖨️</button>
        </td>
      </tr>`;
    });
    if (!compras.length) tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--text-muted)">Sin compras registradas</td></tr>';
  } catch(e) { toast('Error: ' + e.message, 'error'); }
}

async function reimprimirTicket(id) {
  try {
    const c = await api.getDetalleCompra(id);
    generarTicketCompra({
      id_compra:   c.id,
      proveedor:   c.proveedor,
      descripcion: c.descripcion,
      fecha:       c.fecha,
      items: c.items.map(i => ({
        insumo:          i.insumo,
        cantidad:        i.cantidad,
        precio_unitario: i.precio_unitario,
        subtotal:        i.costo
      })),
      subtotal: c.subtotal,
      iva:      c.iva,
      total:    c.total
    });
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
