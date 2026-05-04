// ============================================================
//  Módulo: pos.js
// ============================================================

// ── POS ─────────────────────────────────────────────────────
async function loadPOS() {
  try {
    const clientes = await api.getClientes();
    const sel = document.getElementById('pos-cliente');
    sel.innerHTML = clientes.map(c => `<option value="${c.id}" data-desc="${c.descuento}">${c.nombre}</option>`).join('');
    sel.addEventListener('change', recalcularTotales);
    await buscarProductosPOS();
  } catch(e) { toast('Error cargando POS: ' + e.message, 'error'); }
}

async function buscarProductosPOS() {
  const q = document.getElementById('pos-search')?.value || '';
  try {
    posProductos = await api.getProductosPOS(q);
    const grid = document.getElementById('pos-products');
    grid.innerHTML = '';
    if (!posProductos.length) {
      grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><div class="icon">🔍</div><p>No se encontraron productos</p></div>';
      return;
    }
    posProductos.forEach(p => {
      const div = document.createElement('div');
      div.className = 'product-card';
      div.innerHTML = `
        <div class="p-name">${p.nombre}</div>
        <div class="p-cat">${p.categoria}</div>
        <div class="p-price">${fmt(p.precio)}</div>
        <div class="p-stock">Stock: ${p.stock}</div>`;
      div.onclick = () => abrirModalCantidad(p);
      grid.appendChild(div);
    });
  } catch(e) { toast('Error buscando productos: ' + e.message, 'error'); }
}

function abrirModalCantidad(producto) {
  productoSeleccionado = producto;
  document.getElementById('modal-qty-title').textContent = producto.nombre;
  document.getElementById('qty-stock').textContent = `Stock disponible: ${producto.stock}`;
  document.getElementById('qty-input').value = 1;
  document.getElementById('qty-input').max = producto.stock;
  abrirModal('modal-qty');
  setTimeout(() => document.getElementById('qty-input').select(), 100);
}

function confirmarCantidad() {
  const qty = parseFloat(document.getElementById('qty-input').value);
  if (!qty || qty <= 0) return toast('Cantidad inválida', 'error');
  if (qty > productoSeleccionado.stock) return toast('Stock insuficiente', 'error');
  agregarAlCarrito(productoSeleccionado, qty);
  cerrarModal('modal-qty');
}

function agregarAlCarrito(p, qty) {
  const existing = carrito.find(i => i.id_producto === p.id);
  if (existing) {
    existing.cantidad += qty;
    existing.total_fila = existing.cantidad * existing.precio_unitario;
  } else {
    carrito.push({ id_producto: p.id, nombre: p.nombre, cantidad: qty, precio_unitario: p.precio, total_fila: qty * p.precio });
  }
  renderCarrito();
}

function renderCarrito() {
  const container = document.getElementById('carrito-items');
  if (!carrito.length) {
    container.innerHTML = '<div class="empty-state"><div class="icon">🛒</div><p>Agrega productos al carrito</p></div>';
    recalcularTotales();
    return;
  }
  container.innerHTML = carrito.map((item, i) => `
    <div class="carrito-item">
      <div class="ci-name">${item.nombre}</div>
      <input class="ci-qty" type="number" min="0.1" step="0.1" value="${item.cantidad}"
             onchange="cambiarCantidad(${i}, this.value)"/>
      <div class="ci-total">${fmt(item.total_fila)}</div>
      <button class="ci-del" onclick="quitarDelCarrito(${i})">✕</button>
    </div>`).join('');
  recalcularTotales();
}

function cambiarCantidad(i, val) {
  const qty = parseFloat(val);
  if (qty <= 0) { quitarDelCarrito(i); return; }
  carrito[i].cantidad  = qty;
  carrito[i].total_fila = qty * carrito[i].precio_unitario;
  recalcularTotales();
}

function quitarDelCarrito(i) {
  carrito.splice(i, 1);
  renderCarrito();
}

function recalcularTotales() {
  const sel = document.getElementById('pos-cliente');
  const opt = sel?.selectedOptions[0];
  const pct = parseFloat(opt?.dataset.desc || 0);
  clienteDescuento = pct;
  const sub  = carrito.reduce((a, i) => a + i.total_fila, 0);
  const desc = sub * (pct / 100);
  const iva  = (sub - desc) * 0.16;
  const tot  = sub - desc + iva;
  document.getElementById('tot-sub').textContent       = fmt(sub);
  document.getElementById('tot-desc-lbl').textContent  = `Descuento (${pct}%)`;
  document.getElementById('tot-desc').textContent      = `-${fmt(desc)}`;
  document.getElementById('tot-iva').textContent       = fmt(iva);
  document.getElementById('tot-total').textContent     = fmt(tot);
}

