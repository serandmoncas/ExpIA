# ExpIA

Dashboard para aprender y enseñar IA: conceptos y herramientas en una línea de tiempo, con filtros, dependencias, explicaciones técnicas y no técnicas, y lo que está tomando fuerza.

## Desarrollo

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # unit + integridad del contenido
npm run test:e2e   # smoke tests con Playwright
```

## Agregar o editar contenido

Cada concepto o herramienta es un archivo `content/nodes/<id>.mdx`. Copia uno existente, ajusta el frontmatter y escribe las tres secciones obligatorias (`## Para qué sirve`, `## Cómo se usa`, `## Para no técnicos`). Las categorías válidas están en `content/taxonomy.yaml`.

`npm test` valida todo el contenido: dependencias inexistentes, ciclos, categorías desconocidas o secciones faltantes hacen fallar el test con el archivo y el campo exactos. Cuando revises fechas y links de un nodo, cambia `verified: false` a `true`.

## Hoja de ruta

1. **Catálogo y exploración** (este repo)
2. Referentes por tema y red social
3. Radar tecnológico personal y de equipo
4. Tendencias y resumen automático (agente que propone PRs)
5. Modo enseñanza: rutas, cursos y progreso

Especificación: `docs/superpowers/specs/2026-10-17-catalogo-ia-design.md`
