# ============================================================
#  Archivo: backend/routers/backup.py
#  Módulo de Backup — solo Admin (permisos=1)
#  - Backup manual: dump SQL + ZIP de documents/
#  - Backup programado: APScheduler (diario/semanal)
#  - Historial de backups generados
# ============================================================
import os
import subprocess
import zipfile
import json
from datetime import datetime, date, timedelta
from pathlib import Path
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from dotenv import load_dotenv
from backend.db import get_connection

load_dotenv()

router = APIRouter()

# ── Rutas ────────────────────────────────────────────────────
BACKUP_DIR    = Path("documents/Backups")
SCHEDULE_FILE = Path("documents/Backups/schedule.json")
BACKUP_DIR.mkdir(parents=True, exist_ok=True)

# ── Scheduler global ─────────────────────────────────────────
scheduler = BackgroundScheduler()
scheduler.start()

# ── Configuración de BD (desde .env) ─────────────────────────
DB_NAME = os.getenv("DB_NAME", "panaderia")
DB_USER = os.getenv("DB_USER", "admin")
DB_HOST = os.getenv("DB_HOST", "127.0.0.1")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_PASS = os.getenv("DB_PASSWORD", "")

# ============================================================
#  FUNCIÓN CORE: Generar backup
# ============================================================
def generar_backup() -> dict:
    """Genera dump SQL + ZIP de documents/ y los empaqueta en un solo archivo."""
    ts        = datetime.now().strftime("%Y%m%d_%H%M%S")
    nombre    = f"backup_{ts}"
    zip_path  = BACKUP_DIR / f"{nombre}.zip"
    sql_path  = BACKUP_DIR / f"{nombre}.sql"

    errores = []

    # ── 1. Dump SQL con pg_dump ──────────────────────────────
    try:
        env = os.environ.copy()
        env["PGPASSWORD"] = DB_PASS
        result = subprocess.run(
            ["pg_dump", "-U", DB_USER, "-h", DB_HOST, "-p", DB_PORT,
             "-F", "p", "-f", str(sql_path), DB_NAME],
            env=env, capture_output=True, text=True, timeout=120
        )
        if result.returncode != 0:
            errores.append(f"pg_dump warning: {result.stderr[:200]}")
    except Exception as e:
        errores.append(f"pg_dump error: {str(e)}")

    # ── 2. Crear ZIP con SQL + carpeta documents/ ────────────
    try:
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
            # Incluir el dump SQL si se generó
            if sql_path.exists():
                zf.write(sql_path, f"{nombre}.sql")
                sql_path.unlink()  # borrar SQL suelto, ya está en el ZIP

            # Incluir archivos de documents/ (tickets, reportes, etc.)
            docs_dir = Path("documents")
            for archivo in docs_dir.rglob("*"):
                if archivo.is_file() and "Backups" not in str(archivo):
                    zf.write(archivo, str(archivo))

        tamanio_mb = round(zip_path.stat().st_size / (1024 * 1024), 2)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creando ZIP: {str(e)}")

    return {
        "archivo":    zip_path.name,
        "ruta":       str(zip_path),
        "fecha":      datetime.now().isoformat(),
        "tamanio_mb": tamanio_mb,
        "errores":    errores
    }

# ============================================================
#  ENDPOINTS
# ============================================================

@router.post("/generar")
def generar_backup_manual():
    """Genera un backup inmediato."""
    try:
        resultado = generar_backup()
        return {
            "mensaje": f"Backup generado correctamente",
            **resultado
        }
    except HTTPException: raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/historial")
def obtener_historial():
    """Lista todos los backups disponibles en documents/Backups/."""
    try:
        backups = []
        for archivo in sorted(BACKUP_DIR.glob("backup_*.zip"), reverse=True):
            stat = archivo.stat()
            # Parsear fecha del nombre: backup_YYYYMMDD_HHMMSS.zip
            try:
                partes = archivo.stem.split("_")  # ['backup','YYYYMMDD','HHMMSS']
                fecha_str = f"{partes[1][:4]}-{partes[1][4:6]}-{partes[1][6:8]} {partes[2][:2]}:{partes[2][2:4]}:{partes[2][4:6]}"
            except Exception:
                fecha_str = datetime.fromtimestamp(stat.st_mtime).strftime("%Y-%m-%d %H:%M:%S")

            backups.append({
                "archivo":    archivo.name,
                "fecha":      fecha_str,
                "tamanio_mb": round(stat.st_size / (1024 * 1024), 2)
            })
        return backups
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/descargar/{nombre_archivo}")
def descargar_backup(nombre_archivo: str):
    """Descarga un backup específico."""
    # Sanitizar nombre para evitar path traversal
    if "/" in nombre_archivo or "\\" in nombre_archivo or ".." in nombre_archivo:
        raise HTTPException(status_code=400, detail="Nombre de archivo inválido")
    ruta = BACKUP_DIR / nombre_archivo
    if not ruta.exists():
        raise HTTPException(status_code=404, detail="Backup no encontrado")
    return FileResponse(
        path=str(ruta),
        filename=nombre_archivo,
        media_type="application/zip"
    )


