# ============================================================
#  Archivo: backend/routers/ventas.py
#  POS — Stock se lee de tabla PRODUCTOS (columna stock)
# ============================================================
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Optional
from backend.db import get_connection
import os
from datetime import datetime
from weasyprint import HTML as WeasyprintHTML

# Carpeta donde se guardan los tickets de venta
TICKETS_VENTAS_DIR = os.path.join(
    os.path.dirname(__file__), "..", "..", "documents", "Tickets_Ventas"
)
os.makedirs(TICKETS_VENTAS_DIR, exist_ok=True)

router = APIRouter()

class ItemCarrito(BaseModel):
    id_producto: int
    nombre: str
    cantidad: float
    precio_unitario: float

class VentaRequest(BaseModel):
    id_empleado: int
    id_cliente: int
    carrito: List[ItemCarrito]

@router.get("/clientes")
def obtener_clientes():
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("SELECT id_cliente, nombre, tipo_cliente, porcentaje_descuento FROM clientes ORDER BY nombre")
        rows = cur.fetchall()
        cur.close(); conn.close()
        return [{"id": r[0], "nombre": r[1], "tipo": r[2], "descuento": float(r[3])} for r in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/productos-pos")
def productos_pos(busqueda: str = ""):
    """Stock se lee directamente de productos.stock"""
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT id_producto, nombre, precio, categoria, stock
            FROM productos
            WHERE (nombre ILIKE %s OR id_producto::text LIKE %s) AND activo = 1
            ORDER BY categoria, nombre
        """, (f"%{busqueda}%", f"%{busqueda}%"))
        rows = cur.fetchall()
        cur.close(); conn.close()
        return [{"id": r[0], "nombre": r[1], "precio": float(r[2]),
                 "categoria": r[3], "stock": r[4]} for r in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/procesar")
def procesar_venta(data: VentaRequest):
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT tipo_cliente, porcentaje_descuento FROM clientes WHERE id_cliente = %s", (data.id_cliente,))
        cliente = cur.fetchone()
        if not cliente:
            raise HTTPException(status_code=404, detail="Cliente no encontrado")
        tipo_cliente, pct_descuento = cliente

        subtotal = sum(item.cantidad * item.precio_unitario for item in data.carrito)
        descuento = subtotal * (float(pct_descuento) / 100.0)
        sub_desc  = subtotal - descuento
        iva       = sub_desc * 0.16
        total_neto= sub_desc + iva

        cur.execute("""
            INSERT INTO ventas (id_cliente, id_empleado, tipo_cliente, subtotal, total_neto, descuento_aplicado, iva)
            VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id_venta
        """, (data.id_cliente, data.id_empleado, tipo_cliente, subtotal, total_neto, descuento, iva))
        id_venta = cur.fetchone()[0]

        cur.execute("INSERT INTO empleados_ventas (id_venta, id_empleado) VALUES (%s, %s)", (id_venta, data.id_empleado))

        for item in data.carrito:
            cur.execute("""
                INSERT INTO detalle_ventas (id_venta, id_producto, cantidad, precio_unitario, total_fila)
                VALUES (%s, %s, %s, %s, %s)
            """, (id_venta, item.id_producto, item.cantidad, item.precio_unitario, item.cantidad * item.precio_unitario))

            # Descontar stock directamente de productos
            cur.execute("""
                UPDATE productos SET stock = stock - %s WHERE id_producto = %s
            """, (item.cantidad, item.id_producto))

            cur.execute("SELECT stock FROM productos WHERE id_producto = %s", (item.id_producto,))
            stock = cur.fetchone()
            if stock and stock[0] < 0:
                raise ValueError(f"Stock insuficiente para {item.nombre}")

        conn.commit()
        return {
            "id_venta": id_venta,
            "subtotal": subtotal,
            "descuento": descuento,
            "iva": iva,
            "total_neto": total_neto,
            "mensaje": "Venta procesada exitosamente"
        }
    except (HTTPException, ValueError) as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close(); conn.close()

@router.get("/historial")
def historial_ventas(limite: int = 50):
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT v.id_venta, c.nombre as cliente, e.nombre || ' ' || e.apellidos as cajero,
                   v.subtotal, v.descuento_aplicado, v.iva, v.total_neto, v.fecha
            FROM ventas v
            JOIN clientes c ON v.id_cliente = c.id_cliente
            JOIN empleados e ON v.id_empleado = e.id_empleado
            ORDER BY v.fecha DESC LIMIT %s
        """, (limite,))
        rows = cur.fetchall()
        cur.close(); conn.close()
        return [{"id": r[0], "cliente": r[1], "cajero": r[2], "subtotal": float(r[3]),
                 "descuento": float(r[4]), "iva": float(r[5]), "total": float(r[6]),
                 "fecha": str(r[7])} for r in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ── Modelos para guardar ticket PDF ─────────────────────────
class ItemTicket(BaseModel):
    nombre: str
    cantidad: float
    precio_unitario: float
    total_fila: float

class GuardarTicketRequest(BaseModel):
    id_venta: int
    cliente: str
    cajero: str
    subtotal: float
    descuento: float
    iva: float
    total_neto: float
    monto_recibido: float = 0.0
    cambio: float = 0.0
    items: List[ItemTicket]

@router.post("/guardar-ticket")
def guardar_ticket(data: GuardarTicketRequest):
    """Genera y guarda el ticket de venta como PDF en documents/Tickets_Ventas/"""
    try:
        nombre_archivo = f"TicketVenta-{str(data.id_venta).zfill(4)}.pdf"
        ruta = os.path.join(TICKETS_VENTAS_DIR, nombre_archivo)
        fecha_str = datetime.now().strftime("%d/%m/%Y, %I:%M:%S %p").lower()
        folio = str(data.id_venta).zfill(4)

        def fmtT(v):
            return f"${v:,.2f}"

        filas_html = ""
        for it in data.items:
            qty = int(it.cantidad) if it.cantidad == int(it.cantidad) else it.cantidad
            filas_html += (
                '<div style="display:grid;grid-template-columns:1fr auto auto;gap:4px;'
                'padding:5px 0;border-bottom:1px dotted #ccc">'
                f'<div><div style="font-weight:500;font-size:11.5px">{it.nombre}</div>'
                f'<div style="font-size:10px;color:#666">{fmtT(it.precio_unitario)} c/u</div></div>'
                f'<div style="text-align:right;color:#666;font-size:11px;align-self:center">{qty}</div>'
                f'<div style="text-align:right;font-weight:600;font-size:11px;align-self:center">{fmtT(it.total_fila)}</div>'
                '</div>'
            )

        desc_html = (
            f'<div style="display:flex;justify-content:space-between;padding:2px 0;font-size:11px;color:#2a7a2a">'
            f'<span>Descuento</span><span>-{fmtT(data.descuento)}</span></div>'
        ) if data.descuento > 0 else ""

        cobro_html = (
            f'<hr class="sep">'
            f'<div class="tot-row" style="color:#555"><span>Recibido</span><span>{fmtT(data.monto_recibido)}</span></div>'
            f'<div class="tot-row" style="font-weight:700;color:#2a7a2a"><span>Cambio</span><span>{fmtT(data.cambio)}</span></div>'
        ) if data.monto_recibido > 0 else ""

        html = f"""<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>
* {{ margin:0; padding:0; box-sizing:border-box; }}
body {{
  font-family: "Courier New", monospace;
  font-size: 11.5px; color: #111; background: #fff;
  width: 72mm; padding: 6px 8px 24px; margin: 0 auto;
}}
.logo {{ text-align:center; padding-bottom:8px; border-bottom:2px dashed #333; margin-bottom:8px; }}
.logo-icon   {{ font-size:28px; line-height:1; }}
.logo-nombre {{ font-size:15px; font-weight:bold; letter-spacing:3px; text-transform:uppercase; margin:2px 0 1px; }}
.logo-sub    {{ font-size:9px; letter-spacing:1px; color:#555; }}
.ticket-titulo {{ text-align:center; font-size:12px; font-weight:bold; text-transform:uppercase; letter-spacing:1px; margin:6px 0 2px; }}
.ticket-num    {{ text-align:center; font-size:18px; font-weight:bold; letter-spacing:2px; margin-bottom:8px; }}
.info-row   {{ display:flex; justify-content:space-between; font-size:10.5px; margin:2px 0; }}
.info-label {{ color:#666; }}
.sep {{ border:none; border-top:1px dashed #aaa; margin:7px 0; }}
.sec-title {{ font-size:9px; text-transform:uppercase; letter-spacing:1px; color:#555; margin-bottom:4px; }}
.totales {{ margin-top:8px; }}
.tot-row {{ display:flex; justify-content:space-between; font-size:11px; margin:2px 0; }}
.tot-final {{ font-size:15px; font-weight:bold; border-top:2px solid #333; padding-top:5px; margin-top:5px; }}
.nota {{ display:flex; justify-content:space-between; font-size:9.5px; color:#555; margin-top:6px; }}
.footer {{ text-align:center; font-size:9px; color:#888; margin-top:12px; border-top:1px dashed #bbb; padding-top:8px; line-height:1.6; }}
@page {{ size: 72mm auto; margin: 0; }}
</style></head><body>
<div class="logo">
  <div class="logo-icon">&#x1F950;</div>
  <div class="logo-nombre">Panadería</div>
  <div class="logo-sub">ERP &middot; Sistema de Gestión</div>
</div>
<div class="ticket-titulo">Ticket de Venta</div>
<div class="ticket-num">Folio #{folio}</div>
<hr class="sep">
<div class="info-row"><span class="info-label">Fecha</span><span>{fecha_str}</span></div>
<div class="info-row"><span class="info-label">Cliente</span><span><strong>{data.cliente}</strong></span></div>
<div class="info-row"><span class="info-label">Cajero</span><span>{data.cajero}</span></div>
<hr class="sep">
<div class="sec-title">Productos</div>
{filas_html}
<div class="totales">
  <div class="tot-row"><span>Subtotal</span><span>{fmtT(data.subtotal)}</span></div>
  {desc_html}
  <div class="tot-row"><span>IVA (16%)</span><span>{fmtT(data.iva)}</span></div>
  <div class="tot-row tot-final"><span>TOTAL</span><span>{fmtT(data.total_neto)}</span></div>
  {cobro_html}
</div>
<hr class="sep">
<div class="nota"><span>&#x1F642; &nbsp;Gracias por su compra!</span></div>
<div class="footer">Emitido: {fecha_str}<br>ERP Panadería &mdash; Caja</div>
</body></html>"""

        WeasyprintHTML(string=html).write_pdf(ruta)
        url_pdf = f"/documents/Tickets_Ventas/{nombre_archivo}"
        return {"ok": True, "archivo": nombre_archivo, "ruta": ruta, "url_pdf": url_pdf}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
