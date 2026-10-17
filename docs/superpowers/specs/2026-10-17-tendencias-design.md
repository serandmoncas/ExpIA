# ExpIA — Subproyecto 4: Tendencias y revisión tecnológica automática

**Fecha:** 2026-10-17
**Estado:** Aprobado en diseño conversacional, pendiente de revisión escrita
**Depende de:** Subproyecto 1 (`2026-10-17-catalogo-ia-design.md`) y subproyecto 2 (`2026-10-17-referentes-design.md`)

## 1. Propósito

Responder dos preguntas del pedido original: **qué hay nuevo tomando fuerza** y **un módulo para hacer revisión tecnológica**. El resultado es un agente programado que, cada semana, lee fuentes curadas, decide qué es relevante para el catálogo y abre un pull request con dos cosas:

1. Un **informe semanal** publicado en el sitio (`/radar`).
2. **Propuestas de cambio** ya aplicadas al contenido: cambios de `status` de nodos, nodos nuevos, recursos destacados nuevos para referentes y feeds de YouTube faltantes.

Una persona revisa y mergea el PR. El agente nunca publica directamente.

**Público:** el mismo del catálogo. El informe se escribe en español.

### Criterios de éxito

- Un workflow semanal de GitHub Actions abre un PR con la etiqueta `radar` cuando hay ítems relevantes, y no abre nada cuando no los hay.
- Toda URL citada en el informe o en una propuesta proviene de las fuentes leídas esa semana. El modelo no puede introducir URLs propias.
- El PR pasa `npm test`. Si no pasa, se abre como borrador con el error en la descripción.
- `/radar` y `/radar/[week]` muestran los informes; el dashboard muestra "Esta semana en IA"; las fichas de nodo muestran "Menciones recientes".
- El costo por ejecución ronda los $0.30 USD y nunca supera la entrada máxima fijada (150 ítems).
- El pipeline se prueba sin red ni llamadas a la API.

### Decisiones tomadas

| Decisión | Elección | Motivo |
|---|---|---|
| Salida | **Informe semanal + propuestas aplicadas, en el mismo PR** | El informe da contexto a las propuestas, y revisar un diff real es más rápido que aplicar sugerencias a mano |
| Fuentes | **Feeds de referentes + `content/sources.yaml` curado**, sin búsqueda abierta en la web | Fuentes conocidas y reproducibles; el modelo no puede citar lo que no recibió |
| Arquitectura | **Script TypeScript en el repo, cron de GitHub Actions**: fases deterministas de descarga y filtrado, una sola llamada a Claude con salida estructurada y validación posterior | Reusa el cargador y los esquemas del sitio; sin infraestructura nueva; el 95% del pipeline es probable sin red |

## 2. Enfoque técnico

- Mismo stack del sitio (Next.js estático, MDX validado con Zod, Vitest, Playwright).
- Nuevas dependencias: `@anthropic-ai/sdk` (llamada al modelo), `tsx` (ejecutar el script) y un parser de RSS/Atom ligero (`fast-xml-parser`).
- El sitio no llama a ninguna API externa: los informes son archivos MDX que se compilan como el resto del contenido.

## 3. Modelo de datos

### 3.1 Fuentes — `content/sources.yaml`

```yaml
sources:
  - id: openai-news                # requerido; kebab-case; único; distinto de los IDs de referentes
    name: OpenAI News              # requerido; nombre que muestra el sitio
    kind: rss                      # rss | hackernews | github
    url: https://openai.com/news/rss.xml
  - id: hackernews-ai
    name: Hacker News
    kind: hackernews               # API de Algolia (hn.algolia.com)
    minPoints: 200                 # requerido para hackernews
    keywords: [LLM, GPT, Claude, Gemini, "AI agent", RAG, diffusion]
  - id: github-ai
    name: GitHub
    kind: github                   # API de búsqueda de GitHub: repos creados en los últimos 7 días
    minStars: 300                  # requerido para github
    topics: [llm, ai-agents, rag, generative-ai]
```

