# ExpIA — Subproyecto 2: Referentes

**Fecha:** 2026-10-17
**Estado:** Aprobado en diseño conversacional, pendiente de revisión escrita
**Depende de:** Subproyecto 1 (`docs/superpowers/specs/2026-10-17-catalogo-ia-design.md`)

## 1. Propósito

Responder dos preguntas del pedido original: **quién está hablando de qué temas** y **qué referentes de YouTube y otras redes vale la pena seguir**. El resultado es un directorio curado de referentes de IA (personas y organizaciones), conectado a los conceptos del catálogo. Así el flujo de aprendizaje queda: entiendo el concepto → veo el mejor recurso para profundizar → descubro a quién seguir.

**Público:** el mismo del catálogo (perfiles técnicos, no técnicos y estudiantes), hispanohablante.

### Criterios de éxito

- `/people` lista unos 30 referentes, filtrables por tema, idioma, plataforma, audiencia, nivel y tipo, con los filtros en la URL.
- Cada perfil muestra por qué seguirle, sus redes y de 1 a 5 recursos destacados enlazados a los temas del catálogo.
- La ficha de cada nodo muestra "Quién habla de esto", con los recursos destacados sobre ese tema primero.
- Cada nodo de nivel `fundamentals` tiene al menos un referente (verificado por test).
- Un referente con datos inválidos (tema inexistente, sin plataformas, sin recursos) rompe la compilación con un mensaje claro.

### Decisiones tomadas

| Decisión | Elección | Motivo |
|---|---|---|
| Alcance | **Directorio curado ahora, actividad reciente preparada** | Lo valioso para aprender es la curación; la actividad reciente (APIs, cuotas, caducidad) pertenece al subproyecto 4 |
| Idiomas | **Mezcla inglés/español, marcada y filtrable** | Las fuentes clave están en inglés; el filtro sirve a quien solo lee español. Objetivo semilla: 60% inglés, 40% español |
| Dónde vive el vínculo persona ↔ tema | **En la persona (`topics`)** | Se cura por persona; agregar un referente toca un archivo. La ficha del nodo lo deriva al revés |

## 2. Enfoque técnico

Sin cambios de stack respecto al subproyecto 1: Next.js 15 estático, contenido en archivos MDX validados con Zod al compilar, Vitest y Playwright. Sin base de datos ni llamadas a APIs externas.

## 3. Modelo de datos

### 3.1 Referente — `content/people/<id>.mdx`

```yaml
---
id: andrej-karpathy                     # requerido; kebab-case; igual al nombre del archivo
name: "Andrej Karpathy"                 # requerido
kind: person                            # requerido: person | organization
languages: [en]                         # requerido, ≥1: en | es
topics: [llm, deep-learning, transformer]   # requerido, ≥1; IDs de nodos existentes
audience: [technical]                   # requerido, ≥1: technical | business
level: intermediate                     # requerido: fundamentals | intermediate | advanced (nivel típico de su contenido)
summary: "Explica LLMs desde cero con código."   # requerido, ≤160 caracteres
platforms:                              # requerido, ≥1 clave; valores URL
  youtube: https://...
  x: https://...
  linkedin: https://...
  github: https://...
  blog: https://...
  podcast: https://...
  newsletter: https://...
  site: https://...
highlights:                             # requerido, 1–5 elementos
  - title: "Let's build GPT: from scratch, in code, spelled out"   # requerido
    url: https://...                    # requerido, URL
    format: video                       # requerido: video | course | article | thread | podcast | book | repo
    topic: transformer                  # opcional; ID de nodo existente
    language: en                        # opcional: en | es; por defecto, el primero de `languages`
feeds:                                  # opcional; NO se usa ni se muestra en este subproyecto (lo leerá el subproyecto 4)
  youtubeChannelId: "UC..."
  rss: https://...
verified: false                         # requerido
added: 2026-10-17                       # requerido: YYYY-MM-DD
---

## Por qué seguirle
```

`## Por qué seguirle` es la única sección del cuerpo y es obligatoria. Igual que en los nodos, no se permiten títulos `##` desconocidos ni duplicados.

### 3.2 Cambio al esquema de nodos

- **Se retira el campo `voices`** del frontmatter de los nodos (subproyecto 1, sección 3.1). Hoy está vacío en los 61 nodos. El vínculo vive ahora en `topics` de cada referente. Si algún nodo lo declara, el esquema estricto lo rechaza.

### 3.3 Reglas de integridad (fallan la compilación)

1. El frontmatter del referente cumple el esquema Zod (estricto, sin campos desconocidos).
2. `id` coincide con el nombre del archivo y es único.
3. Todo ID en `topics` y en `highlights[].topic` existe en el catálogo.
4. Entre 1 y 5 `highlights`; al menos una clave en `platforms`.
5. El cuerpo tiene `## Por qué seguirle` y ningún otro título `##`.
6. **Cobertura:** cada nodo con `level: fundamentals` aparece en los `topics` de al menos un referente. Lo verifica un test de integridad del contenido real, no el cargador: así un catálogo de prueba sin referentes sigue siendo válido.

Cada error indica el archivo y el campo, con el mismo formato que el catálogo (`people/<archivo>.mdx › <campo>: <mensaje>`).

## 4. Módulos

