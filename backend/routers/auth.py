# ============================================================
#  Archivo: backend/routers/auth.py
#  Login — busca por usuario O por telefono (fallback)
# ============================================================
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import bcrypt
from backend.db import get_connection

router = APIRouter()

class LoginRequest(BaseModel):
    telefono: str
    password: str

@router.post("/login")
def login(data: LoginRequest):
    try:
        conn = get_connection()
        cur = conn.cursor()
        # Busca por campo usuario primero, si no encuentra busca por telefono
        cur.execute("""
            SELECT e.id_empleado, e.nombre, e.apellidos, e.password, c.nombre_cargo, c.permisos
            FROM empleados e
            JOIN cargos c ON e.id_cargo = c.id_cargo
            WHERE (e.usuario = %s OR e.telefono = %s) AND e.activo = 1
            LIMIT 1
        """, (data.telefono, data.telefono))
        resultado = cur.fetchone()
        cur.close()
        conn.close()

        if not resultado:
            raise HTTPException(status_code=401, detail="Usuario no encontrado o inactivo.")

        id_emp, nombre, apellidos, pwd_hash, rol, permisos = resultado

        if not bcrypt.checkpw(data.password.encode('utf-8'), pwd_hash.encode('utf-8')):
            raise HTTPException(status_code=401, detail="Contraseña incorrecta.")

        return {
            "id": id_emp,
            "nombre": f"{nombre} {apellidos}",
            "rol": rol,
            "permisos": permisos
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/debug/{usuario}")
def debug_usuario(usuario: str):
    """Endpoint temporal para verificar si el usuario existe en BD."""
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT id_empleado, nombre, apellidos, usuario, telefono, activo,
                   LENGTH(password) as pwd_len
            FROM empleados
            WHERE usuario = %s OR telefono = %s
        """, (usuario, usuario))
        rows = cur.fetchall()
        cur.close(); conn.close()
        return [{"id": r[0], "nombre": r[1], "apellidos": r[2],
                 "usuario": r[3], "telefono": r[4], "activo": r[5],
                 "pwd_len": r[6]} for r in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))