Además de esta lista, el script lee automáticamente las fuentes de los referentes (el blog de un referente va en su `feeds.rss`, no en `sources.yaml`, para que sus ítems queden atribuidos a él y puedan proponerse como recursos destacados): `feeds.rss` y `feeds.youtubeChannelId` (convertido en `https://www.youtube.com/feeds/videos.xml?channel_id=<id>`).

**Nota sobre GitHub:** se usa la API de búsqueda (`created:>fecha stars:>=N topic:X`) en lugar de raspar la página de *trending*, que no tiene API y cambia sin aviso.

### 3.2 Informe — `content/radar/<YYYY-MM-DD>.mdx`

El nombre del archivo es la fecha de ejecución y sirve de identificador de la semana.

```yaml
---
week: 2026-10-23                   # requerido; igual al nombre del archivo
from: 2026-10-16                   # requerido; inicio de la ventana (7 días)
sourcesChecked: 34                 # requerido; fuentes consultadas con éxito
items:                             # 0–15
  - title: "..."                   # requerido
    url: https://...               # requerido; URL
    source: hackernews-ai          # requerido; id de la fuente o del referente
    publishedAt: 2026-10-20        # requerido; YYYY-MM-DD
    topics: [rag, agents]          # requerido, ≥1; IDs de nodos existentes
    relevance: high                # requerido: high | medium
    summary: "..."                 # requerido; ≤280 caracteres; español
proposals:                         # 0–N, con los topes de 3.3
  - type: status                   # status | new-node | highlight | feeds
    target: mcp                    # id del nodo o del referente afectado
    from: emerging                 # solo para status
    to: rising                     # solo para status
    reason: "..."                  # requerido; español
    evidence: [https://...]        # requerido, ≥1; URLs presentes en items de entrada
generated:
  by: radar-agent                  # radar-agent | manual
  model: claude-opus-5-5           # opcional si by = manual
  at: 2026-10-23T13:00:00Z
---

## Resumen de la semana
```

`## Resumen de la semana` es la única sección del cuerpo y es obligatoria.

No hay archivo de estado: para deduplicar, el script lee las URLs de todos los informes anteriores.

### 3.3 Propuestas y cómo se aplican

| Tipo | Efecto en el PR | Tope por semana |
|---|---|---|
| `status` | Edita solo la línea `status:` del nodo. Solo pasa al estado adyacente en `emerging → rising → mainstream → declining` (un paso, hacia adelante o atrás) | 5 |
| `new-node` | Crea `content/nodes/<id>.mdx` con frontmatter completo, las tres secciones obligatorias y `verified: false`. `requires` y `related` deben apuntar a nodos existentes | 3 |
| `highlight` | Agrega un recurso destacado a un referente. Solo si tiene menos de 5 y la URL no está ya | 5 |
| `feeds` | Completa `feeds.youtubeChannelId` de un referente con YouTube que no lo tiene. Lo resuelve el script leyendo la página del canal, no el modelo | Sin tope |

Si no hay nada que valga la pena, no se rellena: un informe puede tener menos de 15 ítems y ninguna propuesta.

### 3.4 Reglas de integridad (fallan la compilación)

1. `sources.yaml` cumple su esquema; los `id` son únicos y no chocan con IDs de referentes.
2. Cada informe cumple el esquema Zod estricto; `week` coincide con el nombre del archivo.
3. Todo ID en `items[].topics` existe en el catálogo. Todo `target` existe: un nodo para `status` y `new-node` (el nodo nuevo ya está creado en el mismo PR) y un referente para `highlight` y `feeds`.
4. `items[].source` es el id de una fuente o de un referente.
5. El cuerpo tiene `## Resumen de la semana` y ningún otro título `##`.

Formato de error igual al resto: `radar/<archivo>.mdx › items.3.topics: <mensaje>`.

## 4. Pipeline — `scripts/radar/`

Se ejecuta con `npx tsx scripts/radar/run.ts` (opción `--dry-run`: no escribe archivos, imprime el resultado).

