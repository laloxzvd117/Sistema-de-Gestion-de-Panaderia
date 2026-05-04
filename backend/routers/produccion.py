# ============================================================
#  Archivo: backend/routers/produccion.py
#  Lógica mejorada:
#  - Insumos proporcionales a cantidad planificada
#  - Stock al POS solo al REGISTRAR (no al planificar)
#  - Mermas calculadas y registradas automáticamente
# ============================================================
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from backend.db import get_connection

router = APIRouter()

# Rendimiento base de las recetas (piezas por lote de receta)
RENDIMIENTO_BASE = 10

class PlanificarRequest(BaseModel):
    id_producto: int
    id_empleado: int
    cantidad_estimada: int

class RegistrarLoteRequest(BaseModel):
    cantidad_lograda: int
    horas_trabajadas: float
    id_empleado: int

class LoteRequest(BaseModel):
    id_producto: int
    id_empleado: int
    cantidad_estimada: int
    cantidad_lograda: int
    horas_trabajadas: float

def calcular_costo_lote(cur, id_proceso):
    """Motor ABC: costo materia prima + mano de obra proporcional."""
    costo = 0.0
    cur.execute("""
        SELECT uc.cantidad_real_usada, i.costo_unitario
        FROM uso_componentes uc
        JOIN componentes c ON uc.id_componente = c.id_componentes
        JOIN inventario i ON c.id_inventario = i.id_inventario
        WHERE uc.id_proceso = %s
    """, (id_proceso,))
    for cantidad, costo_unit in cur.fetchall():
        costo += float(cantidad) * float(costo_unit)
    cur.execute("""
        SELECT pe.horas_trabajadas, e.sueldo, e.horas
        FROM proceso_elaboracion pe
        JOIN empleados e ON pe.id_empleado = e.id_empleado
        WHERE pe.id_proceso = %s
    """, (id_proceso,))
    labor = cur.fetchone()
    if labor and float(labor[2]) > 0:
        costo += float(labor[0]) * (float(labor[1]) / float(labor[2]))
    return costo

