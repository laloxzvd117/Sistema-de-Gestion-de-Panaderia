// ============================================================
//  frontend/js/api.js  — Helper centralizado para llamadas API
// ============================================================

const BASE = `http://${window.location.hostname}:8000/api`;

async function apiFetch(path, options = {}) {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || `Error ${res.status}`);
  return data;
}

const api = {
  // Auth
  login: (telefono, password) =>
    apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ telefono, password }) }),

  // Inventario
  getInventario: () => apiFetch('/inventario/'),
  crearInsumo: (d) => apiFetch('/inventario/', { method: 'POST', body: JSON.stringify(d) }),
  actualizarInsumo: (id, d) => apiFetch(`/inventario/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
  eliminarInsumo: (id) => apiFetch(`/inventario/${id}`, { method: 'DELETE' }),

  // Empleados
  getEmpleados: () => apiFetch('/empleados/'),
  getCargos: () => apiFetch('/empleados/cargos'),
  crearEmpleado: (d) => apiFetch('/empleados/', { method: 'POST', body: JSON.stringify(d) }),
  darBajaEmpleado: (id, motivo) => apiFetch(`/empleados/${id}/baja`, { method: 'PATCH', body: JSON.stringify({ motivo_baja: motivo }) }),

  // Productos
  getProductos: (activo) => apiFetch('/productos/' + (activo !== undefined ? `?activo=${activo}` : '')),
  crearProducto: (d) => apiFetch('/productos/', { method: 'POST', body: JSON.stringify(d) }),
  actualizarProducto: (id, d) => apiFetch(`/productos/${id}`, { method: 'PUT', body: JSON.stringify(d) }),

  // Ventas / POS
  getClientes: () => apiFetch('/ventas/clientes'),
  getProductosPOS: (busqueda = '') => apiFetch(`/ventas/productos-pos?busqueda=${encodeURIComponent(busqueda)}`),
  procesarVenta: (d) => apiFetch('/ventas/procesar', { method: 'POST', body: JSON.stringify(d) }),
  getHistorialVentas: () => apiFetch('/ventas/historial'),

  // Producción
  generarLote: (d) => apiFetch('/produccion/lote', { method: 'POST', body: JSON.stringify(d) }),
  getHistorialProduccion: () => apiFetch('/produccion/historial'),

  // Reportes
  getKPIs: () => apiFetch('/reportes/dashboard-kpis'),
  getReporteVolumen: (fi, ff) => apiFetch(`/reportes/volumen?fecha_inicio=${fi}&fecha_fin=${ff}`),
  getReporteRentabilidad: (fi, ff) => apiFetch(`/reportes/rentabilidad?fecha_inicio=${fi}&fecha_fin=${ff}`),
  getReporteMermas: () => apiFetch('/reportes/mermas'),
};

// Empleados - métodos adicionales
api.actualizarEmpleado = (id, d) => apiFetch(`/empleados/${id}`, { method: 'PUT', body: JSON.stringify(d) });
api.cambiarPassword    = (id, pwd) => apiFetch(`/empleados/${id}/password`, { method: 'PATCH', body: JSON.stringify({ nueva_password: pwd }) });
api.reactivarEmpleado  = (id) => apiFetch(`/empleados/${id}/reactivar`, { method: 'PATCH' });

// Producción - métodos adicionales
api.getRecetaProducto  = (id, qty) => apiFetch(`/produccion/receta/${id}?cantidad=${qty || 10}`);
api.planificarLote     = (d)  => apiFetch('/produccion/planificar', { method: 'POST', body: JSON.stringify(d) });
api.registrarLote      = (d)  => apiFetch('/produccion/registrar',  { method: 'POST', body: JSON.stringify(d) });
api.getLotesPendientes = (q)  => apiFetch(`/produccion/lotes-pendientes${q ? '?busqueda='+encodeURIComponent(q) : ''}`);

// Recetas
api.getRecetas           = ()        => apiFetch('/recetas/');
api.getReceta            = (id)      => apiFetch(`/recetas/${id}`);
api.crearReceta          = (d)       => apiFetch('/recetas/', { method: 'POST', body: JSON.stringify(d) });
api.actualizarReceta     = (id, d)   => apiFetch(`/recetas/${id}`, { method: 'PUT', body: JSON.stringify(d) });
api.eliminarReceta       = (id)      => apiFetch(`/recetas/${id}`, { method: 'DELETE' });
api.agregarInsumoReceta  = (id, d)   => apiFetch(`/recetas/${id}/insumos`, { method: 'POST', body: JSON.stringify(d) });
api.actualizarInsumoReceta = (id, det, d) => apiFetch(`/recetas/${id}/insumos/${det}`, { method: 'PUT', body: JSON.stringify(d) });
api.eliminarInsumoReceta = (id, det) => apiFetch(`/recetas/${id}/insumos/${det}`, { method: 'DELETE' });

// Proveedores
api.getProveedores    = ()      => apiFetch('/proveedores/');
api.crearProveedor    = (d)     => apiFetch('/proveedores/', { method: 'POST', body: JSON.stringify(d) });
api.actualizarProv    = (id, d) => apiFetch(`/proveedores/${id}`, { method: 'PUT', body: JSON.stringify(d) });
api.eliminarProv      = (id)    => apiFetch(`/proveedores/${id}`, { method: 'DELETE' });
api.getCompras        = ()      => apiFetch('/proveedores/compras');
api.getDetalleCompra  = (id)    => apiFetch(`/proveedores/compras/${id}`);
api.registrarCompra   = (d)     => apiFetch('/proveedores/compras', { method: 'POST', body: JSON.stringify(d) });
api.getVentasSemana = () => apiFetch("/reportes/ventas-semana");
// Logs
api.getLogs        = (params) => apiFetch('/logs/?' + new URLSearchParams(params || {}).toString());
api.getResumenLogs = ()       => apiFetch('/logs/resumen');
api.registrarLog   = (d)      => apiFetch('/logs/', { method: 'POST', body: JSON.stringify(d) });