@router.delete("/eliminar/{nombre_archivo}")
def eliminar_backup(nombre_archivo: str):
    """Elimina un backup del servidor."""
    if "/" in nombre_archivo or "\\" in nombre_archivo or ".." in nombre_archivo:
        raise HTTPException(status_code=400, detail="Nombre de archivo inválido")
    ruta = BACKUP_DIR / nombre_archivo
    if not ruta.exists():
        raise HTTPException(status_code=404, detail="Backup no encontrado")
    ruta.unlink()
    return {"mensaje": f"Backup {nombre_archivo} eliminado"}


# ── Modelos para programación ────────────────────────────────
class ProgramacionBackup(BaseModel):
    activo:      bool
    frecuencia:  str   # 'diario' | 'semanal'
    hora:        str   # 'HH:MM'
    dia_semana:  Optional[str] = "monday"  # solo si frecuencia=semanal


@router.get("/programacion")
def obtener_programacion():
    """Devuelve la configuración actual del backup programado."""
    if SCHEDULE_FILE.exists():
        with open(SCHEDULE_FILE) as f:
            return json.load(f)
    return {"activo": False, "frecuencia": "diario", "hora": "02:00", "dia_semana": "monday"}


@router.post("/programacion")
def guardar_programacion(data: ProgramacionBackup):
    """Guarda y aplica la programación de backup."""
    # Guardar en archivo JSON
    config = data.dict()
    with open(SCHEDULE_FILE, "w") as f:
        json.dump(config, f, indent=2)

    # Limpiar jobs anteriores
    scheduler.remove_all_jobs()

    if data.activo:
        try:
            hora, minuto = data.hora.split(":")
        except ValueError:
            raise HTTPException(status_code=400, detail="Formato de hora inválido. Use HH:MM")

        if data.frecuencia == "diario":
            trigger = CronTrigger(hour=int(hora), minute=int(minuto))
        elif data.frecuencia == "semanal":
            dias = {
                "monday": "mon", "tuesday": "tue", "wednesday": "wed",
                "thursday": "thu", "friday": "fri", "saturday": "sat", "sunday": "sun"
            }
            dia = dias.get(data.dia_semana, "mon")
            trigger = CronTrigger(day_of_week=dia, hour=int(hora), minute=int(minuto))
        else:
            raise HTTPException(status_code=400, detail="Frecuencia inválida. Use 'diario' o 'semanal'")

        scheduler.add_job(generar_backup, trigger, id="backup_programado", replace_existing=True)

    return {
        "mensaje": "Programación guardada" + (" y activada" if data.activo else " (desactivada)"),
        **config
    }


# ── Cargar programación al iniciar ───────────────────────────
def cargar_programacion_inicial():
    """Restaura el job de backup al arrancar el servidor."""
    if SCHEDULE_FILE.exists():
        try:
            with open(SCHEDULE_FILE) as f:
                config = json.load(f)
            if config.get("activo"):
                hora, minuto = config["hora"].split(":")
                if config["frecuencia"] == "diario":
                    trigger = CronTrigger(hour=int(hora), minute=int(minuto))
                else:
                    dias = {
                        "monday": "mon", "tuesday": "tue", "wednesday": "wed",
                        "thursday": "thu", "friday": "fri", "saturday": "sat", "sunday": "sun"
                    }
                    dia = dias.get(config.get("dia_semana", "monday"), "mon")
                    trigger = CronTrigger(day_of_week=dia, hour=int(hora), minute=int(minuto))
                scheduler.add_job(generar_backup, trigger, id="backup_programado", replace_existing=True)
        except Exception as e:
            print(f"[backup] Error cargando programación: {e}")

cargar_programacion_inicial()