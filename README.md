# Instrucciones para Ejecutar los Scripts

Este proyecto contiene varios scripts en TypeScript para procesar datos. **Todos los scripts son dependientes entre sí y deben ejecutarse en el orden indicado** para obtener resultados correctos.

Además, este proyecto utiliza [Bun](https://bun.sh/) como entorno de ejecución. Si no tienes Bun instalado, puedes hacerlo siguiendo las instrucciones oficiales:
```bash
curl -fsSL https://bun.sh/install | bash
```

## Requisitos Previos

1. **Node.js**: Asegúrate de tener Node.js instalado. Puedes descargarlo desde [nodejs.org](https://nodejs.org/).
2. **Instalar dependencias**: Ejecuta lo siguiente para instalar todas las dependencias definidas en `package.json`:
   ```bash
   bun install
   ```

## Ejecución de los Scripts

Para ejecutar todo el flujo de procesamiento, simplemente usa el script automatizado:

```bash
./run_all.sh
```

Esto ejecutará todos los scripts en orden, asegurando que cada uno reciba la salida correcta del anterior. Si necesitas cambiar los archivos de entrada, edita el archivo `run_all.sh`.

> **Nota:** Si tus scripts requieren argumentos adicionales, revisa el código fuente o la documentación interna de cada archivo para más detalles.

## Estructura de Carpetas
- `data/`: Archivos de entrada o datos sin procesar.
- `output/`: Resultados generados por los scripts.

## Contacto
Para dudas o soporte, contacta con el desarrollador del proyecto.
