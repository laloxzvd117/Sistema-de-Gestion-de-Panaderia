# ============================================================
#  Archivo: backend/app.py
#  Ejecutar: uvicorn backend.app:app --reload
# ============================================================
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from starlette.middleware.base import BaseHTTPMiddleware

class NoCacheMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        if request.url.path.endswith(('.js', '.css', '.html')):
            response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate'
            response.headers['Pragma'] = 'no-cache'
            response.headers['Expires'] = '0'
        return response

from backend.routers import auth, inventario, empleados, productos, ventas, produccion, reportes, recetas, proveedores, logs

app = FastAPI(
    title       = "ERP Panadería",
    description = "Sistema de gestión integral para panaderías",
    version     = "1.0.0"
)

app.add_middleware(NoCacheMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins     = ["*"],
    allow_credentials = True,
    allow_methods     = ["*"],
    allow_headers     = ["*"],
)

app.include_router(auth.router,        prefix="/api/auth",        tags=["Autenticación"])
app.include_router(inventario.router,  prefix="/api/inventario",  tags=["Inventario"])
app.include_router(empleados.router,   prefix="/api/empleados",   tags=["Empleados"])
app.include_router(productos.router,   prefix="/api/productos",   tags=["Productos"])
app.include_router(ventas.router,      prefix="/api/ventas",      tags=["Ventas"])
app.include_router(produccion.router,  prefix="/api/produccion",  tags=["Producción"])
app.include_router(reportes.router,    prefix="/api/reportes",    tags=["Reportes BI"])
app.include_router(recetas.router,     prefix="/api/recetas",     tags=["Recetas"])
app.include_router(proveedores.router, prefix="/api/proveedores", tags=["Proveedores"])
app.include_router(logs.router,        prefix="/api/logs",        tags=["Logs"])

app.mount("/", StaticFiles(directory="frontend", html=True), name="static")

@app.get("/health", tags=["Status"])
def health():
    return {"status": "ok"}
