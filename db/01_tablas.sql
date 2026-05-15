-- ============================================================
--  BASE DE DATOS: panaderia
--  Motor: PostgreSQL
--  Versión: Final con todos los cambios
--  Ejecutar: psql -U admin -d panaderia -h localhost -f 01_tablas.sql
-- ============================================================

-- CREATE DATABASE panaderia;

CREATE TYPE estado_maquinaria AS ENUM (
    'Operativa', 'Disponible', 'Ocupada', 'Mantenimiento', 'Inactiva', 'Averiada'
);

-- ============================================================
-- TABLA: CARGOS
-- permisos: 1=Gerente/Admin, 2=Panadero, 3=Cajero,
--           4=Almacenista, 5=Analista/Contador, 6=RRHH/Supervisor
-- ============================================================
CREATE TABLE IF NOT EXISTS CARGOS (
    Id_cargo     SERIAL       PRIMARY KEY,
    nombre_cargo VARCHAR(100) NOT NULL,
    descripcion  TEXT         NOT NULL,
    permisos     INT          NOT NULL
);

-- ============================================================
-- TABLA: EMPLEADOS
-- usuario: campo de login (separado del teléfono)
-- password: hash bcrypt
-- activo: 1=Activo, 0=Baja lógica
-- ============================================================
CREATE TABLE IF NOT EXISTS EMPLEADOS (
    Id_empleado        SERIAL        PRIMARY KEY,
    Id_cargo           INT           NOT NULL,
    Id_jefe_directo    INT,
    apellidos          VARCHAR(100)  NOT NULL,
    nombre             VARCHAR(100)  NOT NULL,
    telefono           VARCHAR(20)   NOT NULL,
    usuario            VARCHAR(50),
    fecha_contratacion DATE          NOT NULL,
    Sueldo             NUMERIC(10,2) NOT NULL,
    horas              INT           NOT NULL,
    password           VARCHAR(100)  NOT NULL,
    activo             SMALLINT      NOT NULL DEFAULT 1,
    fecha_baja         DATE,
    motivo_baja        TEXT
);

-- ============================================================
-- TABLA: CLIENTES
-- tipo_cliente: 1=Mayorista, 2=Minorista
-- ============================================================
CREATE TABLE IF NOT EXISTS CLIENTES (
    Id_cliente           SERIAL       PRIMARY KEY,
    nombre               VARCHAR(100) NOT NULL,
    tipo_cliente         SMALLINT     NOT NULL,
    porcentaje_descuento NUMERIC(5,2) NOT NULL
);

-- ============================================================
-- TABLA: PROVEEDORES
-- ============================================================
CREATE TABLE IF NOT EXISTS PROVEEDORES (
    Id_proveedor     SERIAL       PRIMARY KEY,
    nombre_proveedor VARCHAR(100) NOT NULL,
    direccion        VARCHAR(150) NOT NULL,
    numero_telefono  VARCHAR(20)  NOT NULL
);

-- ============================================================
-- TABLA: INVENTARIO
-- Almacena insumos (materia prima)
-- costo_unitario se actualiza con el motor ABC al registrar lote
-- stock_minimo: umbral para alertas de stock bajo
-- ============================================================
CREATE TABLE IF NOT EXISTS INVENTARIO (
    Id_inventario  SERIAL         PRIMARY KEY,
    stock_actual   NUMERIC(10,2)  NOT NULL DEFAULT 0,
    nombre_insumo  VARCHAR(100)   NOT NULL,
    unidad_medida  VARCHAR(20)    NOT NULL,
    costo_unitario NUMERIC(10,4)  NOT NULL DEFAULT 0,
    stock_minimo   NUMERIC(10,2)  NOT NULL DEFAULT 0
);

