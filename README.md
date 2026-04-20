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

- **Gestión de Inventario** — Registro, consulta y actualización del catálogo de productos disponibles, con control de existencias en tiempo real.
- **Gestión de Ventas** — Registro de transacciones comerciales y seguimiento del historial de ventas diarias.
- **Gestión de Clientes** — Administración de la información y datos de contacto de la cartera de clientes.
- **Control de Pedidos** — Creación, asignación y monitoreo del estado de pedidos desde su generación hasta su entrega.
- **Reportes y Estadísticas** — Generación de informes y visualización de indicadores clave para la toma de decisiones gerenciales.
- **Autenticación de Usuarios** — Control de acceso al sistema mediante credenciales, garantizando la seguridad de la información.
- **Gestión de Empleados** — Registro y administración de la información del personal vinculado al establecimiento.

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
   python app.py
   ```

5. **Acceder al sistema desde el navegador:**
   ```
   http://localhost:5000
   ```

---

---

## Consideraciones Académicas

Este proyecto fue desarrollado con fines estrictamente académicos, como parte del plan de estudios en el área de desarrollo de software. Su contenido, estructura y código fuente tienen como objetivo la demostración de competencias técnicas adquiridas durante la formación universitaria.

---

## Licencia

El presente proyecto es de uso académico. Se prohíbe su reproducción, distribución o uso con fines comerciales sin la autorización expresa de los autores.
