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
  const id_cliente = parseInt(document.getElementById('pos-cliente').value);
  try {
    const res = await api.procesarVenta({ id_empleado: usuario.id, id_cliente, carrito });
    toast(`✅ Venta #${res.id_venta} procesada — Total: ${fmt(res.total_neto)}`);
    carrito = [];
    renderCarrito();
    await buscarProductosPOS();
  } catch(e) { toast('Error: ' + e.message, 'error'); }
}
