// ============================================================
//  app.js — Core: estado global, utils, login, navegación
// ============================================================

// ============================================================
//  frontend/js/app.js  — Lógica completa del ERP
// ============================================================

// ── Estado global ──────────────────────────────────────────
let usuario   = null;
let carrito   = [];
let posProductos = [];
let clienteDescuento = 0;
let productoSeleccionado = null; // para modal POS

// ── Utils ───────────────────────────────────────────────────
function toast(msg, tipo = 'success') {
  const t = document.createElement('div');
  t.className = `toast toast-${tipo}`;
  t.textContent = msg;
  document.getElementById('toast-container').appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

function fmt(n) { return '$' + parseFloat(n).toLocaleString('es-MX', { minimumFractionDigits: 2 }); }

function cerrarModal(id) { document.getElementById(id).style.display = 'none'; }

function abrirModal(id) { document.getElementById(id).style.display = 'flex'; }

function tbBody(id) { return document.querySelector(`#${id} tbody`); }

// ── Login / Logout ──────────────────────────────────────────
async function doLogin() {
  const tel  = document.getElementById('inp-tel').value.trim();
  const pass = document.getElementById('inp-pass').value;
  if (!tel || !pass) return toast('Ingresa usuario y contraseña', 'error');
  const btn = document.getElementById('btn-login');
  btn.disabled = true; btn.textContent = 'Ingresando…';
  try {
    usuario = await api.login(tel, pass);
    document.getElementById('login-page').style.display = 'none';
    document.getElementById('app').style.display        = 'flex';
    document.getElementById('sb-name').textContent = usuario.nombre;
    document.getElementById('sb-role').textContent = usuario.rol;
    document.getElementById('tb-date').textContent = new Date().toLocaleDateString('es-MX', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
    configurarSidebarPorRol();
    showPage('dashboard');
  } catch(e) {
    toast(e.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Ingresar al Sistema';
  }
}

function doLogout() {
  usuario = null; carrito = [];
  document.getElementById('app').style.display        = 'none';
  document.getElementById('login-page').style.display = 'flex';
  document.getElementById('inp-pass').value = '';
}

function toggleVerPass() {
  const inp = document.getElementById('inp-pass');
  const btn = document.getElementById('btn-eye');
  if (inp.type === 'password') { inp.type = 'text'; btn.textContent = '🙈'; }
  else { inp.type = 'password'; btn.textContent = '👁️'; }
}

function toggleVerPassEmp() {
  const inp = document.getElementById('emp-pass');
  const btn = document.getElementById('btn-eye-emp');
  if (inp.type === 'password') { inp.type = 'text'; btn.textContent = '🙈'; }
  else { inp.type = 'password'; btn.textContent = '👁️'; }
}

// Enter en login
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('inp-pass').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
  document.getElementById('inp-tel').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
});

// ── Navegación ───────────────────────────────────────────────
const PAGE_TITLES = {
  dashboard: 'Dashboard', pos: 'Caja Inteligente (POS)',
  inventario: 'Insumos', recetas: 'Recetas',
  produccion: 'Producción', productos: 'Productos',
  proveedores: 'Proveedores', empleados: 'Recursos Humanos', reportes: 'Reportes B.I.'
};

// Permisos: 1=Gerente(todo), 2=Panadero, 3=Cajero
const PAGINAS_PERMITIDAS = {
  1: ['dashboard','pos','inventario','recetas','produccion','productos','proveedores','empleados','reportes'],
  2: ['dashboard','pos','recetas','produccion'],
  3: ['dashboard','pos'],
};

function configurarSidebarPorRol() {
  const permisos = usuario?.permisos || 3;
  const permitidas = PAGINAS_PERMITIDAS[permisos] || PAGINAS_PERMITIDAS[3];
  document.querySelectorAll('.nav-item[data-page]').forEach(n => {
    const pagina = n.getAttribute('data-page');
    n.style.display = permitidas.includes(pagina) ? '' : 'none';
  });
}

function showPage(page) {
  const permisos = usuario?.permisos || 3;
  const permitidas = PAGINAS_PERMITIDAS[permisos] || PAGINAS_PERMITIDAS[3];
  if (!permitidas.includes(page)) return toast('No tienes acceso a este módulo', 'error');
  document.querySelectorAll('.page-view').forEach(p => p.classList.remove('active'));
  document.getElementById(`page-${page}`).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => {
    if (n.getAttribute('onclick')?.includes(page)) n.classList.add('active');
  });
  document.getElementById('page-title').textContent = PAGE_TITLES[page];
  const loaders = { dashboard: loadDashboard, pos: loadPOS, inventario: loadInventario,
                    recetas: loadRecetas, produccion: loadProduccion, productos: loadProductos,
                    proveedores: loadProveedores, empleados: loadEmpleados, reportes: loadReportes };
  loaders[page]?.();
}

// ── Modal de confirmación genérico ───────────────────────────
function confirmarAccion(titulo, mensaje, onConfirmar, tipo = 'danger') {
  document.getElementById('confirm-titulo').textContent  = titulo;
  document.getElementById('confirm-mensaje').textContent = mensaje;
  const btnOk  = document.getElementById('confirm-ok');
  const btnCan = document.getElementById('confirm-cancel');
  if (onConfirmar === null) {
    // Solo informativo — ocultar botón confirmar
    btnOk.style.display  = 'none';
    btnCan.textContent   = 'Entendido';
  } else {
    btnOk.style.display  = '';
    btnCan.textContent   = 'Cancelar';
    btnOk.className = tipo === 'warning' ? 'btn btn-primary'
                    : tipo === 'info'    ? 'btn btn-secondary'
                    : 'btn btn-danger';
    btnOk.textContent = tipo === 'warning' ? 'Continuar' : 'Confirmar';
    btnOk.onclick = async () => {
      cerrarModal('modal-confirmar');
      await onConfirmar();
    };
  }
  abrirModal('modal-confirmar');
}