| Módulo | Responsabilidad | Cambio |
|---|---|---|
| `lib/content/enums.ts` | Añade `LANGUAGES`, `PLATFORMS`, `PERSON_KINDS`, `HIGHLIGHT_FORMATS` y sus etiquetas en español | Modificado |
| `lib/content/schema.ts` | Añade `personFrontmatterSchema`; retira `voices` de `nodeFrontmatterSchema` | Modificado |
| `lib/content/sections.ts` | Generaliza `splitSections` para recibir el conjunto de títulos válidos (nodos: 3; personas: 1) | Modificado |
| `lib/content/load.ts` | `loadCatalog` carga también `content/people/` (si existe) y valida contra los nodos; `Catalog` gana `people` y `peopleById` | Modificado |
| `lib/people.ts` | Funciones puras: `getVoicesForTopic(people, nodeId, audiencePref)` (orden: recursos sobre el tema primero; con audiencia "business", primero `audience` business), `getHighlightsForTopic(people, nodeId)`, `findUncoveredFundamentals(nodes, people)` | Nuevo |
| `lib/filters.ts` | Exporta `matchAny`/`matchOptional`; añade `PeopleFilters`, `parsePeopleFilters`, `serializePeopleFilters`, `applyPeopleFilters` con las mismas reglas (OR dentro de un grupo, AND entre grupos) | Modificado |
| `hooks/use-url-filters.ts` | Se generaliza para recibir funciones de parse/serialize, de modo que nodos y personas compartan el mecanismo (estado local + `history.replaceState`) | Modificado |
| `components/` | `PersonCard`, `PeopleFilterBar`, `PeopleClient`, `VoicesForTopic`, `PlatformLinks`, `HighlightList` | Nuevos |
| `app/people/page.tsx`, `app/people/[id]/page.tsx` | Rutas nuevas | Nuevos |
| `app/node/[id]/page.tsx`, `app/page.tsx`, `components/site-header.tsx` | Integración (sección 5) | Modificados |

## 5. Vistas

| Ruta | Contenido |
|---|---|
| `/people` | Cuadrícula de `PersonCard` (nombre, resumen, idiomas, íconos de plataformas, hasta 4 chips de temas). Filtros: tema (lista de nodos con búsqueda), idioma, plataforma, audiencia, nivel, tipo; búsqueda por nombre y resumen. Estado vacío con "Limpiar filtros" |
| `/people/[id]` | Encabezado (nombre, tipo, idiomas, nivel, enlaces a cada plataforma), aviso si `verified: false`, "Por qué seguirle", recursos destacados (título enlazado, formato, idioma, tema enlazado a su ficha), temas como enlaces al catálogo |
| `/node/[id]` | Nueva sección lateral "Quién habla de esto": primero los recursos destacados con `topic` igual a este nodo (título, autor, formato, idioma), luego los referentes con este nodo en `topics` como mini-tarjetas (máximo 6) y el enlace "Ver todos los referentes de <título>" → `/people?topic=<id>`. Si no hay referentes, la sección no se muestra |
| `/` | Estadística "Referentes" y bloque "Referentes para empezar": referentes con `level: fundamentals`, en español primero, máximo 6 |
| Cabecera | Enlace "Referentes" entre "Explorar" y "Mapa" |

**URL de filtros de personas:** `topic`, `lang`, `platform`, `aud`, `level`, `kind` (listas separadas por comas) y `q`. Los valores desconocidos se ignoran, igual que en el catálogo.

## 6. Contenido semilla

Unos 30 referentes, objetivo 60% inglés y 40% español, todos con `verified: false`.

- **Candidatos en inglés:** Andrej Karpathy, 3Blue1Brown, Simon Willison, DeepLearning.AI, fast.ai, Sebastian Raschka, Chip Huyen, Lilian Weng, Jay Alammar, StatQuest, Two Minute Papers, Yannic Kilcher, AI Explained, Hugging Face, Latent Space, Hamel Husain, Ethan Mollick, Lex Fridman.
- **Candidatos en español:** DotCSV, Platzi, Xavier Mitjana, Jon Hernández, Ringa Tech, midudev, y otros que se validen al redactar.
- **Regla:** solo se incluye un referente, plataforma o recurso si hay certeza de que existe y la URL es correcta; ante la duda se omite el enlace (o el referente). La lista final puede diferir de los candidatos.
- **Cobertura:** la lista final debe cumplir la regla 6 de integridad (cada fundamento con al menos un referente). Se busca, sin exigirlo por test, que cada fundamento tenga también un referente en español.

## 7. Pruebas

- **Vitest:**
  - Esquema de personas (campos obligatorios, límites de `highlights`, URLs).
  - Cargador con *fixtures*: tema inexistente, `highlights[].topic` inexistente, sin plataformas, más de 5 recursos, sección faltante o desconocida, `voices` en un nodo rechazado.
  - `lib/people.ts`: orden por recursos sobre el tema y por audiencia, y fundamentos sin cubrir.
  - Filtros de personas: ida y vuelta con la URL, valores inválidos, combinación de grupos.
  - Integridad del contenido real, incluida la cobertura de fundamentos.
- **Playwright:**
  - `/people` carga y filtra por idioma (la URL refleja `lang=es`).
  - `/people?topic=rag` muestra solo referentes con RAG.
  - Un perfil muestra recursos destacados.
  - La ficha de un nodo fundamental muestra "Quién habla de esto".

## 8. Puntos de extensión

- `feeds` (`youtubeChannelId`, `rss`) queda en el esquema para que el subproyecto 4 obtenga la actividad reciente sin cambiarlo.
- `getVoicesForTopic` servirá al modo enseñanza (subproyecto 5) para sugerir a quién seguir en cada paso de una ruta.

## 9. Fuera de alcance

Actividad reciente o feeds en vivo, métricas de seguidores, valoraciones o comentarios de usuarios, referentes enviados por usuarios, país o región, precio de los recursos.
