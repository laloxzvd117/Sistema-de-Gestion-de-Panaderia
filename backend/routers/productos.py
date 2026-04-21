# ============================================================
#  Archivo: backend/routers/productos.py
# ============================================================
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from backend.db import get_connection

router = APIRouter()

class ProductoCreate(BaseModel):
    nombre: str
    categoria: str
    precio: float
    tiempo_elaboracion: int

class ProductoUpdate(BaseModel):
    nombre: Optional[str] = None
    categoria: Optional[str] = None
    precio: Optional[float] = None
    tiempo_elaboracion: Optional[int] = None
    activo: Optional[int] = None

@router.get("/")
def obtener_productos(activo: Optional[int] = None):
    try:
        conn = get_connection()
        cur = conn.cursor()
        query = "SELECT id_producto, nombre, categoria, precio, tiempo_elaboracion, activo, COALESCE(stock, 0) FROM productos"
        params = []
        if activo is not None:
            query += " WHERE activo = %s"
            params.append(activo)
        query += " ORDER BY categoria, nombre"
        cur.execute(query, params)
        rows = cur.fetchall()
        cur.close(); conn.close()
        return [{"id": r[0], "nombre": r[1], "categoria": r[2],
                 "precio": float(r[3]), "tiempo_elaboracion": r[4], "activo": r[5],
                 "stock": r[6] if len(r) > 6 else 0} for r in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/")
def crear_producto(data: ProductoCreate):
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO productos (nombre, categoria, precio, tiempo_elaboracion, activo)
            VALUES (%s, %s, %s, %s, 1) RETURNING id_producto
        """, (data.nombre, data.categoria, data.precio, data.tiempo_elaboracion))
        new_id = cur.fetchone()[0]
        conn.commit(); cur.close(); conn.close()
        return {"id": new_id, "mensaje": "Producto creado exitosamente"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{id_producto}")
def actualizar_producto(id_producto: int, data: ProductoUpdate):
    try:
        conn = get_connection()
        cur = conn.cursor()
        campos, valores = [], []
        if data.nombre is not None: campos.append("nombre = %s"); valores.append(data.nombre)
        if data.categoria is not None: campos.append("categoria = %s"); valores.append(data.categoria)
        if data.precio is not None: campos.append("precio = %s"); valores.append(data.precio)
        if data.tiempo_elaboracion is not None: campos.append("tiempo_elaboracion = %s"); valores.append(data.tiempo_elaboracion)
        if data.activo is not None: campos.append("activo = %s"); valores.append(data.activo)
        if not campos:
            raise HTTPException(status_code=400, detail="Sin campos para actualizar")
        valores.append(id_producto)
        cur.execute(f"UPDATE productos SET {', '.join(campos)} WHERE id_producto = %s", valores)
        conn.commit(); cur.close(); conn.close()
        return {"mensaje": "Producto actualizado"}
    except HTTPException: raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))