@router.get("/receta/{id_producto}")
def obtener_receta_producto(id_producto: int, cantidad: int = 10):
    """
    Retorna receta e insumos con cantidades proporcionales a 'cantidad'.
    La receta base es para RENDIMIENTO_BASE piezas.
    """
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT r.id_receta, r.nombre_receta, r.descripcion,
                   r.tiempo_estimado, r.proporciones_receta
            FROM recetas r WHERE r.id_producto = %s LIMIT 1
        """, (id_producto,))
        receta = cur.fetchone()
        if not receta:
            cur.close(); conn.close()
            return {"receta": None, "insumos": []}

        factor = cantidad / RENDIMIENTO_BASE  # factor proporcional

        cur.execute("""
            SELECT i.nombre_insumo, dr.cantidad_unidad, i.unidad_medida,
                   i.stock_actual, i.costo_unitario, i.id_inventario
            FROM detalle_receta dr
            JOIN inventario i ON dr.id_inventario = i.id_inventario
            WHERE dr.id_receta = %s
        """, (receta[0],))
        insumos = cur.fetchall()
        cur.close(); conn.close()

        return {
            "receta": {
                "id": receta[0], "nombre": receta[1], "descripcion": receta[2],
                "tiempo_estimado": receta[3], "proporciones": receta[4],
                "rendimiento_base": RENDIMIENTO_BASE
            },
            "insumos": [{
                "nombre": r[0],
                "cantidad_base": float(r[1]),                      # cantidad para 10 pzas
                "cantidad_requerida": round(float(r[1]) * factor, 3),  # cantidad para 'cantidad' pzas
                "unidad": r[2],
                "stock_actual": float(r[3]),
                "costo_unitario": float(r[4]),
                "id_inventario": r[5],
                "suficiente": float(r[3]) >= float(r[1]) * factor
            } for r in insumos]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/planificar")
def planificar_lote(data: PlanificarRequest):
    """
    Planifica un lote:
    - Calcula insumos proporcionales a cantidad_estimada
    - Descuenta insumos del inventario (materia prima)
    - NO suma al stock de producto terminado todavía
    - Retorna código de lote para registrar resultado después
    """
    if data.cantidad_estimada <= 0:
        raise HTTPException(status_code=400, detail="La cantidad debe ser mayor a 0")
    conn = get_connection()
    cur = conn.cursor()
    try:
        # Obtener receta
        cur.execute("""
            SELECT r.id_receta, dr.id_detalle_receta
            FROM recetas r
            JOIN detalle_receta dr ON r.id_receta = dr.id_receta
            WHERE r.id_producto = %s LIMIT 1
        """, (data.id_producto,))
        res = cur.fetchone()
        if not res:
            raise HTTPException(status_code=404, detail="No hay receta configurada para este producto.")
        id_det_receta = res[1]

        # Crear proceso
        cur.execute("""
            INSERT INTO proceso_elaboracion
                (id_detalle_receta, id_producto, id_empleado, hora_inicio, hora_fin,
                 tiempo_estimado, nombre_operacion, descripcion, horas_trabajadas,
                 cantidad_estimada, cantidad_lograda)
            VALUES (%s, %s, %s, NOW()::time, NOW()::time, 0,
                    'Lote en Producción', 'Pendiente de registro', 0, %s, 0)
            RETURNING id_proceso
        """, (id_det_receta, data.id_producto, data.id_empleado, data.cantidad_estimada))
        id_proceso = cur.fetchone()[0]

        # Calcular factor proporcional: receta base es para RENDIMIENTO_BASE pzas
        factor = data.cantidad_estimada / RENDIMIENTO_BASE

        # Obtener insumos de la receta
        cur.execute("""
            SELECT c.id_componentes, dr.cantidad_unidad, c.id_inventario, i.nombre_insumo
            FROM recetas r
            JOIN detalle_receta dr ON r.id_receta = dr.id_receta
            JOIN componentes c ON dr.id_inventario = c.id_inventario
            JOIN inventario i ON c.id_inventario = i.id_inventario
            WHERE r.id_producto = %s
        """, (data.id_producto,))
        insumos = cur.fetchall()

        for id_comp, cant_base, id_inv, nombre_ins in insumos:
            uso_estimado = round(float(cant_base) * factor, 4)
            # Registrar uso estimado
            cur.execute("""
                INSERT INTO uso_componentes
                    (id_producto, id_proceso, id_componente, cantidad_real_usada, cantidad_estimada_uso)
                VALUES (%s, %s, %s, %s, %s)
            """, (data.id_producto, id_proceso, id_comp, uso_estimado, uso_estimado))
            # Descontar del inventario de materia prima
            cur.execute(
                "UPDATE inventario SET stock_actual = stock_actual - %s WHERE id_inventario = %s",
                (uso_estimado, id_inv)
            )
            # Verificar que no quede negativo
            cur.execute("SELECT stock_actual FROM inventario WHERE id_inventario = %s", (id_inv,))
            stock_restante = cur.fetchone()
            if stock_restante and float(stock_restante[0]) < 0:
                raise ValueError(f"Stock insuficiente de '{nombre_ins}'. Faltan {abs(float(stock_restante[0]))} {nombre_ins}")

        cur.execute(
            "INSERT INTO empleados_proceso_elaboracion (id_empleado, id_proceso) VALUES (%s, %s)",
            (data.id_empleado, id_proceso)
        )
        cur.execute("""
            INSERT INTO uso_maquinaria (id_producto, id_proceso, id_maquinaria)
            VALUES (%s, %s, (SELECT MIN(id_maquinaria) FROM maquinaria))
        """, (data.id_producto, id_proceso))

        conn.commit()
        return {
            "id_proceso": id_proceso,
            "codigo_lote": f"LOTE-{id_proceso:04d}",
            "cantidad_estimada": data.cantidad_estimada,
            "insumos_descontados": len(insumos),
            "mensaje": f"Lote LOTE-{id_proceso:04d} en producción. Insumos descontados. Registra el resultado cuando termines."
        }
    except (HTTPException, ValueError) as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close(); conn.close()

@router.patch("/registrar-lote/{id_proceso}")
def registrar_lote_resultado(id_proceso: int, data: RegistrarLoteRequest):
    """
    Registra el resultado real de un lote planificado:
    - Actualiza cantidad lograda y horas trabajadas
    - Suma cantidad_lograda al stock del producto terminado (POS)
    - Si lograda < estimada → registra merma y ajusta uso_componentes
    - Calcula costo unitario con Motor ABC
    """
    if data.cantidad_lograda <= 0:
        raise HTTPException(status_code=400, detail="La cantidad lograda debe ser mayor a 0")
    conn = get_connection()
    cur = conn.cursor()
    try:
        # Obtener datos del lote planificado
        cur.execute("""
            SELECT id_producto, cantidad_estimada
            FROM proceso_elaboracion
            WHERE id_proceso = %s AND cantidad_lograda = 0
        """, (id_proceso,))
        lote = cur.fetchone()
        if not lote:
            raise HTTPException(status_code=404, detail="Lote no encontrado o ya fue registrado.")
        id_producto, cantidad_estimada = lote

        # Actualizar proceso con datos reales
        cur.execute("""
            UPDATE proceso_elaboracion SET
                cantidad_lograda = %s,
                horas_trabajadas = %s,
                hora_fin = NOW()::time,
                nombre_operacion = 'Lote Registrado',
                descripcion = 'Resultado real registrado'
            WHERE id_proceso = %s
        """, (data.cantidad_lograda, data.horas_trabajadas, id_proceso))

        # ── Calcular merma ──────────────────────────────────────────
        merma = cantidad_estimada - data.cantidad_lograda

        if merma > 0:
            # Ajustar uso_componentes: la merma implica que se usaron
            # insumos proporcionales a lo logrado, no a lo estimado
            factor_logrado  = data.cantidad_lograda / RENDIMIENTO_BASE
            factor_estimado = cantidad_estimada / RENDIMIENTO_BASE

            cur.execute("""
                SELECT uc.id_componente, uc.cantidad_estimada_uso, c.id_inventario, i.nombre_insumo
                FROM uso_componentes uc
                JOIN componentes c ON uc.id_componente = c.id_componentes
                JOIN inventario i ON c.id_inventario = i.id_inventario
                WHERE uc.id_proceso = %s
            """, (id_proceso,))
            usos = cur.fetchall()

            for id_comp, cant_estimada_uso, id_inv, nombre_ins in usos:
                cant_base = float(cant_estimada_uso) / factor_estimado
                uso_real  = round(cant_base * factor_logrado, 4)
                excedente = round(float(cant_estimada_uso) - uso_real, 4)

                # Actualizar uso real en uso_componentes
                cur.execute("""
                    UPDATE uso_componentes SET cantidad_real_usada = %s
                    WHERE id_proceso = %s AND id_componente = %s
                """, (uso_real, id_proceso, id_comp))

                # Devolver el excedente al inventario de materia prima
                if excedente > 0:
                    cur.execute(
                        "UPDATE inventario SET stock_actual = stock_actual + %s WHERE id_inventario = %s",
                        (excedente, id_inv)
                    )

        # ── Costo ABC ───────────────────────────────────────────────
        costo_total   = calcular_costo_lote(cur, id_proceso)
        costo_unitario = costo_total / data.cantidad_lograda if data.cantidad_lograda > 0 else 0

        # ── Registrar en producción ─────────────────────────────────
        cur.execute("""
            INSERT INTO produccion (id_producto, fecha_produccion, hora_salida, cantidad_producida, costo)
            VALUES (%s, CURRENT_DATE, NOW()::time, %s, %s)
        """, (id_producto, data.cantidad_lograda, costo_unitario))

        # ── Sumar al stock del producto terminado (POS) ─────────────
        # Sumar stock directamente en tabla productos
        cur.execute("""
            UPDATE productos SET stock = stock + %s
            WHERE id_producto = %s
        """, (data.cantidad_lograda, id_producto))

        conn.commit()

        resultado = {
            "id_proceso": id_proceso,
            "codigo_lote": f"LOTE-{id_proceso:04d}",
            "cantidad_estimada": cantidad_estimada,
            "cantidad_lograda": data.cantidad_lograda,
            "merma": merma,
            "costo_unitario": round(costo_unitario, 4),
            "costo_total_lote": round(costo_total, 2),
            "mensaje": "Lote registrado correctamente"
        }
        if merma > 0:
            resultado["aviso_merma"] = f"⚠️ Merma de {merma} piezas registrada. Insumos excedentes devueltos al inventario."
        return resultado

    except HTTPException: raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close(); conn.close()

@router.get("/receta-para-cantidad/{id_producto}/{cantidad}")
def receta_para_cantidad(id_producto: int, cantidad: int):
    """Alias para obtener receta con cantidad específica."""
    return obtener_receta_producto(id_producto, cantidad)

@router.get("/historial")
def historial_produccion(limite: int = 200):
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT pr.id_produccion, p.nombre, pr.fecha_produccion,
                   pr.hora_salida, pr.cantidad_producida, pr.costo
            FROM produccion pr
            JOIN productos p ON pr.id_producto = p.id_producto
            ORDER BY pr.fecha_produccion DESC, pr.hora_salida DESC LIMIT %s
        """, (limite,))
        rows = cur.fetchall()
        cur.close(); conn.close()
        return [{"id": r[0], "producto": r[1], "fecha": str(r[2]),
                 "hora": str(r[3]), "cantidad": r[4], "costo_unitario": float(r[5])} for r in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/lotes-pendientes")
def lotes_pendientes(busqueda: str = ""):
    """Lotes planificados pendientes de registro, con filtro por nombre de producto."""
    try:
        conn = get_connection()
        cur = conn.cursor()
        query = """
            SELECT pe.id_proceso, p.nombre, pe.cantidad_estimada, pe.hora_inicio
            FROM proceso_elaboracion pe
            JOIN productos p ON pe.id_producto = p.id_producto
            WHERE pe.cantidad_lograda = 0
        """
        params = []
        if busqueda:
            # Buscar por nombre de producto O por código de lote (LOTE-XXXX)
            query += " AND (p.nombre ILIKE %s OR CONCAT('LOTE-', LPAD(pe.id_proceso::text, 4, '0')) ILIKE %s)"
            params.append(f"%{busqueda}%")
            params.append(f"%{busqueda}%")
        query += " ORDER BY pe.id_proceso DESC"
        cur.execute(query, params)
        rows = cur.fetchall()
        cur.close(); conn.close()
        return [{
            "id_proceso": r[0],
            "codigo": f"LOTE-{r[0]:04d}",
            "producto": r[1],
            "cantidad_estimada": r[2],
            "hora_inicio": str(r[3]),
            "label": f"LOTE-{r[0]:04d} · {r[1]} · {r[2]} pzas"
        } for r in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/mermas")
def reporte_mermas_produccion():
    """Reporte de mermas: diferencia entre estimado y logrado por lote."""
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT pe.id_proceso, p.nombre,
                   pe.cantidad_estimada, pe.cantidad_lograda,
                   pe.cantidad_estimada - pe.cantidad_lograda AS merma,
                   CASE WHEN pe.cantidad_estimada > 0
                        THEN ROUND(((pe.cantidad_estimada - pe.cantidad_lograda)::numeric / pe.cantidad_estimada) * 100, 2)
                        ELSE 0 END AS pct_merma,
                   pe.hora_inicio
            FROM proceso_elaboracion pe
            JOIN productos p ON pe.id_producto = p.id_producto
            WHERE pe.cantidad_lograda > 0
              AND pe.cantidad_estimada > pe.cantidad_lograda
            ORDER BY pct_merma DESC
        """)
        rows = cur.fetchall()
        cur.close(); conn.close()
        return [{
            "id_proceso": r[0], "producto": r[1],
            "estimado": r[2], "logrado": r[3],
            "merma": r[4], "pct_merma": float(r[5]),
            "fecha": str(r[6])
        } for r in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))