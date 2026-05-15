-- ============================================================
--  BASE DE DATOS: panaderia
--  Motor: PostgreSQL
--  Versión: Final con todos los cambios
--  Ejecutar DESPUÉS de 01_tablas.sql
--  Comando: psql -U admin -d panaderia -h localhost -f 02_relaciones.sql
-- ============================================================

-- ============================================================
-- TABLA: EMPLEADOS
-- Depende de: CARGOS, EMPLEADOS (autorreferencia jefe)
-- ============================================================
ALTER TABLE EMPLEADOS
    ADD CONSTRAINT fk_empleados_cargo
        FOREIGN KEY (Id_cargo) REFERENCES CARGOS (Id_cargo),
    ADD CONSTRAINT fk_empleados_jefe
        FOREIGN KEY (Id_jefe_directo) REFERENCES EMPLEADOS (Id_empleado);

-- ============================================================
-- TABLA: VENTAS
-- Depende de: CLIENTES, EMPLEADOS
-- ============================================================
ALTER TABLE VENTAS
    ADD CONSTRAINT fk_ventas_cliente
        FOREIGN KEY (Id_cliente) REFERENCES CLIENTES (Id_cliente),
    ADD CONSTRAINT fk_ventas_empleado
        FOREIGN KEY (Id_empleado) REFERENCES EMPLEADOS (Id_empleado);

-- ============================================================
-- TABLA: DETALLE_VENTAS
-- Depende de: VENTAS, PRODUCTOS
-- ============================================================
ALTER TABLE DETALLE_VENTAS
    ADD CONSTRAINT fk_detalle_ventas_venta
        FOREIGN KEY (Id_venta) REFERENCES VENTAS (Id_venta),
    ADD CONSTRAINT fk_detalle_ventas_producto
        FOREIGN KEY (Id_producto) REFERENCES PRODUCTOS (Id_producto);

-- ============================================================
-- TABLA: EMPLEADOS_VENTAS
-- Depende de: VENTAS, EMPLEADOS
-- ============================================================
ALTER TABLE EMPLEADOS_VENTAS
    ADD CONSTRAINT fk_empventas_venta
        FOREIGN KEY (Id_venta) REFERENCES VENTAS (Id_venta),
    ADD CONSTRAINT fk_empventas_empleado
        FOREIGN KEY (Id_empleado) REFERENCES EMPLEADOS (Id_empleado);

-- ============================================================
-- TABLA: RECETAS
-- Depende de: PRODUCTOS
-- ============================================================
ALTER TABLE RECETAS
    ADD CONSTRAINT fk_recetas_producto
        FOREIGN KEY (Id_producto) REFERENCES PRODUCTOS (Id_producto);

-- ============================================================
-- TABLA: COMPONENTES
-- Depende de: INVENTARIO
-- ============================================================
ALTER TABLE COMPONENTES
    ADD CONSTRAINT fk_componentes_inventario
        FOREIGN KEY (Id_inventario) REFERENCES INVENTARIO (Id_inventario);

-- ============================================================
-- TABLA: DETALLE_RECETA
-- Depende de: RECETAS, INVENTARIO
-- ============================================================
ALTER TABLE DETALLE_RECETA
    ADD CONSTRAINT fk_detalle_receta_receta
        FOREIGN KEY (Id_receta) REFERENCES RECETAS (Id_receta),
    ADD CONSTRAINT fk_detalle_receta_inventario
        FOREIGN KEY (Id_inventario) REFERENCES INVENTARIO (Id_inventario);

-- ============================================================
-- TABLA: PROCESO_ELABORACION
-- Depende de: DETALLE_RECETA, PRODUCTOS, EMPLEADOS
-- ============================================================
ALTER TABLE PROCESO_ELABORACION
    ADD CONSTRAINT fk_proceso_detalle_receta
        FOREIGN KEY (Id_detalle_receta) REFERENCES DETALLE_RECETA (Id_detalle_receta),
    ADD CONSTRAINT fk_proceso_producto
        FOREIGN KEY (Id_producto) REFERENCES PRODUCTOS (Id_producto),
    ADD CONSTRAINT fk_proceso_empleado
        FOREIGN KEY (Id_empleado) REFERENCES EMPLEADOS (Id_empleado);