async function procesarVenta() {
  if (!carrito.length) return toast('El carrito está vacío', 'error');
  const id_cliente   = parseInt(document.getElementById('pos-cliente').value);
  const sel          = document.getElementById('pos-cliente');
  const clienteNombre = sel.selectedOptions[0]?.text || 'Cliente';
  try {
    const itemsTicket = [...carrito]; // guardar antes de limpiar
    const res = await api.procesarVenta({ id_empleado: usuario.id, id_cliente, carrito });
    // Guardar para imprimirTicket()
    _lastTicketItems   = itemsTicket;
    _lastTicketTotales = { subtotal: res.subtotal, descuento: res.descuento, iva: res.iva, total_neto: res.total_neto };

    // Registrar log de venta
    await registrarLog(
      'VENTA',
      'ventas',
      `Venta #${res.id_venta} — ${clienteNombre}`,
      `Total: $${res.total_neto.toFixed(2)}`
    );

    carrito = [];
    renderCarrito();
    await buscarProductosPOS();
    setTimeout(() => mostrarTicket(res, itemsTicket, clienteNombre), 100);
  } catch(e) { toast('Error: ' + e.message, 'error'); }
}

function mostrarTicket(res, items, clienteNombre) {
  const ahora = new Date();
  const fechaStr = ahora.toLocaleDateString('es-MX', { day:'2-digit', month:'short', year:'numeric' });
  const horaStr  = ahora.toLocaleTimeString('es-MX', { hour:'2-digit', minute:'2-digit' });

  document.getElementById('ticket-folio').textContent   = `Folio #${String(res.id_venta).padStart(4,'0')}`;
  document.getElementById('ticket-fecha').textContent   = `${fechaStr} ${horaStr}`;
  document.getElementById('ticket-cliente').textContent = clienteNombre;
  document.getElementById('ticket-cajero').textContent  = usuario.nombre;

  // Items
  const itemsEl = document.getElementById('ticket-items');
  itemsEl.innerHTML = items.map(i => `
    <div style="display:grid;grid-template-columns:1fr auto auto;gap:4px;padding:5px 0;border-bottom:1px dotted var(--border)">
      <div>
        <div style="font-weight:500">${i.nombre}</div>
        <div style="font-size:.75rem;color:var(--text-muted)">${fmt(i.precio_unitario)} c/u</div>
      </div>
      <div style="text-align:right;color:var(--text-muted)">${i.cantidad}</div>
      <div style="text-align:right;font-weight:600">${fmt(i.total_fila)}</div>
    </div>`).join('');

  // Totales
  const totEl = document.getElementById('ticket-totales');
  const filaTotal = (label, valor, bold = false, color = '') =>
    `<div style="display:flex;justify-content:space-between;padding:3px 0;${bold?'font-weight:700;font-size:1rem;':''}${color?'color:'+color+';':''}">
      <span>${label}</span><span>${valor}</span>
    </div>`;

  totEl.innerHTML =
    filaTotal('Subtotal', fmt(res.subtotal)) +
    (res.descuento > 0 ? filaTotal('Descuento', `-${fmt(res.descuento)}`, false, 'var(--success)') : '') +
    filaTotal('IVA (16%)', fmt(res.iva)) +
    filaTotal('TOTAL', fmt(res.total_neto), true, 'var(--brown)');

  abrirModal('modal-ticket');
}

function cerrarTicket() {
  cerrarModal('modal-ticket');
}

