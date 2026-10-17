# ExpIA — Subproyecto 1: Catálogo y exploración de IA

**Fecha:** 2026-10-17
**Estado:** Aprobado en diseño conversacional, pendiente de revisión escrita

## 1. Propósito

ExpIA es un dashboard para **aprender y enseñar IA**. Sirve a perfiles técnicos (desarrolladores), no técnicos (negocio, producto, directivos) y estudiantes de cursos formales. Permite navegar los conceptos y herramientas de IA en una línea de tiempo, filtrarlos, entender qué hay que saber antes de cada uno (dependencias), para qué sirve y cómo se usa, y ver qué está tomando fuerza.

### Visión completa, descompuesta en subproyectos

| # | Subproyecto | Depende de |
|---|---|---|
| **1** | **Catálogo y exploración** (este documento) | — |
| 2 | Referentes: influencers y voces por tema y red social | 1 |
| 3 | Radar tecnológico: estados explorar/probar/adoptar/descartar, notas, multiusuario | 1 |
| 4 | Tendencias y resumen automático: un agente programado que propone nodos nuevos o cambios de estado como PRs | 1, 2 |
| 5 | Modo enseñanza: rutas de aprendizaje, cursos, progreso de estudiantes | 1 |

Cada subproyecto tiene su propia especificación, plan e implementación. Este documento cubre **solo el subproyecto 1**, y deja preparados los puntos de extensión de los demás.

### Criterios de éxito

- Un usuario puede abrir la línea de tiempo y ver unos 60 conceptos y herramientas ordenados por fecha.
- Puede filtrar por categoría, tipo, audiencia, nivel, estado, licencia, precio y rango de fechas, y compartir la vista filtrada por URL.
- En la ficha de cualquier nodo ve sus prerrequisitos en orden de aprendizaje, qué se apoya en él, para qué sirve y cómo se usa (con una versión técnica y otra no técnica).
- El dashboard muestra qué está "tomando fuerza".
- Un nodo con datos inválidos (dependencia inexistente, ciclo, categoría desconocida) rompe la compilación con un mensaje claro.

## 2. Enfoque técnico

- **Next.js (App Router)**, con todas las rutas generadas de forma estática. Despliegue en **Vercel**.
- **Contenido como archivos MDX** en el repo (`content/`), versionado en git. Sin base de datos en este subproyecto.
- **Tailwind CSS + shadcn/ui**, con modo oscuro.
- **Zod** para validar el contenido al compilar.
- **React Flow + dagre** para el grafo, **Fuse.js** para la búsqueda en el cliente.
- **Vitest** para pruebas unitarias y **Playwright** para *smoke tests*.

Motivo: separar el **contenido** (cambia poco, se cura y conviene versionarlo) del futuro **estado de usuario** (subproyectos 3 y 5, que usarán una base de datos aparte, probablemente Supabase). Los cambios propuestos por IA (subproyecto 4) llegan como PRs revisados por una persona.

## 3. Modelo de datos

### 3.1 Nodo — `content/nodes/<id>.mdx`

```yaml
---
id: rag                                   # requerido; igual al nombre del archivo
title: "RAG (Retrieval-Augmented Generation)"  # requerido
kind: concept                             # requerido: concept | tool | model | technique | protocol
category: [retrieval, llm-apps]           # requerido, ≥1; valores de taxonomy.yaml
released: 2020-05                         # requerido: YYYY | YYYY-MM | YYYY-MM-DD
origin: "Meta AI (Lewis et al.)"          # opcional
audience: [technical, business]           # requerido, ≥1: technical | business
level: intermediate                       # requerido: fundamentals | intermediate | advanced
requires: [llm, embeddings, vector-db]    # opcional; IDs de nodos; forma un grafo dirigido sin ciclos
related: [fine-tuning, long-context]      # opcional; IDs de nodos; sin orden de prerrequisito
status: mainstream                        # requerido: emerging | rising | mainstream | declining
license: open-source                      # opcional: open-source | proprietary
pricing: free                             # opcional: free | freemium | paid
links:                                    # opcional; todas las claves opcionales, valores URL
  docs: https://...
  paper: https://...
  repo: https://...
  site: https://...
summary: "Darle al LLM información externa en el momento de responder."  # requerido, ≤160 caracteres
verified: false                           # requerido; false hasta que una persona revise fechas y links
added: 2026-10-17                         # requerido: YYYY-MM-DD en que se agregó al catálogo (para "últimos agregados")
voices: []                                # opcional; IDs de content/people/ (subproyecto 2); no se muestra todavía
---

## Para qué sirve
## Cómo se usa
## Para no técnicos
```

Las tres secciones del cuerpo son obligatorias (las verifica el test de integridad).

### 3.2 Taxonomía — `content/taxonomy.yaml`

Lista cerrada de categorías con `id`, `label` (en español) y `color`. Lista inicial: `foundations`, `llm`, `llm-apps`, `agents`, `retrieval`, `vision`, `audio`, `generative-media`, `infra`, `protocols`, `frameworks`, `dev-tools`, `evaluation`, `safety`.

### 3.3 Reglas de integridad (fallan la compilación)

1. El frontmatter cumple el esquema Zod.
2. `id` coincide con el nombre del archivo y es único.
3. Todo ID en `requires` y `related` existe.
4. `requires` no forma ciclos (el error muestra el ciclo encontrado).
5. Toda `category` existe en la taxonomía.
6. El cuerpo contiene las tres secciones obligatorias.

