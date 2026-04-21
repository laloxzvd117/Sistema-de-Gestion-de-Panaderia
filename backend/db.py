# ============================================================
#  Archivo: backend/db.py
# ============================================================
import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

def get_connection():
    try:
        connection = psycopg2.connect(
            host     = os.getenv("DB_HOST"),
            port     = os.getenv("DB_PORT"),
            dbname   = os.getenv("DB_NAME"),
            user     = os.getenv("DB_USER"),
            password = os.getenv("DB_PASSWORD")
        )
        with connection.cursor() as cur:
            cur.execute("SET TIME ZONE 'America/Mexico_City'")
        connection.commit()
        return connection
    except psycopg2.OperationalError as e:
        raise RuntimeError(f"No se pudo conectar a la base de datos: {e}")