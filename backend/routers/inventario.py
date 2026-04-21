# ============================================================
#  Archivo: backend/routers/inventario.py
# ============================================================
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from backend.db import get_connection

router = APIRouter()

class InsumoCreate(BaseModel):
    nombre_insumo: str
    stock_actual: float
    unidad_medida: str
    costo_unitario: float = 0.0

class InsumoUpdate(BaseModel):
    nombre_insumo: Optional[str] = None
    stock_actual: Optional[float] = None
    unidad_medida: Optional[str] = None
    costo_unitario: Optional[float] = None

@router.get("/")
def obtener_inventario():
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT id_inventario, nombre_insumo, stock_actual, unidad_medida, costo_unitario
            FROM inventario
            ORDER BY nombre_insumo
        """)
        rows = cur.fetchall()
        cur.close(); conn.close()
        return [{"id": r[0], "nombre": r[1], "stock": float(r[2]),
                 "unidad": r[3], "costo_unitario": float(r[4])} for r in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/")
def crear_insumo(data: InsumoCreate):
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO inventario (nombre_insumo, stock_actual, unidad_medida, costo_unitario)
            VALUES (%s, %s, %s, %s) RETURNING id_inventario
        """, (data.nombre_insumo, data.stock_actual, data.unidad_medida, data.costo_unitario))
        new_id = cur.fetchone()[0]
        conn.commit(); cur.close(); conn.close()
        return {"id": new_id, "mensaje": "Insumo creado exitosamente"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{id_inventario}")
def actualizar_insumo(id_inventario: int, data: InsumoUpdate):
    try:
        conn = get_connection()
        cur = conn.cursor()
        campos = []
        valores = []
        if data.nombre_insumo is not None:
            campos.append("nombre_insumo = %s"); valores.append(data.nombre_insumo)
        if data.stock_actual is not None:
            campos.append("stock_actual = %s"); valores.append(data.stock_actual)
        if data.unidad_medida is not None:
            campos.append("unidad_medida = %s"); valores.append(data.unidad_medida)
        if data.costo_unitario is not None:
            campos.append("costo_unitario = %s"); valores.append(data.costo_unitario)
        if not campos:
            raise HTTPException(status_code=400, detail="No hay campos para actualizar")
        valores.append(id_inventario)
        cur.execute(f"UPDATE inventario SET {', '.join(campos)} WHERE id_inventario = %s", valores)
        conn.commit(); cur.close(); conn.close()
        return {"mensaje": "Insumo actualizado"}
    except HTTPException: raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{id_inventario}")
def eliminar_insumo(id_inventario: int):
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("DELETE FROM inventario WHERE id_inventario = %s", (id_inventario,))
        conn.commit(); cur.close(); conn.close()
        return {"mensaje": "Insumo eliminado"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