| Paso | Módulo | ¿LLM? | Responsabilidad |
|---|---|---|---|
| 1 | reusa `loadCatalog` + `loadSources` | No | Cargar catálogo, referentes, informes previos y `sources.yaml` |
| 2 | `fetch-sources.ts` | No | Descargar cada fuente con tiempo límite (10 s) y un reintento. Una fuente que falla se registra y se omite; no aborta la ejecución |
| 3 | `collect.ts` | No | Normalizar a `RawItem { title, url, source, publishedAt, excerpt }`, filtrar a los últimos 7 días, quitar URLs ya vistas en informes previos, normalizar URLs (sin parámetros `utm_*`, sin `#`). Si quedan más de 150, descartar los más antiguos |
| 4 | `resolve-feeds.ts` | No | Para referentes con `platforms.youtube` y sin `youtubeChannelId`, obtener el ID del canal leyendo la página; genera propuestas `feeds` |
| 5 | `judge.ts` | **Sí** | Una llamada a Claude con los ítems y la lista de nodos (id, título, status, resumen) y los referentes (id, temas, número de recursos). Devuelve ítems seleccionados, resumen y propuestas |
| 6 | `validate.ts` | No | Validar con Zod y con reglas propias; descartar (no corregir) lo inválido y registrar el motivo |
| 7 | `apply.ts` | No | Escribir el informe y aplicar las propuestas a los archivos. Idempotente |
| 8 | workflow | No | `npm test`, crear rama y abrir el PR |

### 4.1 Llamada al modelo (`judge.ts`)

- SDK oficial `@anthropic-ai/sdk`, modelo `claude-opus-5-5`, `output_config.effort: "medium"` explícito.
- Salida estructurada con `messages.parse` y el esquema Zod de la respuesta. No se usan herramientas ni bucle de agente.
- Respaldo ante rechazos activado (`fallbacks: "default"`, beta `server-side-fallback-2026-07-01`). Si la cadena completa termina en `stop_reason: "refusal"`, la ejecución falla sin PR.
- El cliente se inyecta como parámetro para poder probar con un cliente falso.
- Las instrucciones piden: criterio de relevancia para el público de ExpIA, resúmenes en español neutro, no inventar fuentes, preferir no proponer a proponer con poca evidencia.

### 4.2 Validación (`validate.ts`)

- **Regla anti-invención:** toda URL en `items[].url` y en `proposals[].evidence` debe estar en la lista de entrada. Si no, el ítem o la propuesta se descarta.
- IDs de nodos y referentes existentes; `status` solo un paso; topes de 3.3 (se conservan los primeros de la lista).
- Un `new-node` cuyo id ya existe se descarta; su contenido debe pasar `nodeFrontmatterSchema` y la comprobación de secciones.
- Los descartes se listan en la descripción del PR ("Propuestas descartadas por validación").

### 4.3 Workflow — `.github/workflows/radar.yml`

- Disparadores: `schedule` los viernes a las 13:00 UTC (8:00 en Colombia) y `workflow_dispatch`.
- Permisos: `contents: write`, `pull-requests: write`. Usa el `GITHUB_TOKEN` del workflow.
- Secreto: `ANTHROPIC_API_KEY`. Si falta, el script termina con código de error y mensaje claro, sin escribir nada.
- Rama `radar/<YYYY-MM-DD>`; PR con etiqueta `radar`, título `Radar IA — semana del <fecha>` y descripción con el resumen, los cambios aplicados y los descartes.
- Si `npm test` falla, el PR se abre como **borrador** con la salida del error. Si no hubo ítems relevantes ni propuestas `feeds`, no se abre PR.

## 5. Módulos del sitio

