// ============================================================
//  Módulo: recetas.js
// ============================================================

// ── RECETAS ──────────────────────────────────────────────────
let _todasRecetas = [];

async function loadRecetas() {
  try {
    _todasRecetas = await api.getRecetas();
    renderRecetas(_todasRecetas);
  } catch(e) { toast('Error cargando recetas: ' + e.message, 'error'); }
}

function filtrarRecetas(texto) {
  if (!texto) { renderRecetas(_todasRecetas); return; }
  const q = texto.toLowerCase();
  const filtradas = _todasRecetas.filter(r =>
    r.nombre_receta.toLowerCase().includes(q) ||
    r.producto.toLowerCase().includes(q) ||
    r.categoria.toLowerCase().includes(q)
  );
  renderRecetas(filtradas);
}

function renderRecetas(recetas) {
  try {
    const cont = document.getElementById('recetas-lista');
    cont.innerHTML = '';

    if (!recetas.length) {
      cont.innerHTML = '<div class="empty-state"><div class="icon">📋</div><p>No hay recetas registradas. Crea la primera.</p></div>';
      return;
    }

    // Agrupar por categoría
    const grupos = {};
    recetas.forEach(r => {
      if (!grupos[r.categoria]) grupos[r.categoria] = [];
      grupos[r.categoria].push(r);
    });

    Object.entries(grupos).forEach(([cat, lista]) => {
      const seccion = document.createElement('div');
      seccion.style.marginBottom = '28px';
      seccion.innerHTML = `<h3 style="font-size:1rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:12px">${cat}</h3>`;

      lista.forEach(r => {
        const card = document.createElement('div');
        card.className = 'card';
        card.style.marginBottom = '16px';
        card.innerHTML = `
          <div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:16px">
            <div>
              <div style="font-size:1.05rem;font-weight:700">${r.nombre_receta}</div>
              <div style="font-size:.83rem;color:var(--text-muted);margin-top:2px">${r.producto} · ${r.descripcion} · ${r.tiempo_estimado} min</div>
            </div>
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
              <div style="text-align:right">
                <div style="font-size:.75rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em">Costo unitario</div>
                <div style="font-size:1.3rem;font-weight:700;color:var(--amber-dark)">${fmt(r.costo_unitario)}</div>
                <div style="font-size:.73rem;color:var(--text-muted)">por pieza (base: ${r.rendimiento_base} pzas)</div>
              </div>
              <div style="display:flex;flex-direction:column;gap:4px">
                <button class="btn btn-secondary btn-sm" onclick="editarReceta(${JSON.stringify(r).replace(/"/g,'&quot;')})">✏️ Editar</button>
                <button class="btn btn-primary btn-sm" onclick="abrirAgregarInsumo(${r.id})">+ Insumo</button>
                <button class="btn btn-danger btn-sm" onclick="eliminarReceta(${r.id})">🗑️</button>
              </div>
            </div>
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Insumo</th><th>Cantidad</th><th>Unidad</th><th>Costo unit.</th><th>Subtotal</th><th></th></tr></thead>
              <tbody>
                ${r.insumos.map(i => `<tr>
                  <td><strong>${i.nombre}</strong></td>
                  <td>
                    <input type="number" value="${i.cantidad}" step="0.001" min="0.001"
                      style="width:80px;padding:4px 8px;border:1.5px solid var(--border);border-radius:6px;font-size:.85rem"
                      onchange="actualizarCantidadInsumo(${r.id}, ${i.id_detalle}, ${i.id_inventario}, this.value, this)"
                    />
                  </td>
                  <td>${i.unidad}</td>
                  <td>${fmt(i.costo_unitario)}</td>
                  <td><strong>${fmt(i.subtotal)}</strong></td>
                  <td><button class="btn btn-danger btn-sm" onclick="eliminarInsumoDeReceta(${r.id}, ${i.id_detalle})">✕</button></td>
                </tr>`).join('')}
                <tr style="background:var(--cream-mid)">
                  <td colspan="4" style="text-align:right;font-weight:600">Costo total lote (${r.rendimiento_base} pzas):</td>
                  <td colspan="2"><strong>${fmt(r.costo_unitario * r.rendimiento_base)}</strong></td>
                </tr>
              </tbody>
            </table>
          </div>`;
        seccion.appendChild(card);
      });
      cont.appendChild(seccion);
    });
  } catch(e) { toast('Error al renderizar recetas: ' + e.message, 'error'); }
}

async function abrirModalReceta() {
  document.getElementById('modal-receta-titulo').textContent = 'Nueva Receta';
  document.getElementById('receta-id').value = '';
  document.getElementById('receta-nombre').value = '';
  document.getElementById('receta-descripcion').value = '';
  document.getElementById('receta-tiempo').value = '';
  document.getElementById('receta-rendimiento').value = '10';
  try {
    const prods = await api.getProductos(1);
    document.getElementById('receta-producto').innerHTML =
      prods.map(p => `<option value="${p.id}">${p.nombre} (${p.categoria})</option>`).join('');
  } catch(e) {}
  abrirModal('modal-receta');
}

