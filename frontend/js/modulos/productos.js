
// ============================================================
//  Módulo: productos.js
// ============================================================

// ── PRODUCTOS ────────────────────────────────────────────────
let _todosProductos = [];

async function loadProductos() {
  try {
    _todosProductos = await api.getProductos();
    const busqueda = document.getElementById('productos-busqueda')?.value || '';
    renderProductos(busqueda ? _todosProductos.filter(p =>
      p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      p.categoria.toLowerCase().includes(busqueda.toLowerCase())
    ) : _todosProductos);
  } catch(e) { toast('Error: ' + e.message, 'error'); }
}

async function filtrarProductos(texto) {
  if (!_todosProductos.length) {
    _todosProductos = await api.getProductos();
  }
  const filtrados = texto
    ? _todosProductos.filter(p =>
        p.nombre.toLowerCase().includes(texto.toLowerCase()) ||
        p.categoria.toLowerCase().includes(texto.toLowerCase()))
    : _todosProductos;
  renderProductos(filtrados);
}

function renderProductos(items) {
  try {
    const tbody = tbBody('tbl-productos');
    tbody.innerHTML = '';
    if (!items.length) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--text-muted)">Sin resultados</td></tr>';
      return;
    }
    items.forEach(p => {
      const badge = p.activo ? '<span class="badge badge-green">Activo</span>' : '<span class="badge badge-gray">Inactivo</span>';
      const stockBadge = (p.stock || 0) === 0 ? '<span class="badge badge-red">Sin stock</span>'
                       : (p.stock || 0) < 10 ? '<span class="badge badge-amber">' + p.stock + '</span>'
                       : '<span class="badge badge-green">' + p.stock + '</span>';
      tbody.innerHTML += `<tr>
        <td>${p.id}</td>
        <td><strong>${p.nombre}</strong></td>
        <td><span class="badge badge-amber">${p.categoria}</span></td>
        <td>${fmt(p.precio)}</td>
        <td>${p.tiempo_elaboracion} min</td>
        <td>${stockBadge}</td>
        <td>${badge}</td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick='editarProducto(${JSON.stringify(p)})'>✏️</button>
          <button class="btn btn-secondary btn-sm" onclick="toggleProducto(${p.id}, ${p.activo})">${p.activo ? '🚫' : '✅'}</button>
        </td>
      </tr>`;
    });
  } catch(e) { toast('Error renderizando productos: ' + e.message, 'error'); }
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