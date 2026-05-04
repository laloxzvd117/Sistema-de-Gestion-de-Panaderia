# ============================================================
#  Archivo: backend/routers/proveedores.py
#  CRUD Proveedores + Registro de Compras
# ============================================================
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from backend.db import get_connection

router = APIRouter()

class ProveedorCreate(BaseModel):
    nombre_proveedor: str
    direccion: str
    numero_telefono: str

class ProveedorUpdate(BaseModel):
    nombre_proveedor: Optional[str] = None
    direccion:        Optional[str] = None
    numero_telefono:  Optional[str] = None

class ItemCompra(BaseModel):
    id_inventario: int
    cantidad:      float
    precio:        float  # precio unitario pagado

class CompraCreate(BaseModel):
    id_proveedor: int
    fecha:        str
    descripcion:  str
    items:        List[ItemCompra]

# ── PROVEEDORES ──────────────────────────────────────────────

@router.get("/")
def obtener_proveedores():
    try:
        conn = get_connection()
        cur  = conn.cursor()
        cur.execute("""
            SELECT p.id_proveedor, p.nombre_proveedor, p.direccion, p.numero_telefono,
                   COUNT(c.id_compras) as total_compras,
                   COALESCE(SUM(c.total), 0) as monto_total
            FROM proveedores p
            LEFT JOIN compra c ON p.id_proveedor = c.id_proveedor
            GROUP BY p.id_proveedor
            ORDER BY p.nombre_proveedor
        """)
        rows = cur.fetchall()
        cur.close(); conn.close()
        return [{
            "id": r[0], "nombre": r[1], "direccion": r[2],
            "telefono": r[3], "total_compras": r[4],
            "monto_total": float(r[5])
        } for r in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/")
def crear_proveedor(data: ProveedorCreate):
    try:
        conn = get_connection()
        cur  = conn.cursor()
        cur.execute("""
            INSERT INTO proveedores (nombre_proveedor, direccion, numero_telefono)
            VALUES (%s, %s, %s) RETURNING id_proveedor
        """, (data.nombre_proveedor, data.direccion, data.numero_telefono))
        new_id = cur.fetchone()[0]
        conn.commit(); cur.close(); conn.close()
        return {"id": new_id, "mensaje": "Proveedor registrado"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{id_proveedor}")
def actualizar_proveedor(id_proveedor: int, data: ProveedorUpdate):
    try:
        conn = get_connection()
        cur  = conn.cursor()
        campos, valores = [], []
        if data.nombre_proveedor is not None: campos.append("nombre_proveedor = %s"); valores.append(data.nombre_proveedor)
        if data.direccion        is not None: campos.append("direccion = %s");        valores.append(data.direccion)
        if data.numero_telefono  is not None: campos.append("numero_telefono = %s");  valores.append(data.numero_telefono)
        if not campos:
            raise HTTPException(status_code=400, detail="Sin campos para actualizar")
        valores.append(id_proveedor)
        cur.execute(f"UPDATE proveedores SET {', '.join(campos)} WHERE id_proveedor = %s", valores)
        conn.commit(); cur.close(); conn.close()
        return {"mensaje": "Proveedor actualizado"}
    except HTTPException: raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{id_proveedor}")
def eliminar_proveedor(id_proveedor: int):
    try:
        conn = get_connection()
        cur  = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM compra WHERE id_proveedor = %s", (id_proveedor,))
        if cur.fetchone()[0] > 0:
            raise HTTPException(status_code=400, detail="No se puede eliminar: el proveedor tiene compras registradas.")
        cur.execute("DELETE FROM proveedores WHERE id_proveedor = %s", (id_proveedor,))
        conn.commit(); cur.close(); conn.close()
        return {"mensaje": "Proveedor eliminado"}
    except HTTPException: raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ── COMPRAS ──────────────────────────────────────────────────

@router.get("/compras")
def obtener_compras(limite: int = 50):
    try:
        conn = get_connection()
        cur  = conn.cursor()
        cur.execute("""
            SELECT c.id_compras, p.nombre_proveedor, c.fecha,
                   c.descripcion, c.sub_total, c.iva, c.total
            FROM compra c
            JOIN proveedores p ON c.id_proveedor = p.id_proveedor
            ORDER BY c.fecha DESC, c.id_compras DESC LIMIT %s
        """, (limite,))
        rows = cur.fetchall()
        cur.close(); conn.close()
        return [{
            "id": r[0], "proveedor": r[1], "fecha": str(r[2]),
            "descripcion": r[3], "subtotal": float(r[4]),
            "iva": float(r[5]), "total": float(r[6])
        } for r in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/compras/{id_compra}")
def detalle_compra(id_compra: int):
    try:
        conn = get_connection()
        cur  = conn.cursor()
        cur.execute("""
            SELECT c.id_compras, p.nombre_proveedor, c.fecha,
                   c.descripcion, c.sub_total, c.iva, c.total
            FROM compra c
            JOIN proveedores p ON c.id_proveedor = p.id_proveedor
            WHERE c.id_compras = %s
        """, (id_compra,))
        cab = cur.fetchone()
        if not cab:
            raise HTTPException(status_code=404, detail="Compra no encontrada")
        cur.execute("""
            SELECT i.nombre_insumo, dc.cantidad, dc.precio, dc.costo, i.unidad_medida
            FROM detalle_compra dc
            JOIN inventario i ON dc.id_inventario = i.id_inventario
            WHERE dc.id_compra = %s
        """, (id_compra,))
        items = cur.fetchall()
        cur.close(); conn.close()
        return {
            "id": cab[0], "proveedor": cab[1], "fecha": str(cab[2]),
            "descripcion": cab[3], "subtotal": float(cab[4]),
            "iva": float(cab[5]), "total": float(cab[6]),
            "items": [{
                "insumo": r[0], "cantidad": float(r[1]),
                "precio_unitario": float(r[2]), "costo": float(r[3]),
                "unidad": r[4]
            } for r in items]
        }
    except HTTPException: raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/compras")
def registrar_compra(data: CompraCreate):
    if not data.items:
        raise HTTPException(status_code=400, detail="La compra debe tener al menos un insumo")
    conn = get_connection()
    cur  = conn.cursor()
    try:
        # Calcular totales
        subtotal = sum(item.cantidad * item.precio for item in data.items)
        iva      = round(subtotal * 0.16, 2)
        total    = round(subtotal + iva, 2)
        subtotal = round(subtotal, 2)

        # Insertar encabezado
        cur.execute("""
            INSERT INTO compra (id_proveedor, fecha, descripcion, sub_total, iva, total)
            VALUES (%s, %s, %s, %s, %s, %s) RETURNING id_compras
        """, (data.id_proveedor, data.fecha, data.descripcion, subtotal, iva, total))
        id_compra = cur.fetchone()[0]

        # Insertar detalle, actualizar stock y costo unitario
        for item in data.items:
            costo_linea = round(item.cantidad * item.precio, 2)
            cur.execute("""
                INSERT INTO detalle_compra (id_compra, id_inventario, cantidad, precio, costo)
                VALUES (%s, %s, %s, %s, %s)
            """, (id_compra, item.id_inventario, item.cantidad, item.precio, costo_linea))

            # Sumar stock
            cur.execute("""
                UPDATE inventario
                SET stock_actual   = stock_actual + %s,
                    costo_unitario = %s
                WHERE id_inventario = %s
            """, (item.cantidad, item.precio, item.id_inventario))

        # Vincular proveedor-compra
        cur.execute("""
            INSERT INTO proveedores_compras (id_compras, id_proveedor)
            VALUES (%s, %s)
        """, (id_compra, data.id_proveedor))

        conn.commit()
        return {
            "id_compra": id_compra,
            "subtotal": subtotal,
            "iva": iva,
            "total": total,
            "mensaje": f"Compra #{id_compra} registrada. Stock e inventario actualizados."
        }
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close(); conn.close()
