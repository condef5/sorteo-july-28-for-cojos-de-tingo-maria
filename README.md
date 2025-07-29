# Instrucciones para Ejecutar los Scripts

Este proyecto contiene varios scripts en TypeScript para procesar datos. **Todos los scripts son dependientes entre sí y deben ejecutarse en el orden indicado** para obtener resultados correctos.

Además, este proyecto utiliza [Bun](https://bun.sh/) como entorno de ejecución. Si no tienes Bun instalado, puedes hacerlo siguiendo las instrucciones oficiales:
```bash
curl -fsSL https://bun.sh/install | bash
```

## Requisitos Previos

1. **Node.js**: Asegúrate de tener Node.js instalado. Puedes descargarlo desde [nodejs.org](https://nodejs.org/).
2. **Instalar dependencias**: Si el proyecto tiene un archivo `package.json`, ejecuta:
   ```bash
   bun install
   ```

## Ejecución de los Scripts

Los scripts deben ejecutarse en el siguiente orden, ya que cada uno depende de la salida del anterior:

1. `bun run 1-parse-messages.ts data/wp_chat_from_2025.txt`
2. `bun run 2-filter-messages-per-day.ts ./output/first/messages.json`
3. `bun run 3-create-stats.ts output/second/filter-events.json`
4. `bun run 4-csv-converter.ts output/third/player-ranking.json`

> **Nota:** Cambia los nombres de los archivos de entrada si tus datos tienen otro nombre o ubicación.

### Ejemplo de ejecución paso a paso:
```bash
bun run 1-parse-messages.ts data/wp_chat_from_2025.txt
bun run 2-filter-messages-per-day.ts ./output/first/messages.json
bun run 3-create-stats.ts output/second/filter-events.json
bun run 4-csv-converter.ts output/third/player-ranking.json
```

> **Nota:** Si tus scripts requieren argumentos adicionales, revisa el código fuente o la documentación interna de cada archivo para más detalles.

## Estructura de Carpetas
- `data/`: Archivos de entrada o datos sin procesar.
- `output/`: Resultados generados por los scripts.

## Contacto
Para dudas o soporte, contacta con el desarrollador del proyecto.