async function editarReceta(r) {
  document.getElementById('modal-receta-titulo').textContent = 'Editar Receta';
  document.getElementById('receta-id').value          = r.id;
  document.getElementById('receta-nombre').value      = r.nombre_receta;
  document.getElementById('receta-descripcion').value = r.descripcion;
  document.getElementById('receta-tiempo').value      = r.tiempo_estimado;
  document.getElementById('receta-rendimiento').value = r.rendimiento_base;
  try {
    const prods = await api.getProductos();
    document.getElementById('receta-producto').innerHTML =
      prods.map(p => `<option value="${p.id}" ${p.id == r.id_producto ? 'selected' : ''}>${p.nombre} (${p.categoria})</option>`).join('');
  } catch(e) {}
  abrirModal('modal-receta');
}

async function guardarReceta() {
  const id          = document.getElementById('receta-id').value;
  const id_producto = parseInt(document.getElementById('receta-producto').value);
  const nombre      = document.getElementById('receta-nombre').value.trim();
  const desc        = document.getElementById('receta-descripcion').value.trim();
  const tiempo      = parseInt(document.getElementById('receta-tiempo').value);
  const rendimiento = parseInt(document.getElementById('receta-rendimiento').value);
  if (!nombre || !tiempo || !rendimiento) return toast('Completa todos los campos', 'error');
  try {
    if (id) {
      await api.actualizarReceta(id, { nombre_receta: nombre, descripcion: desc, tiempo_estimado: tiempo, rendimiento_base: rendimiento });
      toast('Receta actualizada');
    } else {
      const res = await api.crearReceta({ id_producto, nombre_receta: nombre, descripcion: desc, tiempo_estimado: tiempo, rendimiento_base: rendimiento, insumos: [] });
      toast('Receta creada. Ahora agrega los insumos.');
    }
    cerrarModal('modal-receta');
    loadRecetas();
  } catch(e) { toast('Error: ' + e.message, 'error'); }
}

let _todosInsumosReceta = [];

async function abrirAgregarInsumo(id_receta) {
  document.getElementById('ir-receta-id').value  = id_receta;
  document.getElementById('ir-detalle-id').value = '';
  document.getElementById('ir-cantidad').value   = '';
  document.getElementById('ir-busqueda').value   = '';
  try {
    _todosInsumosReceta = await api.getInventario();
    renderInsumosModal(_todosInsumosReceta);
    actualizarUnidadLabel();
  } catch(e) {}
  abrirModal('modal-insumo-receta');
}

function filtrarInsumosModal(texto) {
  if (!texto) { renderInsumosModal(_todosInsumosReceta); return; }
  const q = texto.toLowerCase();
  const filtrados = _todosInsumosReceta.filter(i =>
    i.nombre.toLowerCase().includes(q) ||
    i.unidad.toLowerCase().includes(q)
  );
  renderInsumosModal(filtrados);
}

function renderInsumosModal(insumos) {
  const sel = document.getElementById('ir-insumo');
  sel.innerHTML = insumos.length
    ? insumos.map(i => `<option value="${i.id}" data-unidad="${i.unidad}">${i.nombre} (${i.unidad})</option>`).join('')
    : '<option value="">Sin resultados</option>';
  actualizarUnidadLabel();
}

function actualizarUnidadLabel() {
  const sel = document.getElementById('ir-insumo');
  const opt = sel.selectedOptions[0];
  document.getElementById('ir-unidad-label').textContent = opt ? `(${opt.dataset.unidad})` : '';
}

async function guardarInsumoReceta() {
  const id_receta    = parseInt(document.getElementById('ir-receta-id').value);
  const id_detalle   = document.getElementById('ir-detalle-id').value;
  const id_inventario = parseInt(document.getElementById('ir-insumo').value);
  const cantidad     = parseFloat(document.getElementById('ir-cantidad').value);
  if (!cantidad || cantidad <= 0) return toast('Ingresa una cantidad válida', 'error');
  try {
    if (id_detalle) {
      await api.actualizarInsumoReceta(id_receta, id_detalle, { id_inventario, cantidad_unidad: cantidad });
      toast('Insumo actualizado');
    } else {
      await api.agregarInsumoReceta(id_receta, { id_inventario, cantidad_unidad: cantidad });
      toast('Insumo agregado');
    }
    cerrarModal('modal-insumo-receta');
    loadRecetas();
  } catch(e) { toast('Error: ' + e.message, 'error'); }
}

async function actualizarCantidadInsumo(id_receta, id_detalle, id_inventario, cantidad, el) {
  try {
    await api.actualizarInsumoReceta(id_receta, id_detalle, { id_inventario, cantidad_unidad: parseFloat(cantidad) });
    toast('Cantidad actualizada');
    loadRecetas();
  } catch(e) { toast('Error: ' + e.message, 'error'); }
}

async function eliminarInsumoDeReceta(id_receta, id_detalle) {
  confirmarAccion(
    'Quitar insumo',
    'Se eliminara este insumo de la receta. El costo unitario se recalculara.',
    async () => {
      try {
        await api.eliminarInsumoReceta(id_receta, id_detalle);
        toast('Insumo eliminado de la receta');
        loadRecetas();
      } catch(e) { toast('Error: ' + e.message, 'error'); }
    }
  );
}

async function eliminarReceta(id) {
  confirmarAccion(
    'Eliminar receta',
    'Se eliminara la receta y todos sus insumos. Esta accion no se puede deshacer.',
    async () => {
      try {
        await api.eliminarReceta(id);
        toast('Receta eliminada');
        loadRecetas();
      } catch(e) { toast('Error: ' + e.message, 'error'); }
    }
  );
}

// ── PROVEEDORES ───────────────────────────────────────────────