# ============================================================
#  Archivo: backend/routers/logs.py
# ============================================================
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from backend.db import get_connection

router = APIRouter()

class LogCreate(BaseModel):
    id_empleado: int
    accion:      str
    modulo:      str
    descripcion: str
    referencia:  Optional[str] = None

@router.post("/")
def registrar_log(data: LogCreate):
    try:
        conn = get_connection()
        cur  = conn.cursor()
        cur.execute("""
            INSERT INTO logs_actividad (id_empleado, accion, modulo, descripcion, referencia, fecha)
            VALUES (%s, %s, %s, %s, %s, NOW())
        """, (data.id_empleado, data.accion, data.modulo, data.descripcion, data.referencia))
        conn.commit(); cur.close(); conn.close()
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/")
def obtener_logs(limite: int = 200, modulo: Optional[str] = None,
                 accion: Optional[str] = None, busqueda: Optional[str] = None):
    try:
        conn = get_connection()
        cur  = conn.cursor()
        query = """
            SELECT l.id_log, e.nombre || ' ' || e.apellidos as empleado,
                   c.nombre_cargo as rol, l.accion, l.modulo,
                   l.descripcion, l.referencia, l.fecha
            FROM logs_actividad l
            JOIN empleados e ON l.id_empleado = e.id_empleado
            JOIN cargos c ON e.id_cargo = c.id_cargo
            WHERE 1=1
        """
        params = []
        if modulo:   query += " AND l.modulo = %s";   params.append(modulo)
        if accion:   query += " AND l.accion = %s";   params.append(accion)
        if busqueda:
            query += " AND (l.descripcion ILIKE %s OR l.referencia ILIKE %s OR e.nombre ILIKE %s)"
            params += [f"%{busqueda}%", f"%{busqueda}%", f"%{busqueda}%"]
        query += " ORDER BY l.fecha DESC LIMIT %s"
        params.append(limite)
        cur.execute(query, params)
        rows = cur.fetchall()
        cur.close(); conn.close()
        return [{"id": r[0], "empleado": r[1], "rol": r[2], "accion": r[3],
                 "modulo": r[4], "descripcion": r[5], "referencia": r[6],
                 "fecha": r[7].strftime("%d/%m/%Y %H:%M:%S")} for r in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/resumen")
def resumen_logs():
    try:
        conn = get_connection()
        cur  = conn.cursor()
        cur.execute("""
            SELECT COUNT(*) as total,
                   COUNT(*) FILTER (WHERE fecha::date = CURRENT_DATE) as hoy,
                   COUNT(DISTINCT id_empleado) as usuarios,
                   (SELECT modulo FROM logs_actividad
                    GROUP BY modulo ORDER BY COUNT(*) DESC LIMIT 1) as modulo_top
            FROM logs_actividad
        """)
        r = cur.fetchone()
        cur.close(); conn.close()
        return {"total": r[0], "hoy": r[1], "usuarios": r[2], "modulo_top": r[3] or "—"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))