-- ============================================================
-- TABLA: EMPLEADOS_PROCESO_ELABORACION
-- Depende de: EMPLEADOS, PROCESO_ELABORACION
-- ============================================================
ALTER TABLE EMPLEADOS_PROCESO_ELABORACION
    ADD CONSTRAINT fk_empproceso_empleado
        FOREIGN KEY (Id_empleado) REFERENCES EMPLEADOS (Id_empleado),
    ADD CONSTRAINT fk_empproceso_proceso
        FOREIGN KEY (Id_proceso) REFERENCES PROCESO_ELABORACION (Id_proceso);

-- ============================================================
-- TABLA: PRODUCCION
-- Depende de: PRODUCTOS
-- ============================================================
ALTER TABLE PRODUCCION
    ADD CONSTRAINT fk_produccion_producto
        FOREIGN KEY (Id_producto) REFERENCES PRODUCTOS (Id_producto);

-- ============================================================
-- TABLA: USO_MAQUINARIA
-- Depende de: PRODUCTOS, PROCESO_ELABORACION, MAQUINARIA
-- ============================================================
ALTER TABLE USO_MAQUINARIA
    ADD CONSTRAINT fk_uso_maquinaria_producto
        FOREIGN KEY (Id_producto) REFERENCES PRODUCTOS (Id_producto),
    ADD CONSTRAINT fk_uso_maquinaria_proceso
        FOREIGN KEY (Id_proceso) REFERENCES PROCESO_ELABORACION (Id_proceso),
    ADD CONSTRAINT fk_uso_maquinaria_maquinaria
        FOREIGN KEY (Id_maquinaria) REFERENCES MAQUINARIA (Id_maquinaria);

-- ============================================================
-- TABLA: USO_COMPONENTES
-- Depende de: PRODUCTOS, PROCESO_ELABORACION, COMPONENTES
-- ============================================================
ALTER TABLE USO_COMPONENTES
    ADD CONSTRAINT fk_uso_componentes_producto
        FOREIGN KEY (Id_producto) REFERENCES PRODUCTOS (Id_producto),
    ADD CONSTRAINT fk_uso_componentes_proceso
        FOREIGN KEY (Id_proceso) REFERENCES PROCESO_ELABORACION (Id_proceso),
    ADD CONSTRAINT fk_uso_componentes_componente
        FOREIGN KEY (Id_componente) REFERENCES COMPONENTES (Id_componentes);

-- ============================================================
-- TABLA: COMPRA
-- Depende de: PROVEEDORES
-- ============================================================
ALTER TABLE COMPRA
    ADD CONSTRAINT fk_compra_proveedor
        FOREIGN KEY (Id_proveedor) REFERENCES PROVEEDORES (Id_proveedor);

-- ============================================================
-- TABLA: DETALLE_COMPRA
-- Depende de: COMPRA, INVENTARIO
-- ============================================================
ALTER TABLE DETALLE_COMPRA
    ADD CONSTRAINT fk_detalle_compra_compra
        FOREIGN KEY (Id_compra) REFERENCES COMPRA (Id_compras),
    ADD CONSTRAINT fk_detalle_compra_inventario
        FOREIGN KEY (Id_inventario) REFERENCES INVENTARIO (Id_inventario);

-- ============================================================
-- TABLA: PROVEEDORES_COMPRAS
-- Depende de: COMPRA, PROVEEDORES
-- ============================================================
ALTER TABLE PROVEEDORES_COMPRAS
    ADD CONSTRAINT fk_provscompras_compra
        FOREIGN KEY (Id_compras) REFERENCES COMPRA (Id_compras),
    ADD CONSTRAINT fk_provscompras_proveedor
        FOREIGN KEY (Id_proveedor) REFERENCES PROVEEDORES (Id_proveedor);

-- ============================================================
-- TABLA: LOGS_ACTIVIDAD
-- Depende de: EMPLEADOS
-- ============================================================
ALTER TABLE LOGS_ACTIVIDAD
    ADD CONSTRAINT fk_log_empleado
        FOREIGN KEY (Id_empleado) REFERENCES EMPLEADOS (Id_empleado);