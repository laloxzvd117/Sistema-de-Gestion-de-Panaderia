# ============================================================
#  Archivo: backend/routers/recetas.py
#  CRUD completo de Recetas con costo unitario calculado
# ============================================================
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from backend.db import get_connection

router = APIRouter()

class InsumoReceta(BaseModel):
    id_inventario: int
    cantidad_unidad: float  # cantidad para el rendimiento_base definido

class RecetaCreate(BaseModel):
    id_producto: int
    nombre_receta: str
    descripcion: str
    tiempo_estimado: int
    rendimiento_base: int = 10  # cuántas piezas produce esta receta
    insumos: List[InsumoReceta]

class RecetaUpdate(BaseModel):
    nombre_receta: Optional[str] = None
    descripcion: Optional[str] = None
    tiempo_estimado: Optional[int] = None
    rendimiento_base: Optional[int] = None

def calcular_costo_receta(cur, id_receta: int, rendimiento_base: int) -> float:
    """Suma costo de todos los insumos de la receta y divide entre rendimiento_base."""
    cur.execute("""
        SELECT dr.cantidad_unidad, i.costo_unitario
        FROM detalle_receta dr
        JOIN inventario i ON dr.id_inventario = i.id_inventario
        WHERE dr.id_receta = %s
    """, (id_receta,))
    rows = cur.fetchall()
    costo_total = sum(float(r[0]) * float(r[1]) for r in rows)
    costo_unitario = costo_total / rendimiento_base if rendimiento_base > 0 else 0
    return round(costo_unitario, 4)

@router.get("/")
def obtener_recetas():
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT r.id_receta, r.id_producto, p.nombre as producto,
                   p.categoria, r.nombre_receta, r.descripcion,
                   r.tiempo_estimado,
                   COALESCE(r.proporciones_receta, '10') as rendimiento_base
            FROM recetas r
            JOIN productos p ON r.id_producto = p.id_producto
            ORDER BY p.categoria, p.nombre
        """)
        recetas = cur.fetchall()

        resultado = []
        for rec in recetas:
            id_receta      = rec[0]
            rendimiento    = int(rec[7]) if str(rec[7]).isdigit() else 10

            # Calcular costo unitario
            costo_unitario = calcular_costo_receta(cur, id_receta, rendimiento)

            # Obtener insumos
            cur.execute("""
                SELECT dr.id_detalle_receta, i.id_inventario, i.nombre_insumo,
                       dr.cantidad_unidad, i.unidad_medida, i.costo_unitario,
                       dr.cantidad_unidad * i.costo_unitario as subtotal
                FROM detalle_receta dr
                JOIN inventario i ON dr.id_inventario = i.id_inventario
                WHERE dr.id_receta = %s
                ORDER BY i.nombre_insumo
            """, (id_receta,))
            insumos = cur.fetchall()

            resultado.append({
                "id": id_receta,
                "id_producto": rec[1],
                "producto": rec[2],
                "categoria": rec[3],
                "nombre_receta": rec[4],
                "descripcion": rec[5],
                "tiempo_estimado": rec[6],
                "rendimiento_base": rendimiento,
                "costo_unitario": costo_unitario,
                "insumos": [{
                    "id_detalle": r[0],
                    "id_inventario": r[1],
                    "nombre": r[2],
                    "cantidad": float(r[3]),
                    "unidad": r[4],
                    "costo_unitario": float(r[5]),
                    "subtotal": round(float(r[6]), 4)
                } for r in insumos]
            })

        cur.close(); conn.close()
        return resultado
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{id_receta}")
def obtener_receta(id_receta: int):
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT r.id_receta, r.id_producto, p.nombre, p.categoria,
                   r.nombre_receta, r.descripcion, r.tiempo_estimado,
                   COALESCE(r.proporciones_receta, '10') as rendimiento_base
            FROM recetas r
            JOIN productos p ON r.id_producto = p.id_producto
            WHERE r.id_receta = %s
        """, (id_receta,))
        rec = cur.fetchone()
        if not rec:
            raise HTTPException(status_code=404, detail="Receta no encontrada")

        rendimiento    = int(rec[7]) if str(rec[7]).isdigit() else 10
        costo_unitario = calcular_costo_receta(cur, id_receta, rendimiento)

        cur.execute("""
            SELECT dr.id_detalle_receta, i.id_inventario, i.nombre_insumo,
                   dr.cantidad_unidad, i.unidad_medida, i.costo_unitario,
                   dr.cantidad_unidad * i.costo_unitario as subtotal
            FROM detalle_receta dr
            JOIN inventario i ON dr.id_inventario = i.id_inventario
            WHERE dr.id_receta = %s ORDER BY i.nombre_insumo
        """, (id_receta,))
        insumos = cur.fetchall()
        cur.close(); conn.close()

        return {
            "id": rec[0], "id_producto": rec[1], "producto": rec[2],
            "categoria": rec[3], "nombre_receta": rec[4], "descripcion": rec[5],
            "tiempo_estimado": rec[6], "rendimiento_base": rendimiento,
            "costo_unitario": costo_unitario,
            "insumos": [{
                "id_detalle": r[0], "id_inventario": r[1], "nombre": r[2],
                "cantidad": float(r[3]), "unidad": r[4],
                "costo_unitario": float(r[5]), "subtotal": round(float(r[6]), 4)
            } for r in insumos]
        }
    except HTTPException: raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/")