function imprimirTicket() {
  const folio     = document.getElementById('ticket-folio')?.textContent || '';
  const fechaHora = document.getElementById('ticket-fecha')?.textContent || '';
  const cliente   = document.getElementById('ticket-cliente')?.textContent || '';
  const cajero    = document.getElementById('ticket-cajero')?.textContent || '';
  const items     = _lastTicketItems   || [];
  const totales   = _lastTicketTotales || {};
  const fmtT = v => '$' + parseFloat(v || 0).toFixed(2);
  const numFolio  = folio.replace('Folio #', '').trim();

  const filas = items.map(i => `
    <tr>
      <td class="col-prod">${i.nombre}</td>
      <td class="col-qty">${i.cantidad}</td>
      <td class="col-pu">${fmtT(i.precio_unitario)}</td>
      <td class="col-tot">${fmtT(i.total_fila)}</td>
    </tr>`).join('');

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>TicketVenta-${numFolio}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    font-family: 'Courier New', monospace;
    font-size: 11.5px; color: #111; background: #fff;
    width: 72mm; padding: 6px 8px 24px; margin: 0 auto;
  }
  .logo { text-align:center; padding-bottom:8px; border-bottom:2px dashed #333; margin-bottom:8px; }
  .logo-icon   { font-size:28px; line-height:1; }
  .logo-nombre { font-size:15px; font-weight:bold; letter-spacing:3px; text-transform:uppercase; margin:2px 0 1px; }
  .logo-sub    { font-size:9px; letter-spacing:1px; color:#555; }
  .ticket-titulo { text-align:center; font-size:12px; font-weight:bold; text-transform:uppercase; letter-spacing:1px; margin:6px 0 2px; }
  .ticket-num    { text-align:center; font-size:18px; font-weight:bold; letter-spacing:2px; margin-bottom:8px; }
  .info-row   { display:flex; justify-content:space-between; font-size:10.5px; margin:2px 0; }
  .info-label { color:#666; }
  .info-val   { text-align:right; max-width:42mm; word-break:break-word; }
  .sep { border:none; border-top:1px dashed #aaa; margin:7px 0; }
  .sec-title { font-size:9px; text-transform:uppercase; letter-spacing:1px; color:#555; margin-bottom:4px; }
  table { width:100%; border-collapse:collapse; }
  thead tr { border-bottom:1px solid #333; }
  th { font-size:9px; text-transform:uppercase; padding:2px 0; font-weight:bold; }
  td { padding:3px 0; font-size:11px; border-bottom:1px dotted #ddd; vertical-align:top; }
  .col-prod { width:38%; }
  .col-qty  { width:12%; text-align:center; }
  .col-pu   { width:24%; text-align:right; }
  .col-tot  { width:26%; text-align:right; }
  th.col-qty { text-align:center; }
  th.col-pu, th.col-tot { text-align:right; }
  .totales  { margin-top:8px; }
  .tot-row  { display:flex; justify-content:space-between; font-size:11px; margin:2px 0; }
  .tot-desc { color:#2a7a2a; }
  .tot-final { font-size:15px; font-weight:bold; border-top:2px solid #333; padding-top:5px; margin-top:5px; }
  .nota   { display:flex; justify-content:space-between; font-size:9.5px; color:#555; margin-top:6px; }
  .footer { text-align:center; font-size:9px; color:#888; margin-top:12px; border-top:1px dashed #bbb; padding-top:8px; line-height:1.6; }
  @media print { body { width:72mm; } @page { margin:0; size:72mm auto; } }
</style>
</head>
<body>
<div class="logo">
  <div class="logo-icon">🥖</div>
  <div class="logo-nombre">Panadería</div>
  <div class="logo-sub">ERP · Sistema de Gestión</div>
</div>
<div class="ticket-titulo">Ticket de Venta</div>
<div class="ticket-num">${folio}</div>
<hr class="sep">
<div class="info-row"><span class="info-label">Fecha</span><span class="info-val">${fechaHora}</span></div>
<div class="info-row"><span class="info-label">Cliente</span><span class="info-val"><strong>${cliente}</strong></span></div>
<div class="info-row"><span class="info-label">Cajero</span><span class="info-val">${cajero}</span></div>
<hr class="sep">
<div class="sec-title">Productos</div>
<table>
  <thead>
    <tr>
      <th class="col-prod">Producto</th>
      <th class="col-qty">Cant.</th>
      <th class="col-pu">P.Unit</th>
      <th class="col-tot">Total</th>
    </tr>
  </thead>
  <tbody>${filas}</tbody>
</table>
<div class="totales">
  <div class="tot-row"><span>Subtotal</span><span>${fmtT(totales.subtotal)}</span></div>
  ${(totales.descuento > 0) ? `<div class="tot-row tot-desc"><span>Descuento</span><span>-${fmtT(totales.descuento)}</span></div>` : ''}
  <div class="tot-row"><span>IVA (16%)</span><span>${fmtT(totales.iva)}</span></div>
  <div class="tot-row tot-final"><span>TOTAL</span><span>${fmtT(totales.total_neto)}</span></div>
</div>
<hr class="sep">
<div class="nota"><span>¡Gracias por su compra!</span><span>🙂</span></div>
<div class="footer">
  Emitido: ${new Date().toLocaleString('es-MX')}<br>
  ERP Panadería — Caja
</div>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=420,height=650,menubar=no,toolbar=no');
  if (!win) { toast('Activa las ventanas emergentes para imprimir', 'error'); return; }
  win.document.title = `TicketVenta-${numFolio}`;
  win.document.write(html);
  win.document.close();
  win.onload = () => setTimeout(() => {
    win.print();
    win.onafterprint = () => win.close();
  }, 250);
}
// Variables globales para ticket
let _lastTicketItems   = [];
let _lastTicketTotales = {};
