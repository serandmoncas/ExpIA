# ExpIA — Subproyecto 5a: Modo enseñanza (rutas de aprendizaje)

**Fecha:** 2026-10-17
**Estado:** Aprobado en diseño conversacional, pendiente de revisión escrita
**Depende de:** Subproyecto 1 (`docs/superpowers/specs/2026-10-17-catalogo-ia-design.md`) y subproyecto 2 (`docs/superpowers/specs/2026-10-17-referentes-design.md`)

## 1. Propósito

Convertir el catálogo en algo que se pueda **estudiar en orden**: rutas de aprendizaje con una meta, pasos ordenados según los prerrequisitos, preguntas de repaso en cada paso y referentes sugeridos para profundizar. El progreso de cada persona se guarda en su navegador.

**Público:** las tres audiencias del pedido original.

- **Autodidactas:** usan las rutas directamente.
- **Quien enseña:** comparte el enlace de una ruta como temario.
- **Equipos:** comparten el enlace de una ruta como onboarding.

Lo que necesitan estas dos últimas audiencias (cuentas, asignar rutas, ver el avance de otros) queda para **5b**, que se construye junto con el subproyecto 3 sobre lo de aquí, sin cambiarlo.

### Criterios de éxito

- `/paths` lista 4 rutas curadas, ordenadas según la preferencia de audiencia, cada una con su progreso.
- Cada ruta curada muestra los pasos en un orden que respeta `requires`. Si un paso está antes que uno de sus prerrequisitos, la compilación se rompe con un mensaje claro.
- Cada uno de los 61 nodos tiene una ruta generada `/learn/<id>` con sus prerrequisitos en orden de aprendizaje.
- Cada uno de los 61 nodos trae de 2 a 3 preguntas de repaso, con la respuesta oculta hasta que la persona decide verla.
- Marcar un nodo como aprendido se refleja en todas las rutas que lo contienen y en su ficha, y se mantiene al recargar.
- El sitio sigue siendo estático: sin servidor, cuentas ni base de datos.

### Decisiones tomadas

| Decisión | Elección | Motivo |
|---|---|---|
| Alcance | **5a: rutas y progreso local; 5b (cuentas, cursos, avance de otros) junto con el subproyecto 3** | Las rutas sirven a las tres audiencias. Lo que exige cuentas es la infraestructura del subproyecto 3 |
| Origen de las rutas | **Híbrido: 4 curadas a mano y una generada del grafo por cada nodo** | Lo curado aporta el criterio pedagógico en las metas grandes; lo generado da cobertura total sin escribir nada |
| Completar un paso | **Autoevaluación: preguntas con la respuesta oculta y "Lo aprendí"** | La práctica de recuperación fija más que releer. Sin cuentas, un puntaje no tendría valor |
| Cobertura de preguntas | **Los 61 nodos en esta entrega** | Cualquier ruta, curada o generada, tiene repaso en todos sus pasos |
| Qué se marca | **El nodo (el concepto), no el paso de una ruta** | Lo aprendido en una ruta cuenta en todas. En 5b pasa tal cual a `usuario × nodo` |

## 2. Enfoque técnico

Se mantiene el mismo stack: Next.js SSG, contenido en MDX y validación con Zod al cargar.

- Las rutas curadas y las generadas son páginas estáticas.
- El progreso es lo único que vive en el cliente. Se lee de `localStorage` después de hidratar, con el mismo patrón que ya usa la preferencia de audiencia (`lib/audience.ts`).
- Las rutas generadas reutilizan `getLearningPath` (`lib/graph.ts`). El subproyecto 1 la dejó lista y hasta ahora no tenía uso.

## 3. Modelo de datos

### 3.1 Preguntas de repaso en el nodo

Es un campo **opcional** nuevo en el frontmatter de `content/nodes/<id>.mdx`:

```yaml
review:
  - question: "¿Por qué un modelo MoE necesita memoria para todos sus parámetros si solo usa unos pocos?"
    answer: "Porque el enrutador puede elegir cualquier experto en cada token, así que todos deben estar cargados aunque cada paso calcule con pocos."
```

- Cada nodo lleva de 2 a 3 preguntas.
- `question` admite hasta 200 caracteres y `answer` hasta 400.
- La respuesta sale solo de lo que dice la ficha del nodo, en "Para qué sirve", "Cómo se usa" o "Para no técnicos". No se agrega información que la ficha no tenga.
- El campo es opcional en el esquema, así que un nodo sin `review` sigue cargando. Es lo que pasa con los nodos que propone el radar del subproyecto 4. Su paso muestra "Sin preguntas de repaso aún".