Cada error indica el archivo y el campo.

### 3.4 Fechas imprecisas

`released` conserva su precisión (`year | month | day`). La UI nunca inventa precisión: un nodo con fecha de solo año se muestra en la línea de tiempo como una barra que abarca todo el año. Para ordenar, se usa el inicio del periodo.

## 4. Módulos

| Módulo | Responsabilidad | Depende de |
|---|---|---|
| `lib/content/schema.ts` | Esquemas Zod de nodo y taxonomía | zod |
| `lib/content/load.ts` | Lee `content/`, parsea el frontmatter y el MDX, valida y devuelve `Catalog` | schema, graph |
| `lib/graph.ts` | Funciones puras sobre el grafo de `requires`: `detectCycle`, `topoSort`, `getPrerequisites(id)` (transitivos, en orden de aprendizaje), `getDependents(id)`, `getLearningPath(targetId)` | — |
| `lib/filters.ts` | Tipo `Filters`, `parseFilters(searchParams)`, `serializeFilters`, `applyFilters(nodes, filters)` | — |
| `lib/dates.ts` | Parseo de `released` con precisión, comparación y formato | — |
| `components/` | UI: `NodeCard`, `FilterBar`, `Timeline`, `GraphView`, `PrereqTree`, `AudienceToggle` | lib |
| `app/` | Rutas (sección 5) | lib, components |

`lib/graph.ts`, `lib/filters.ts` y `lib/dates.ts` no dependen de Next.js ni de React, así que se prueban de forma aislada.

## 5. Vistas

| Ruta | Contenido |
|---|---|
| `/` | Dashboard: totales por categoría, "tomando fuerza" (nodos `emerging`/`rising` ordenados por fecha más reciente, máximo 8), últimos agregados (los 6 con `added` más reciente) y accesos a los nodos de nivel `fundamentals` |
| `/timeline` | Eje horizontal por año con zoom y desplazamiento. Carriles por `kind`, color por categoría primera. Fechas de solo año como barras. Clic en un nodo: abre la ficha |
| `/explore` | Cuadrícula de tarjetas, `FilterBar` con todos los filtros y búsqueda Fuse.js (título, resumen, categorías) |
| `/node/[id]` | Contenido MDX, `PrereqTree` (prerrequisitos transitivos ordenados), "qué se apoya en esto", relacionados, links y aviso si `verified: false` |
| `/graph` | Grafo React Flow con layout dagre. Clic en un nodo: resalta prerrequisitos y dependientes |

**Comportamiento transversal:**
- Los filtros viven en la URL (`?cat=agents&level=fundamentals&aud=business&from=2017`) y aplican en `/explore`, `/timeline` y `/graph`.
- `AudienceToggle` en la barra superior (Técnico / No técnico / Todos) se guarda en `localStorage`. La lectura va protegida con try/catch y, si falla, el valor por defecto es "Todos". En `/node/[id]` cambia el orden de las secciones: con audiencia "business", "Para no técnicos" aparece primero.
- Diseño *responsive*. La línea de tiempo y el grafo permiten desplazamiento horizontal propio en móvil.

## 6. Contenido semilla

Unos 60 nodos generados como borrador, todos con `verified: false`:

- **Fundamentos:** perceptrón, backpropagation, redes neuronales, deep learning, CNN, RNN/LSTM, embeddings, attention, Transformer, tokens/tokenización, fine-tuning, transfer learning.
- **Modelos:** GPT (familia), BERT, Claude, Llama, Gemini, Mistral, modelos de difusión, modelos multimodales, modelos de razonamiento.
- **Construir con IA:** prompting, context engineering, RAG, bases vectoriales, function calling / tool use, agentes, multiagente, MCP, evals, guardrails, RLHF, LoRA, cuantización.
- **Herramientas:** LangChain, LlamaIndex, Claude Agent SDK, Vercel AI SDK, OpenAI API, Anthropic API, Hugging Face, Ollama, vLLM, Cursor, Claude Code, GitHub Copilot, pgvector, Pinecone, Chroma, n8n, Stable Diffusion, Whisper.

## 7. Puntos de extensión (preparados, no construidos)

- `voices` en el nodo y el directorio vacío `content/people/` con un README del formato previsto (subproyecto 2).
- `getLearningPath(targetId)` en `lib/graph.ts` (subproyecto 5).
- Contenido y validación aptos para PRs automáticos: el test de integridad corre en CI (subproyecto 4).

## 8. Pruebas

- **Vitest:** `lib/graph.ts` (orden topológico, detección de ciclos con el ciclo reportado, prerrequisitos transitivos, dependientes), `lib/filters.ts` (ida y vuelta entre URL y objeto, combinación de filtros), `lib/dates.ts`, `lib/content/load.ts` con *fixtures* válidas e inválidas.
- **Test de integridad:** carga el `content/` real; corre en CI en cada PR (GitHub Actions).
- **Playwright:** *smoke test* por ruta (carga la página, aplica un filtro y comprueba que cambia el resultado, navega a una ficha y ve el árbol de prerrequisitos).

## 9. Fuera de alcance

Login y usuarios, radar personal o de equipo, mostrar referentes, agente automático o programado, cursos y progreso, edición desde la UI, internacionalización (la UI va solo en español).
