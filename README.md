# Gestión de Panadería - Proyecto Universitario

## Descripción del Proyecto

El presente sistema corresponde a una aplicación web desarrollada en el marco de un proyecto universitario, cuyo propósito es digitalizar y optimizar los procesos administrativos y operativos de una panadería. La plataforma centraliza la gestión de inventario, ventas, clientes, pedidos y personal, proporcionando una herramienta integral que facilita la toma de decisiones y mejora la eficiencia del negocio.

El sistema está diseñado para ser accesible desde cualquier navegador web, eliminando la dependencia de procesos manuales y reduciendo el margen de error en las operaciones diarias del establecimiento.

---

## Tecnologías Empleadas

| Tecnología | Rol en el Proyecto |
|---|---|
| **Python** | Desarrollo del backend y lógica de negocio |
| **JavaScript** | Gestión de la interactividad en el frontend |
| **HTML / CSS** | Estructura, presentación y estilos de la interfaz |
| **PostgreSQL** | Sistema de gestión de base de datos relacional |
| **JSON** | Formato de intercambio y serialización de datos |

---

## Funcionalidades

- **Gestión de Inventario** — Registro, consulta y actualización del catálogo de materias primas con control de existencias en tiempo real y alertas de stock mínimo.
- **Punto de Venta (POS)** — Registro de transacciones comerciales, gestión del cobro con cálculo de cambio automático y emisión de tickets en formato PDF.
- **Gestión de Productos** — Administración del catálogo de productos terminados disponibles para la venta.
- **Gestión de Recetas** — Definición y control de recetas de producción vinculadas a los ingredientes del inventario.
- **Control de Producción** — Planificación y registro de lotes de producción con cálculo proporcional de ingredientes.
- **Gestión de Proveedores** — Registro y administración de proveedores, incluyendo el control de compras e ingresos de mercancía.
- **Gestión de Empleados** — Registro y administración del personal con control de roles y niveles de acceso al sistema.
- **Reportes y Estadísticas** — Generación de reportes en formato PDF e indicadores clave para la toma de decisiones gerenciales.
- **Sistema de Alertas** — Notificaciones automáticas ante situaciones críticas como niveles bajos de inventario.
- **Registro de Actividad (Logs)** — Trazabilidad completa de las acciones realizadas por los usuarios dentro del sistema.
- **Respaldos (Backups)** — Generación y almacenamiento de copias de seguridad de la información del sistema.
- **Autenticación de Usuarios** — Control de acceso mediante credenciales con soporte para múltiples roles (Administrador, Panadero, Cajero).
- **Perfil de Usuario** — Consulta y actualización de la información personal de cada usuario autenticado.

---

## Requisitos y Requerimientos

### Requerimientos del Sistema

- Sistema operativo: Windows, macOS o Linux
- Navegador web actualizado (Google Chrome, Mozilla Firefox o Microsoft Edge)
- Conexión a red local o a internet

### Requerimientos de Software

- **Python** 3.10 o superior
- **PostgreSQL** 14 o superior
- **pip** — gestor de paquetes de Python
- Dependencias principales:
  - `fastapi` — framework de desarrollo web
  - `psycopg2` — adaptador de conexión con PostgreSQL
  - `json` — módulo incluido en la librería estándar de Python

### Instalación y Configuración

1. **Clonar el repositorio:**
   ```bash
   git clone https://github.com/tu-usuario/gestion-panaderia.git
   cd gestion-panaderia
   ```

2. **Instalar las dependencias del proyecto:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Configurar la base de datos:**
   - Crear una base de datos en PostgreSQL con el nombre definido en el archivo de configuración.
   - Actualizar las credenciales de conexión en el archivo `.env` o `config.py` según corresponda.

4. **Iniciar la aplicación:**
   ```bash
   uvicorn backend.app:app --reload
   ```

5. **Acceder al sistema desde el navegador:**
   ```
   http://localhost:8000
   ```

---

## Estructura del Proyecto

```
SISTEMAPANADERIA/
│
├── backend/
│   ├── routers/
│   │   ├── auth.py
│   │   ├── backup.py
│   │   ├── empleados.py
│   │   ├── inventario.py
│   │   ├── logs.py
│   │   ├── produccion.py
│   │   ├── productos.py
│   │   ├── proveedores.py
│   │   ├── recetas.py
│   │   ├── reportes.py
│   │   └── ventas.py
│   ├── __init__.py
│   ├── app.py
│   └── db.py
│
├── db/
│   ├── 01_tablas.sql
│   └── 02_relaciones.sql
│
├── documents/
│   ├── Backups/
│   ├── Reportes/
│   ├── Tickets_Compras/
│   └── Tickets_Ventas/
│
├── frontend/
│   ├── components/
│   │   ├── alertas.html
│   │   ├── dashboard.html
│   │   ├── empleados.html
│   │   ├── inventario.html
│   │   ├── logs.html
│   │   ├── perfil.html
│   │   ├── pos.html
│   │   ├── produccion.html
│   │   ├── productos.html
│   │   ├── proveedores.html
│   │   ├── recetas.html
│   │   └── reportes.html
│   ├── css/
│   │   └── styles.css
│   ├── js/
│   │   ├── modulos/
│   │   ├── api.js
│   │   └── app.js
│   └── index.html
│
├── .env.example
├── .gitignore
└── README.md
```

---

## Consideraciones Académicas

Este proyecto fue desarrollado con fines estrictamente académicos, como parte del plan de estudios en el área de desarrollo de software. Su contenido, estructura y código fuente tienen como objetivo la demostración de competencias técnicas adquiridas durante la formación universitaria.

---

## Licencia

El presente proyecto es de uso académico. Se prohíbe su reproducción, distribución o uso con fines comerciales sin la autorización expresa de los autores.
