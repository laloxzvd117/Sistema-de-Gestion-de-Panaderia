# ============================================================
#  Archivo: backend/routers/reportes.py
# ============================================================
from fastapi import APIRouter, HTTPException
from backend.db import get_connection
from datetime import datetime, timedelta

router = APIRouter()

def fechas_default():
    fin = datetime.now().strftime("%Y-%m-%d")
    ini = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
    return ini, fin

@router.get("/volumen")
def reporte_volumen(fecha_inicio: str = None, fecha_fin: str = None):
    if not fecha_inicio or not fecha_fin:
        fecha_inicio, fecha_fin = fechas_default()
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("""
            WITH VentasHistoricas AS (
                SELECT dv.id_producto, p.nombre, SUM(dv.cantidad) as volumen_total
                FROM detalle_ventas dv
                JOIN ventas v ON dv.id_venta = v.id_venta
                JOIN productos p ON dv.id_producto = p.id_producto
                WHERE v.fecha::date BETWEEN %s AND %s
                GROUP BY dv.id_producto, p.nombre
            )
            SELECT id_producto, nombre, volumen_total,
                   RANK() OVER (ORDER BY volumen_total DESC) as ranking
            FROM VentasHistoricas
            ORDER BY ranking ASC
        """, (fecha_inicio, fecha_fin))
        rows = cur.fetchall()
        cur.close(); conn.close()
        return [{"id": r[0], "producto": r[1], "volumen": float(r[2]), "ranking": r[3]} for r in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/rentabilidad")
def reporte_rentabilidad(fecha_inicio: str = None, fecha_fin: str = None):
    if not fecha_inicio or not fecha_fin:
        fecha_inicio, fecha_fin = fechas_default()
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("""
            WITH CostoPromedio AS (
                SELECT id_producto, AVG(costo) as costo_medio
                FROM produccion
                WHERE fecha_produccion BETWEEN %s AND %s
                GROUP BY id_producto
            )
            SELECT dv.id_producto, p.nombre,
                   SUM(dv.total_fila) as ingreso_bruto,
                   SUM(dv.cantidad * COALESCE(cp.costo_medio, 0)) as costo_manufactura,
                   SUM(dv.total_fila) - SUM(dv.cantidad * COALESCE(cp.costo_medio, 0)) as ganancia_neta
            FROM detalle_ventas dv
            JOIN ventas v ON dv.id_venta = v.id_venta
            JOIN productos p ON dv.id_producto = p.id_producto
            LEFT JOIN CostoPromedio cp ON p.id_producto = cp.id_producto
            WHERE v.fecha::date BETWEEN %s AND %s
            GROUP BY dv.id_producto, p.nombre
            ORDER BY ganancia_neta DESC LIMIT 5
        """, (fecha_inicio, fecha_fin, fecha_inicio, fecha_fin))
        rows = cur.fetchall()
        cur.close(); conn.close()
        return [{"id": r[0], "producto": r[1], "ingreso_bruto": float(r[2]),
                 "costo_manufactura": float(r[3]), "ganancia_neta": float(r[4])} for r in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/mermas")
def reporte_mermas():
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT p.nombre,
                   SUM(pe.cantidad_estimada) as proyectado,
                   SUM(pe.cantidad_lograda) as real,
                   SUM(pe.cantidad_estimada - pe.cantidad_lograda) as merma,
                   ROUND(
                       (SUM(pe.cantidad_estimada - pe.cantidad_lograda) * 100.0) /
                       NULLIF(SUM(pe.cantidad_estimada), 0), 2
                   ) as pct_merma
            FROM proceso_elaboracion pe
            JOIN productos p ON pe.id_producto = p.id_producto
            GROUP BY p.nombre
            ORDER BY pct_merma DESC NULLS LAST
        """)
        rows = cur.fetchall()
        cur.close(); conn.close()
        return [{"producto": r[0], "proyectado": r[1], "real": r[2],
                 "merma": r[3], "pct_merma": float(r[4]) if r[4] else 0.0} for r in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/ventas-semana")
def ventas_semana():
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT
                DATE(fecha) as dia,
                COUNT(*) as num_ventas,
                COALESCE(SUM(total_neto), 0) as ingresos
            FROM ventas
            WHERE fecha >= CURRENT_DATE - INTERVAL '6 days'
            GROUP BY DATE(fecha)
            ORDER BY dia ASC
        """)
        rows = cur.fetchall()
        cur.close(); conn.close()
        # Rellenar días sin ventas con 0
        from datetime import date, timedelta
        resultado = {}
        for i in range(7):
            d = (date.today() - timedelta(days=6-i)).isoformat()
            resultado[d] = {"dia": d, "ventas": 0, "ingresos": 0.0}
        for r in rows:
            k = str(r[0])
            if k in resultado:
                resultado[k] = {"dia": k, "ventas": r[1], "ingresos": float(r[2])}
        return list(resultado.values())
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/dashboard-kpis")
def dashboard_kpis():
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM ventas WHERE fecha::date = CURRENT_DATE")
        ventas_hoy = cur.fetchone()[0]
        cur.execute("SELECT COALESCE(SUM(total_neto), 0) FROM ventas WHERE fecha::date = CURRENT_DATE")
        ingresos_hoy = float(cur.fetchone()[0])
        cur.execute("SELECT COUNT(*) FROM inventario WHERE stock_actual < 10")
        stock_bajo = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM empleados WHERE activo = 1")
        empleados_activos = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM produccion WHERE fecha_produccion = CURRENT_DATE")
        lotes_hoy = cur.fetchone()[0]
        cur.close(); conn.close()
        return {
            "ventas_hoy": ventas_hoy,
            "ingresos_hoy": ingresos_hoy,
            "stock_bajo": stock_bajo,
            "empleados_activos": empleados_activos,
            "lotes_hoy": lotes_hoy
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))