| Módulo | Responsabilidad | Cambio |
|---|---|---|
| `lib/content/enums.ts` | `RELEVANCES`, `PROPOSAL_TYPES`, `SOURCE_KINDS` y etiquetas en español | Modificado |
| `lib/content/schema.ts` | `radarFrontmatterSchema`, `sourcesSchema` | Modificado |
| `lib/content/sections.ts` | `RADAR_SECTION_HEADINGS` | Modificado |
| `lib/content/load.ts` | Carga `content/radar/` (si existe) y `sources.yaml` (si existe); `Catalog` gana `reports` (más reciente primero) y `sources` | Modificado |
| `lib/radar.ts` | Funciones puras: `getLatestReport`, `getTopItems(report, n)`, `getMentionsForTopic(reports, nodeId, limit=3)`, `isAdjacentStatus(from, to)` | Nuevo |
| `scripts/radar/*` | Pipeline (sección 4) | Nuevo |
| `components/` | `ReportItemCard`, `ProposalList`, `RecentMentions`, `ThisWeekBlock` | Nuevos |
| `app/radar/page.tsx`, `app/radar/[week]/page.tsx` | Rutas nuevas | Nuevos |
| `app/node/[id]/page.tsx`, `app/page.tsx`, `components/site-header.tsx` | Integración (sección 6) | Modificados |

## 6. Vistas

| Ruta | Contenido |
|---|---|
| `/radar` | Archivo de informes, el más reciente primero: semana, número de ítems y de cambios, primeras líneas del resumen. Estado vacío si no hay informes |
| `/radar/[week]` | Resumen de la semana; ítems agrupados por relevancia (título enlazado, fuente, fecha, resumen, temas enlazados al catálogo); lista de cambios aplicados con su motivo y evidencia; aviso si `generated.by: manual` |
| `/` | Bloque "Esta semana en IA": hasta 3 ítems `high` del último informe y enlace al informe. No se muestra si no hay informes |
| `/node/[id]` | "Menciones recientes": hasta 3 ítems de los informes que incluyen el nodo en `topics`, más reciente primero. No se muestra si no hay |
| Cabecera | Enlace "Radar" después de "Referentes" |

## 7. Contenido semilla

- `content/sources.yaml` con unas 10–15 fuentes verificadas (blogs de laboratorios y referentes con RSS, Hacker News y GitHub).
- Un informe semilla escrito a mano (`generated.by: manual`) con ítems reales y verificados, para que el sitio tenga contenido desde el día uno y como *fixture* de E2E.
- Regla de siempre: solo URLs con certeza de que existen; ante la duda, se omiten.

## 8. Pruebas

- **Vitest (sin red ni API):**
  - Esquemas de informe y fuentes: obligatorios, topes, URLs, fechas, `week` igual al archivo.
  - Cargador con *fixtures*: tema inexistente, fuente inexistente, sección faltante, `sources.yaml` ausente (válido).
  - `collect`: RSS y Atom de *fixture*, ventana de 7 días, deduplicación contra informes previos, normalización de URLs, recorte a 150.
  - `fetch-sources`: una fuente que falla no aborta (con `fetch` inyectado).
  - `resolve-feeds`: extrae el ID de canal de un HTML de *fixture*.
  - `validate`: URL de evidencia ausente en la entrada, salto de `status` de dos pasos, IDs inexistentes, topes, `new-node` con id existente.
  - `apply`: cambia solo la línea `status`, crea un nodo válido, respeta el máximo de 5 recursos, idempotencia (dos ejecuciones = mismo resultado).
  - `judge`: con un cliente falso que devuelve JSON fijo; verifica modelo, esfuerzo y manejo de `refusal`.
  - `lib/radar.ts`: menciones por tema, ítems principales, adyacencia de estados.
  - Integridad del contenido real (informe semilla y `sources.yaml`).
- **Playwright:**
  - `/radar` lista el informe semilla.
  - `/radar/[week]` muestra ítems y cambios.
  - El dashboard muestra "Esta semana en IA".
  - La ficha de un nodo mencionado en el informe semilla muestra "Menciones recientes".

## 9. Costos y límites

- Entrada estimada ~25K tokens ($4/M) y salida ~10K ($20/M): **~$0.30 por semana**, unos $1.30 al mes.
- El recorte a 150 ítems acota el costo máximo.
- La llamada real no se ejecuta en CI ni en las pruebas.

## 10. Fuera de alcance

Búsqueda abierta en la web, notificaciones (correo, Slack), puntuación de tendencias con historial o gráficas, edición de texto ya escrito por parte del agente, borrado de nodos o referentes, merge automático.