### 3.2 Ruta curada: `content/paths/<id>.mdx`

```yaml
---
id: construir-un-agente
title: Construir un agente
audience: [technical]
goal: "Entender y construir un agente que use herramientas"
after: construir-con-llms        # opcional: ruta que se asume hecha
steps:
  - node: agents
    note: "Fíjate en cómo el modelo decide cuándo llamar a una herramienta."
  - node: mcp
---

Introducción breve: para quién es la ruta y qué te llevas al terminarla.
```

| Campo | Regla |
|---|---|
| `id` | kebab-case, igual al nombre del archivo |
| `title` | obligatorio |
| `audience` | uno o más de `technical`, `business` |
| `goal` | obligatorio, hasta 160 caracteres |
| `after` | opcional: id de otra ruta |
| `steps` | de 3 a 12 pasos; cada uno con `node` (id de un nodo) y una `note` opcional de hasta 280 caracteres |
| cuerpo | texto introductorio sin títulos `##` |

### 3.3 Reglas de integridad (si fallan, la compilación se rompe)

1. Cada `steps[].node` existe en el catálogo y no se repite dentro de la ruta.
2. **Orden:** cada `requires` directo de un paso aparece antes en la ruta, o en la cadena de rutas `after`. Como todos los pasos cumplen esto, el orden queda garantizado en toda la cadena.
3. `after` apunta a una ruta existente, y la cadena de `after` no forma ciclos.
4. Todo nodo que aparece en una ruta curada tiene al menos 2 preguntas en `review`.
5. Los ids de las rutas son únicos.

Los mensajes de error nombran la ruta, el paso y lo que falta. Por ejemplo: `construir-un-agente: "claude-agent-sdk" requiere "anthropic-api", que no aparece antes ni en la ruta "construir-con-llms"`.

### 3.4 Ruta generada

No se guarda en ningún archivo. Se calcula en la compilación con `getLearningPath(nodos, meta)`: los prerrequisitos en orden topológico, seguidos de la meta. No lleva notas.

### 3.5 Progreso

- Se guarda en `localStorage`, en la clave `expia.learned`, como un arreglo JSON de ids de nodos.
- Al leer:
  - un JSON corrupto o un valor que no sea arreglo se trata como vacío;
  - los ids que no existen en el catálogo se ignoran (por ejemplo, de un nodo renombrado);
  - los duplicados se eliminan.
- Si el almacenamiento está bloqueado, el progreso vive en memoria durante la visita y la página funciona igual.

## 4. Módulos

| Módulo | Responsabilidad |
|---|---|
| `lib/content/schema.ts` | `reviewSchema` dentro del nodo; `pathFrontmatterSchema` |
| `lib/content/load.ts` | Carga `content/paths/*.mdx` y aplica las reglas 3.3; `Catalog` incorpora `paths` |
| `lib/paths.ts` | Funciones puras: `resolveAfterChain`, `checkPathOrder`, `pathProgress`, `nextStep`, `pathsContaining`, `orderPathsForAudience` |
| `lib/learned.ts` | `readLearned`, `writeLearned`, `toggleLearned` (puras, con el almacenamiento inyectado) |
| `components/use-learned.ts` | Hook cliente: estado, persistencia y sincronización entre pestañas (evento `storage`) |
| `components/learned-toggle.tsx` | Botón "Lo aprendí" / "✓ Aprendido" |
| `components/review-questions.tsx` | Preguntas con la respuesta en `<details>` ("Ver respuesta"), sin depender de JavaScript |
| `components/path-step.tsx` | Un paso: número, nodo (título, nivel y resumen), nota, repaso, referentes y botón |
| `components/path-progress.tsx` | Barra "N de M" (cliente) |
| `components/continue-learning.tsx` | Bloque de la portada: "Sigue aprendiendo" |

## 5. Vistas

- **`/paths`**
  - Muestra las rutas curadas como tarjetas, con título, meta, audiencia, número de pasos y progreso. Se ordenan según la preferencia de audiencia.
  - Al final, una línea indica que cualquier ficha permite "Aprender desde cero".
- **`/paths/[id]`**
  - Arriba, la introducción. Si la ruta tiene `after`, aparece un aviso "Esta ruta asume *X*" con el progreso de esa ruta y un enlace.
  - Luego, los pasos (`path-step`). El primer paso sin marcar se destaca como "Siguiente".
  - Cada paso muestra hasta 2 referentes, según `getVoicesForTopic` y la preferencia de audiencia.
