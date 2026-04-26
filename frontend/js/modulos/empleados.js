// ============================================================
//  Módulo: empleados.js
// ============================================================

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
