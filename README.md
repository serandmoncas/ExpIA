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

## Agregar un referente

Cada referente es un archivo `content/people/<id>.mdx`. Copia uno existente (por ejemplo `andrej-karpathy.mdx`), ajusta el frontmatter (`topics` con IDs de nodos, `platforms`, de 1 a 5 `highlights`) y escribe la sección `## Por qué seguirle`. `npm test` valida que los temas existan y que cada concepto de nivel fundamentos tenga al menos un referente.

## Hoja de ruta

1. **Catálogo y exploración** (este repo)
2. **Referentes** por tema y red social (este repo)
3. Radar tecnológico personal y de equipo
4. Tendencias y resumen automático (agente que propone PRs)
5. **Modo enseñanza**: rutas de aprendizaje con repaso y progreso local (este repo; cuentas y cursos llegan con el 3)

Especificación: `docs/superpowers/specs/2026-10-17-catalogo-ia-design.md`

## Rutas de aprendizaje

Las rutas curadas viven en `content/paths/<id>.mdx`: `title`, `audience`, `goal`, `after` (ruta que se asume hecha, opcional) y de 3 a 12 `steps` con `node` y una `note` opcional. `npm test` comprueba que cada paso aparezca después de sus prerrequisitos (o en la ruta `after`) y que sus nodos tengan al menos 2 preguntas de repaso (`review` en el frontmatter del nodo). Además, cada nodo tiene una ruta generada en `/learn/<id>`.

## Radar semanal

Cada viernes, el workflow `Radar IA` (`.github/workflows/radar.yml`) lee las fuentes de `content/sources.yaml` y los feeds de los referentes, le pide a Claude que elija lo relevante y abre un PR con el informe (`content/radar/<fecha>.mdx`) y los cambios propuestos al catálogo. Nada se publica hasta que alguien mergea el PR.

**Configuración (una vez):**

1. Crea una llave en [console.anthropic.com](https://console.anthropic.com) y guárdala como secreto del repositorio `ANTHROPIC_API_KEY` (Settings › Secrets and variables › Actions).
2. En Settings › Actions › General, activa "Allow GitHub Actions to create and approve pull requests".
3. Lanza la primera ejecución a mano desde la pestaña Actions › Radar IA › Run workflow.

**En local:**

```bash
npx tsx scripts/radar/run.ts --collect-only   # qué se recolectaría, sin llamar al modelo
ANTHROPIC_API_KEY=... npx tsx scripts/radar/run.ts --dry-run   # informe completo sin escribir archivos
```

**Agregar una fuente:** si es el blog de un referente, va en su `feeds.rss`, así sus ítems quedan atribuidos a esa persona. Si no, agrégala a `content/sources.yaml` (`rss`, `hackernews` o `github`) y verifica con `--collect-only` que aparece sin errores.

**Nota:** los PR abiertos con el `GITHUB_TOKEN` del workflow no disparan el workflow de CI; el radar corre `npm test` por su cuenta y abre el PR como borrador si falla. La vista previa de Vercel sí se genera.