- **`/learn/[id]`**
  - Encabezado "Aprender *título* desde cero" y los mismos componentes de paso, sin notas.
  - Hay una página por nodo, generada con `generateStaticParams`.
- **Ficha del nodo (`/node/[id]`)** agrega:
  - el botón "Lo aprendí" y las preguntas de repaso;
  - un enlace "Aprender desde cero (N pasos)", si el nodo tiene prerrequisitos;
  - una línea "Aparece en: …" con las rutas curadas que lo contienen.
- **Portada:** el bloque "Sigue aprendiendo".
  - Si hay una ruta empezada y sin terminar, muestra su siguiente paso. Si hay varias, muestra la de mayor progreso.
  - Si no hay ninguna empezada, muestra las 4 rutas.
- **Encabezado del sitio:** un enlace nuevo "Rutas".

Antes de hidratar, el HTML estático se muestra sin marcas ✓ y sin progreso. Las marcas aparecen al leer `localStorage`, para que no haya diferencias de hidratación.

## 6. Contenido semilla

### 6.1 Rutas curadas

Cumplen la regla 2 con los `requires` actuales.

| Ruta | Audiencia | `after` | Pasos |
|---|---|---|---|
| `fundamentos` | technical, business | — | machine-learning → neural-network → backpropagation → deep-learning → rnn-lstm → embeddings → attention → tokenization → transformer → llm |
| `ia-para-tu-negocio` | business | fundamentos | prompting → claude → chain-of-thought → reasoning-models → tool-use → agents → n8n → evals → guardrails |
| `construir-con-llms` | technical | fundamentos | prompting → claude → anthropic-api → tool-use → structured-outputs → vector-db → rag → evals |
| `construir-un-agente` | technical | construir-con-llms | agents → mcp → context-engineering → claude-agent-sdk → agent-skills → multi-agent → guardrails |

Las notas por paso se escriben solo donde ayudan. En `fundamentos`, por ejemplo, para que quien viene de negocio sepa con qué idea quedarse en los pasos más técnicos (`backpropagation`, `rnn-lstm`, `attention`).

### 6.2 Preguntas de repaso

Son 2 o 3 por nodo en los 61 nodos, entre 120 y 180 en total. Se entregan en varios commits por categoría para que se puedan revisar por partes. Si la ficha de un nodo no da para una buena pregunta, se anota en el PR en lugar de inventar contenido.

## 7. Pruebas

- **Unitarias (`lib/paths.ts`, `lib/learned.ts`):**
  - un paso antes de su prerrequisito;
  - un prerrequisito cubierto por `after`, también en una cadena de dos niveles;
  - un ciclo entre rutas;
  - un nodo inexistente;
  - un paso repetido;
  - progreso y siguiente paso: vacío, parcial y completo;
  - orden según la audiencia;
  - lectura de progreso corrupto, con ids desconocidos o con duplicados;
  - almacenamiento que lanza error.
- **Carga:** fixtures que rompen cada regla 3.3 y el esquema de `review` (cantidad y largo).
- **Integridad del contenido real:**
  - las 4 rutas cargan;
  - los 61 nodos tienen de 2 a 3 preguntas;
  - toda ruta generada termina en su meta.
- **E2E (Playwright):**
  1. `/paths` → una ruta → "Lo aprendí" → recargar: la marca persiste.
  2. El mismo nodo aparece marcado en otra ruta y en su ficha.
  3. "Ver respuesta" muestra la respuesta.
  4. `/learn/rag` lista sus prerrequisitos antes de `rag`.

## 8. Puntos de extensión (5b y subproyecto 3)

- El progreso por nodo pasa a una tabla `usuario × nodo` sin cambiar su forma. `useLearned` cambia de fuente (de `localStorage` a la API) y mantiene su interfaz.
- Un "curso" o una asignación a un equipo es una ruta curada más un grupo de personas. El avance de cada persona se calcula con `pathProgress`, que ya existe.
- Al iniciar sesión, el progreso local podrá importarse a la cuenta.

## 9. Fuera de alcance

- Cuentas, grupos y ver el avance de otras personas (5b).
- Exportar e importar el progreso.
- Repetición espaciada.
- Crear o editar rutas desde la interfaz.
- Quizzes calificados.
- Que el radar escriba preguntas de repaso para los nodos que propone.
