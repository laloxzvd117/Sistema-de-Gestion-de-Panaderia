// ============================================================
//  Módulo: alertas.js — Alertas automáticas de stock
// ============================================================

async function loadAlertas() {
  try {
    const minimo  = parseInt(document.getElementById('alerta-minimo')?.value) || 10;
    const insumos = await api.getInventario();

    const criticos = insumos.filter(i => i.stock <= 0);
    const bajos    = insumos.filter(i => i.stock > 0 && i.stock < minimo);
    const ok       = insumos.filter(i => i.stock >= minimo);

    // KPIs
    document.getElementById('alerta-kpi-critico').textContent = criticos.length;
    document.getElementById('alerta-kpi-bajo').textContent    = bajos.length;
    document.getElementById('alerta-kpi-ok').textContent      = ok.length;

    // Badge en sidebar
    const totalAlerta = criticos.length + bajos.length;
    const badge = document.getElementById('badge-alertas');
    if (badge) {
      badge.textContent    = totalAlerta;
      badge.style.display  = totalAlerta > 0 ? 'inline' : 'none';
    }

    // Tabla — primero críticos, luego bajos, luego ok
    const ordenados = [
      ...criticos.map(i => ({ ...i, nivel: 'critico' })),
      ...bajos.map(i =>    ({ ...i, nivel: 'bajo' })),
      ...ok.map(i =>       ({ ...i, nivel: 'ok' }))
    ];

    const tbody = tbBody('tbl-alertas');
    tbody.innerHTML = '';

    if (!ordenados.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--text-muted)">Sin insumos registrados</td></tr>';
      return;
    }

    ordenados.forEach(i => {
      const badge_color = i.nivel === 'critico' ? '#EF4444'
                        : i.nivel === 'bajo'    ? '#D97706'
                        : '#059669';
      const badge_txt   = i.nivel === 'critico' ? '🔴 Crítico'
                        : i.nivel === 'bajo'    ? '🟡 Bajo'
                        : '🟢 OK';
      const pct = i.stock <= 0 ? 0 : Math.min(100, Math.round((i.stock / (minimo * 3)) * 100));
      const bar_color = i.nivel === 'critico' ? '#EF4444'
                      : i.nivel === 'bajo'    ? '#D97706'
                      : '#059669';

      tbody.innerHTML += `<tr>
        <td>
          <strong>${i.nombre}</strong>
          <div style="margin-top:4px;height:5px;background:#EEE;border-radius:3px;width:120px">
            <div style="height:100%;width:${pct}%;background:${bar_color};border-radius:3px;transition:width .3s"></div>
          </div>
        </td>
        <td style="font-weight:600;color:${badge_color}">${i.stock} ${i.unidad}</td>
        <td>${i.unidad}</td>
        <td>${minimo} ${i.unidad}</td>
        <td><span style="background:${badge_color};color:#fff;padding:3px 10px;border-radius:999px;font-size:.75rem;font-weight:600">${badge_txt}</span></td>
        <td>
          ${i.nivel !== 'ok' ? `<button class="btn btn-primary btn-sm" onclick="irACompra('${i.nombre}')">🛒 Comprar</button>` : ''}
        </td>
      </tr>`;
    });

  } catch(e) { toast('Error cargando alertas: ' + e.message, 'error'); }
}

function irACompra(nombreInsumo) {
  // Navegar a proveedores → Nueva Compra y preseleccionar el insumo
  showPage('proveedores');
  setTimeout(async () => {
    // Activar tab nueva compra
    const tabBtn = document.querySelector('.prov-tab[data-tab="nueva-compra"]');
    if (tabBtn) switchProvTab('nueva-compra', tabBtn);
    setTimeout(() => {
      // Buscar el insumo en el campo de búsqueda
      const busqueda = document.getElementById('compra-item-busqueda');
      if (busqueda) {
        busqueda.value = nombreInsumo;
        filtrarInsumosCompra(nombreInsumo);
      }
    }, 400);
  }, 300);
}

// Verificar alertas al cargar cualquier página (cada 5 minutos)
async function verificarBadgeAlertas() {
  try {
    const minimo  = parseInt(document.getElementById('alerta-minimo')?.value) || 10;
    const insumos = await api.getInventario();
    const total   = insumos.filter(i => i.stock < minimo).length;
    const badge   = document.getElementById('badge-alertas');
    if (badge) {
      badge.textContent   = total;
      badge.style.display = total > 0 ? 'inline' : 'none';
    }
  } catch(e) {}
}

// Revisar badge cada 5 minutos
setInterval(verificarBadgeAlertas, 5 * 60 * 1000);