-- ============================================================
-- TABLA: MAQUINARIA
-- ============================================================
CREATE TABLE IF NOT EXISTS MAQUINARIA (
    Id_maquinaria SERIAL            PRIMARY KEY,
    nombre        VARCHAR(100)      NOT NULL,
    capacidad     VARCHAR(100)      NOT NULL,
    estado        estado_maquinaria NOT NULL
);

-- ============================================================
-- TABLA: PRODUCTOS
-- categoria: Pan Dulce, Pan Blanco, Repostería, Pastelería, Galletas, Otro
-- stock: unidades disponibles para venta en POS (separado de inventario)
-- ============================================================
CREATE TABLE IF NOT EXISTS PRODUCTOS (
    Id_producto        SERIAL        PRIMARY KEY,
    nombre             VARCHAR(100)  NOT NULL,
    categoria          VARCHAR(50)   NOT NULL,
    precio             NUMERIC(10,2) NOT NULL,
    tiempo_elaboracion INT           NOT NULL,
    activo             SMALLINT      NOT NULL DEFAULT 1,
    stock              INT           NOT NULL DEFAULT 0
);

-- ============================================================
-- TABLA: VENTAS
-- ============================================================
CREATE TABLE IF NOT EXISTS VENTAS (
    Id_venta           SERIAL        PRIMARY KEY,
    Id_cliente         INT           NOT NULL,
    Id_empleado        INT           NOT NULL,
    tipo_cliente       SMALLINT      NOT NULL,
    subtotal           NUMERIC(10,2) NOT NULL,
    Total_neto         NUMERIC(10,2) NOT NULL,
    descuento_aplicado NUMERIC(10,2) NOT NULL,
    iva                NUMERIC(10,2) NOT NULL,
    fecha              TIMESTAMP     NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLA: DETALLE_VENTAS
-- ============================================================
CREATE TABLE IF NOT EXISTS DETALLE_VENTAS (
    Id_detalle_venta SERIAL        PRIMARY KEY,
    Id_venta         INT           NOT NULL,
    Id_producto      INT           NOT NULL,
    cantidad         NUMERIC(10,2) NOT NULL,
    precio_unitario  NUMERIC(10,2) NOT NULL,
    total_fila       NUMERIC(10,2) NOT NULL
);

-- ============================================================
-- TABLA: EMPLEADOS_VENTAS
-- ============================================================
CREATE TABLE IF NOT EXISTS EMPLEADOS_VENTAS (
    Id_venta    INT NOT NULL,
    Id_empleado INT NOT NULL
);

-- ============================================================
-- TABLA: RECETAS
-- Rendimiento base del sistema: 10 piezas por lote
-- Los insumos en DETALLE_RECETA son para ese rendimiento base
-- ============================================================
CREATE TABLE IF NOT EXISTS RECETAS (
    Id_receta           SERIAL       PRIMARY KEY,
    Id_producto         INT          NOT NULL,
    nombre_receta       VARCHAR(100) NOT NULL,
    descripcion         TEXT         NOT NULL,
    tiempo_estimado     INT          NOT NULL,
    Proporciones_receta VARCHAR(200) NOT NULL
);

-- ============================================================
-- TABLA: COMPONENTES
-- Vincula insumos del inventario como componentes de producción
-- ============================================================
CREATE TABLE IF NOT EXISTS COMPONENTES (
    Id_componentes    SERIAL        PRIMARY KEY,
    Id_inventario     INT           NOT NULL,
    nombre_componente VARCHAR(100)  NOT NULL,
    cantidad_real     NUMERIC(10,2) NOT NULL
);

-- ============================================================
-- TABLA: DETALLE_RECETA
-- cantidad_unidad: cantidad del insumo para 10 piezas (base)
-- El backend escala proporcionalmente según la cantidad planificada
-- ============================================================
CREATE TABLE IF NOT EXISTS DETALLE_RECETA (
    Id_detalle_receta SERIAL        PRIMARY KEY,
    Id_receta         INT           NOT NULL,
    cantidad_unidad   NUMERIC(10,3) NOT NULL,
    Id_inventario     INT           NOT NULL
);

-- ============================================================
-- TABLA: PROCESO_ELABORACION
-- cantidad_lograda = 0 significa lote pendiente de registro
-- ============================================================
CREATE TABLE IF NOT EXISTS PROCESO_ELABORACION (
    Id_proceso        SERIAL        PRIMARY KEY,
    Id_detalle_receta INT           NOT NULL,
    Id_producto       INT           NOT NULL,
    Id_empleado       INT           NOT NULL,
    hora_inicio       TIME          NOT NULL,
    hora_fin          TIME          NOT NULL,
    tiempo_estimado   INT           NOT NULL DEFAULT 0,
    nombre_operacion  VARCHAR(100)  NOT NULL,
    descripcion       TEXT          NOT NULL,
    horas_trabajadas  NUMERIC(6,2)  NOT NULL DEFAULT 0,
    cantidad_estimada INT           NOT NULL,
    cantidad_lograda  INT           NOT NULL DEFAULT 0
);

-- ============================================================
-- TABLA: EMPLEADOS_PROCESO_ELABORACION
-- ============================================================
CREATE TABLE IF NOT EXISTS EMPLEADOS_PROCESO_ELABORACION (
    Id_empleado INT NOT NULL,
    Id_proceso  INT NOT NULL
);

-- ============================================================
-- TABLA: PRODUCCION
-- Historial de lotes completados con costo unitario ABC
-- ============================================================
CREATE TABLE IF NOT EXISTS PRODUCCION (
    Id_produccion      SERIAL        PRIMARY KEY,
    Id_producto        INT           NOT NULL,
    fecha_produccion   DATE          NOT NULL,
    hora_salida        TIME          NOT NULL,
    cantidad_producida INT           NOT NULL,
    costo              NUMERIC(10,4) NOT NULL
);

-- ============================================================
-- TABLA: USO_MAQUINARIA
-- ============================================================
CREATE TABLE IF NOT EXISTS USO_MAQUINARIA (
    Id_producto   INT NOT NULL,
    Id_proceso    INT NOT NULL,
    Id_maquinaria INT NOT NULL
);

-- ============================================================
-- TABLA: USO_COMPONENTES
-- Cantidad_real_usada: se actualiza al registrar el lote
-- Diferencia (estimado - real) = merma, se devuelve al inventario
-- ============================================================
CREATE TABLE IF NOT EXISTS USO_COMPONENTES (
    Id_producto           INT           NOT NULL,
    Id_proceso            INT           NOT NULL,
    Id_componente         INT           NOT NULL,
    Cantidad_real_usada   NUMERIC(10,4) NOT NULL,
    Cantidad_estimada_uso NUMERIC(10,4) NOT NULL
);

-- ============================================================
-- TABLA: COMPRA
-- ============================================================
CREATE TABLE IF NOT EXISTS COMPRA (
    Id_compras   SERIAL        PRIMARY KEY,
    Id_proveedor INT           NOT NULL,
    fecha        DATE          NOT NULL,
    descripcion  VARCHAR(100)  NOT NULL,
    sub_total    NUMERIC(10,2) NOT NULL,
    iva          NUMERIC(10,2) NOT NULL,
    total        NUMERIC(10,2) NOT NULL
);

-- ============================================================
-- TABLA: DETALLE_COMPRA
-- ============================================================
CREATE TABLE IF NOT EXISTS DETALLE_COMPRA (
    Id_detalle_compra SERIAL        PRIMARY KEY,
    Id_compra         INT           NOT NULL,
    Id_inventario     INT           NOT NULL,
    cantidad          NUMERIC(10,2) NOT NULL,
    precio            NUMERIC(10,2) NOT NULL,
    costo             NUMERIC(10,2) NOT NULL
);

-- ============================================================
-- TABLA: PROVEEDORES_COMPRAS
-- ============================================================
CREATE TABLE IF NOT EXISTS PROVEEDORES_COMPRAS (
    Id_compras   INT NOT NULL,
    Id_proveedor INT NOT NULL
);

-- ============================================================
-- TABLA: LOGS_ACTIVIDAD
-- Registra toda la actividad del sistema por módulo y usuario
-- accion: LOGIN, CREATE, UPDATE, DELETE, VENTA, COMPRA, PRODUCCION
-- modulo: auth, ventas, inventario, empleados, recetas,
--         produccion, proveedores, productos, reportes
-- ============================================================
CREATE TABLE IF NOT EXISTS LOGS_ACTIVIDAD (
    Id_log      SERIAL       PRIMARY KEY,
    Id_empleado INT          NOT NULL,
    accion      VARCHAR(50)  NOT NULL,
    modulo      VARCHAR(50)  NOT NULL,
    descripcion TEXT         NOT NULL,
    referencia  TEXT,
    fecha       TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_ventas_cliente     ON VENTAS (Id_cliente);
CREATE INDEX IF NOT EXISTS idx_ventas_empleado    ON VENTAS (Id_empleado);
CREATE INDEX IF NOT EXISTS idx_ventas_fecha       ON VENTAS (fecha);
CREATE INDEX IF NOT EXISTS idx_detalle_venta      ON DETALLE_VENTAS (Id_venta);
CREATE INDEX IF NOT EXISTS idx_detalle_producto   ON DETALLE_VENTAS (Id_producto);
CREATE INDEX IF NOT EXISTS idx_recetas_producto   ON RECETAS (Id_producto);
CREATE INDEX IF NOT EXISTS idx_detalle_receta     ON DETALLE_RECETA (Id_receta);
CREATE INDEX IF NOT EXISTS idx_detalle_inv        ON DETALLE_RECETA (Id_inventario);
CREATE INDEX IF NOT EXISTS idx_proceso_receta     ON PROCESO_ELABORACION (Id_detalle_receta);
CREATE INDEX IF NOT EXISTS idx_proceso_producto   ON PROCESO_ELABORACION (Id_producto);
CREATE INDEX IF NOT EXISTS idx_proceso_empleado   ON PROCESO_ELABORACION (Id_empleado);
CREATE INDEX IF NOT EXISTS idx_proceso_pendiente  ON PROCESO_ELABORACION (cantidad_lograda);
CREATE INDEX IF NOT EXISTS idx_produccion_prod    ON PRODUCCION (Id_producto);
CREATE INDEX IF NOT EXISTS idx_produccion_fecha   ON PRODUCCION (fecha_produccion);
CREATE INDEX IF NOT EXISTS idx_componentes_inv    ON COMPONENTES (Id_inventario);
CREATE INDEX IF NOT EXISTS idx_compra_prov        ON COMPRA (Id_proveedor);
CREATE INDEX IF NOT EXISTS idx_detalle_compra     ON DETALLE_COMPRA (Id_compra);
CREATE INDEX IF NOT EXISTS idx_detalle_comp_inv   ON DETALLE_COMPRA (Id_inventario);
CREATE INDEX IF NOT EXISTS idx_inventario_stock   ON INVENTARIO (stock_actual);
CREATE INDEX IF NOT EXISTS idx_empleados_cargo    ON EMPLEADOS (Id_cargo);
CREATE INDEX IF NOT EXISTS idx_empleados_usuario  ON EMPLEADOS (usuario);
CREATE INDEX IF NOT EXISTS idx_empleados_telefono ON EMPLEADOS (telefono);
CREATE INDEX IF NOT EXISTS idx_logs_empleado      ON LOGS_ACTIVIDAD (Id_empleado);
CREATE INDEX IF NOT EXISTS idx_logs_modulo        ON LOGS_ACTIVIDAD (modulo);
CREATE INDEX IF NOT EXISTS idx_logs_fecha         ON LOGS_ACTIVIDAD (fecha);