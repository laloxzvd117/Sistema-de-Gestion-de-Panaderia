# ============================================================
#  Archivo: backend/routers/ventas.py
#  POS — Stock se lee de tabla PRODUCTOS (columna stock)
# ============================================================
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List
from backend.db import get_connection

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