def crear_receta(data: RecetaCreate):
    if not data.insumos:
        raise HTTPException(status_code=400, detail="La receta debe tener al menos un insumo")
    conn = get_connection()
    cur = conn.cursor()
    try:
        # Verificar que no exista receta para ese producto
        cur.execute("SELECT id_receta FROM recetas WHERE id_producto = %s", (data.id_producto,))
        if cur.fetchone():
            raise HTTPException(status_code=400, detail="Ya existe una receta para este producto. Edítala en lugar de crear una nueva.")

        cur.execute("""
            INSERT INTO recetas (id_producto, nombre_receta, descripcion, tiempo_estimado, proporciones_receta)
            VALUES (%s, %s, %s, %s, %s) RETURNING id_receta
        """, (data.id_producto, data.nombre_receta, data.descripcion,
              data.tiempo_estimado, str(data.rendimiento_base)))
        id_receta = cur.fetchone()[0]

        for ins in data.insumos:
            cur.execute("""
                INSERT INTO detalle_receta (id_receta, cantidad_unidad, id_inventario)
                VALUES (%s, %s, %s)
            """, (id_receta, ins.cantidad_unidad, ins.id_inventario))

        costo_unitario = calcular_costo_receta(cur, id_receta, data.rendimiento_base)

        conn.commit(); cur.close(); conn.close()
        return {
            "id_receta": id_receta,
            "costo_unitario": costo_unitario,
            "mensaje": f"Receta creada. Costo unitario estimado: ${costo_unitario:.4f}"
        }
    except HTTPException: raise
    except Exception as e:
        conn.rollback(); raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close(); conn.close()

@router.put("/{id_receta}")
def actualizar_receta(id_receta: int, data: RecetaUpdate):
    try:
        conn = get_connection()
        cur = conn.cursor()
        campos, valores = [], []
        if data.nombre_receta is not None:  campos.append("nombre_receta = %s");      valores.append(data.nombre_receta)
        if data.descripcion is not None:    campos.append("descripcion = %s");         valores.append(data.descripcion)
        if data.tiempo_estimado is not None:campos.append("tiempo_estimado = %s");     valores.append(data.tiempo_estimado)
        if data.rendimiento_base is not None:campos.append("proporciones_receta = %s");valores.append(str(data.rendimiento_base))
        if not campos:
            raise HTTPException(status_code=400, detail="Sin campos para actualizar")
        valores.append(id_receta)
        cur.execute(f"UPDATE recetas SET {', '.join(campos)} WHERE id_receta = %s", valores)
        conn.commit(); cur.close(); conn.close()
        return {"mensaje": "Receta actualizada"}
    except HTTPException: raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{id_receta}/insumos")
def agregar_insumo(id_receta: int, data: InsumoReceta):
    try:
        conn = get_connection()
        cur = conn.cursor()
        # Verificar que no esté duplicado
        cur.execute("""
            SELECT id_detalle_receta FROM detalle_receta
            WHERE id_receta = %s AND id_inventario = %s
        """, (id_receta, data.id_inventario))
        if cur.fetchone():
            raise HTTPException(status_code=400, detail="Este insumo ya está en la receta. Edita la cantidad.")
        cur.execute("""
            INSERT INTO detalle_receta (id_receta, cantidad_unidad, id_inventario)
            VALUES (%s, %s, %s) RETURNING id_detalle_receta
        """, (id_receta, data.cantidad_unidad, data.id_inventario))
        new_id = cur.fetchone()[0]
        conn.commit()

        # Recalcular costo
        cur.execute("SELECT COALESCE(proporciones_receta,'10') FROM recetas WHERE id_receta = %s", (id_receta,))
        rend = cur.fetchone()
        rendimiento = int(rend[0]) if rend and str(rend[0]).isdigit() else 10
        costo = calcular_costo_receta(cur, id_receta, rendimiento)
        cur.close(); conn.close()
        return {"id_detalle": new_id, "costo_unitario": costo, "mensaje": "Insumo agregado"}
    except HTTPException: raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{id_receta}/insumos/{id_detalle}")
def actualizar_insumo_receta(id_receta: int, id_detalle: int, data: InsumoReceta):
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("""
            UPDATE detalle_receta SET cantidad_unidad = %s
            WHERE id_detalle_receta = %s AND id_receta = %s
        """, (data.cantidad_unidad, id_detalle, id_receta))
        conn.commit()
        cur.execute("SELECT COALESCE(proporciones_receta,'10') FROM recetas WHERE id_receta = %s", (id_receta,))
        rend = cur.fetchone()
        rendimiento = int(rend[0]) if rend and str(rend[0]).isdigit() else 10
        costo = calcular_costo_receta(cur, id_receta, rendimiento)
        cur.close(); conn.close()
        return {"costo_unitario": costo, "mensaje": "Insumo actualizado"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{id_receta}/insumos/{id_detalle}")
def eliminar_insumo_receta(id_receta: int, id_detalle: int):
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("DELETE FROM detalle_receta WHERE id_detalle_receta = %s AND id_receta = %s", (id_detalle, id_receta))
        conn.commit()
        cur.execute("SELECT COALESCE(proporciones_receta,'10') FROM recetas WHERE id_receta = %s", (id_receta,))
        rend = cur.fetchone()
        rendimiento = int(rend[0]) if rend and str(rend[0]).isdigit() else 10
        costo = calcular_costo_receta(cur, id_receta, rendimiento)
        cur.close(); conn.close()
        return {"costo_unitario": costo, "mensaje": "Insumo eliminado de la receta"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{id_receta}")
def eliminar_receta(id_receta: int):
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("DELETE FROM detalle_receta WHERE id_receta = %s", (id_receta,))
        cur.execute("DELETE FROM recetas WHERE id_receta = %s", (id_receta,))
        conn.commit(); cur.close(); conn.close()
        return {"mensaje": "Receta eliminada"}
    except Exception as e:
        conn.rollback(); raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close(); conn.close()