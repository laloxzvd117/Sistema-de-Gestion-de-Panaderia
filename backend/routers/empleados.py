# ============================================================
#  Archivo: backend/routers/empleados.py
#  CRUD completo + cambio de contraseña
# ============================================================
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import bcrypt
from backend.db import get_connection

router = APIRouter()

class EmpleadoCreate(BaseModel):
    id_cargo: int
    id_jefe_directo: Optional[int] = None
    apellidos: str
    nombre: str
    telefono: str
    usuario: Optional[str] = None
    fecha_contratacion: str
    sueldo: float
    horas: int
    password: str

class EmpleadoUpdate(BaseModel):
    id_cargo: Optional[int] = None
    id_jefe_directo: Optional[int] = None
    apellidos: Optional[str] = None
    nombre: Optional[str] = None
    telefono: Optional[str] = None
    usuario: Optional[str] = None
    fecha_contratacion: Optional[str] = None
    sueldo: Optional[float] = None
    horas: Optional[int] = None

class EmpleadoBaja(BaseModel):
    motivo_baja: str

class CambioPassword(BaseModel):
    nueva_password: str

@router.get("/")
def obtener_empleados():
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT e.id_empleado, e.nombre, e.apellidos, c.nombre_cargo, e.id_cargo,
                   e.telefono, e.sueldo, e.horas, e.fecha_contratacion, e.activo,
                   e.id_jefe_directo, e.fecha_baja, e.motivo_baja,
                   COALESCE(e.usuario, e.telefono) as usuario
            FROM empleados e
            JOIN cargos c ON e.id_cargo = c.id_cargo
            ORDER BY e.activo DESC, e.apellidos
        """)
        rows = cur.fetchall()
        cur.close(); conn.close()
        return [{
            "id": r[0], "nombre": r[1], "apellidos": r[2], "cargo": r[3],
            "id_cargo": r[4], "telefono": r[5], "sueldo": float(r[6]),
            "horas": r[7], "fecha_contratacion": str(r[8]), "activo": r[9],
            "id_jefe_directo": r[10],
            "fecha_baja": str(r[11]) if r[11] else None,
            "motivo_baja": r[12],
            "usuario": r[13]
        } for r in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/cargos")
def obtener_cargos():
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("SELECT id_cargo, nombre_cargo, descripcion, permisos FROM cargos ORDER BY permisos")
        rows = cur.fetchall()
        cur.close(); conn.close()
        return [{"id": r[0], "nombre": r[1], "descripcion": r[2], "permisos": r[3]} for r in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{id_empleado}")
def obtener_empleado(id_empleado: int):
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT e.id_empleado, e.nombre, e.apellidos, c.nombre_cargo, e.id_cargo,
                   e.telefono, e.sueldo, e.horas, e.fecha_contratacion, e.activo,
                   e.id_jefe_directo, COALESCE(e.usuario, e.telefono) as usuario
            FROM empleados e
            JOIN cargos c ON e.id_cargo = c.id_cargo
            WHERE e.id_empleado = %s
        """, (id_empleado,))
        r = cur.fetchone()
        cur.close(); conn.close()
        if not r:
            raise HTTPException(status_code=404, detail="Empleado no encontrado")
        return {
            "id": r[0], "nombre": r[1], "apellidos": r[2], "cargo": r[3],
            "id_cargo": r[4], "telefono": r[5], "sueldo": float(r[6]),
            "horas": r[7], "fecha_contratacion": str(r[8]), "activo": r[9],
            "id_jefe_directo": r[10], "usuario": r[11]
        }
    except HTTPException: raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/")
def crear_empleado(data: EmpleadoCreate):
    try:
        pwd_hash = bcrypt.hashpw(data.password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        login_user = (data.usuario or '').strip() or data.telefono
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO empleados (id_cargo, id_jefe_directo, apellidos, nombre, telefono,
                usuario, fecha_contratacion, sueldo, horas, password, activo)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 1) RETURNING id_empleado
        """, (data.id_cargo, data.id_jefe_directo, data.apellidos, data.nombre,
              data.telefono, login_user, data.fecha_contratacion,
              data.sueldo, data.horas, pwd_hash))
        new_id = cur.fetchone()[0]
        conn.commit(); cur.close(); conn.close()
        return {"id": new_id, "usuario": login_user, "mensaje": "Empleado registrado exitosamente"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{id_empleado}")
def actualizar_empleado(id_empleado: int, data: EmpleadoUpdate):
    try:
        conn = get_connection()
        cur = conn.cursor()
        campos, valores = [], []
        if data.id_cargo is not None:           campos.append("id_cargo = %s");           valores.append(data.id_cargo)
        if data.id_jefe_directo is not None:    campos.append("id_jefe_directo = %s");    valores.append(data.id_jefe_directo)
        if data.apellidos is not None:          campos.append("apellidos = %s");          valores.append(data.apellidos)
        if data.nombre is not None:             campos.append("nombre = %s");             valores.append(data.nombre)
        if data.telefono is not None:           campos.append("telefono = %s");           valores.append(data.telefono)
        if data.usuario is not None:            campos.append("usuario = %s");            valores.append(data.usuario)
        if data.fecha_contratacion is not None: campos.append("fecha_contratacion = %s"); valores.append(data.fecha_contratacion)
        if data.sueldo is not None:             campos.append("sueldo = %s");             valores.append(data.sueldo)
        if data.horas is not None:              campos.append("horas = %s");              valores.append(data.horas)
        if not campos:
            raise HTTPException(status_code=400, detail="Sin campos para actualizar")
        valores.append(id_empleado)
        cur.execute(f"UPDATE empleados SET {', '.join(campos)} WHERE id_empleado = %s", valores)
        conn.commit(); cur.close(); conn.close()
        return {"mensaje": "Empleado actualizado correctamente"}
    except HTTPException: raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/{id_empleado}/password")
def cambiar_password(id_empleado: int, data: CambioPassword):
    if not data.nueva_password or len(data.nueva_password) < 4:
        raise HTTPException(status_code=400, detail="Mínimo 4 caracteres")
    try:
        pwd_hash = bcrypt.hashpw(data.nueva_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("UPDATE empleados SET password = %s WHERE id_empleado = %s", (pwd_hash, id_empleado))
        conn.commit(); cur.close(); conn.close()
        return {"mensaje": "Contraseña actualizada correctamente"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/{id_empleado}/baja")
def dar_baja(id_empleado: int, data: EmpleadoBaja):
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("""
            UPDATE empleados SET activo = 0, fecha_baja = CURRENT_DATE, motivo_baja = %s
            WHERE id_empleado = %s
        """, (data.motivo_baja, id_empleado))
        conn.commit(); cur.close(); conn.close()
        return {"mensaje": "Empleado dado de baja correctamente"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/{id_empleado}/reactivar")
def reactivar_empleado(id_empleado: int):
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("""
            UPDATE empleados SET activo = 1, fecha_baja = NULL, motivo_baja = NULL
            WHERE id_empleado = %s
        """, (id_empleado,))
        conn.commit(); cur.close(); conn.close()
        return {"mensaje": "Empleado reactivado correctamente"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))