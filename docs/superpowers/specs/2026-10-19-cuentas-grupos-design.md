# ExpIA — Subproyecto 5b, spec 1: Cuentas y grupos

**Fecha:** 2026-10-19
**Estado:** Aprobado en diseño conversacional, pendiente de revisión escrita
**Depende de:** Subproyecto 5a (`docs/superpowers/specs/2026-10-17-modo-ensenanza-design.md`)

## 1. Propósito

Que varias personas puedan **guiar grupos de alumnos** sobre las rutas de ExpIA. Cada guía crea sus grupos, invita a sus alumnos, les asigna rutas y ve cómo avanzan. Los alumnos guardan su avance en una cuenta en vez de solo en el navegador.

**Público:** guías (profesores, facilitadores, líderes de equipo) y sus alumnos. El sitio sigue siendo **cerrado**: nadie se registra solo, siempre entra por una invitación.

Lo público no cambia. El catálogo, los referentes, el radar semanal y las rutas siguen estáticos y abiertos, y sin iniciar sesión el avance sigue en el navegador como en 5a.

### Criterios de éxito

- Un correo autorizado por el administrador entra como guía, crea un grupo y genera un enlace de invitación.
- Un alumno abre ese enlace, inicia sesión con Google o con un enlace mágico y queda dentro del grupo.
- El guía asigna una ruta curada o generada, y ve en `/guia/[grupo]` una tabla con el avance de cada alumno en cada ruta asignada.
- El alumno marca "Lo aprendí" con sesión iniciada y el avance se guarda en el servidor. La primera vez puede traer el avance que ya tenía en el navegador.
- Un guía no puede ver, invitar ni asignar en un grupo ajeno. Si lo intenta, recibe 404.
- Un enlace vencido, revocado o sin usos disponibles no deja entrar a nadie, ni siquiera con dos canjes simultáneos por el último uso.

### Decisiones tomadas

| Tema | Decisión | Por qué |
|---|---|---|
| Para quién | **Sitio cerrado, por invitación, con varios guías** | Pone a prueba el uso real (enseñar) sin los riesgos de un registro abierto |
| División | **Spec 1: cuentas y grupos. Spec 2: rutas propias del guía. Spec 3: radar personal y de grupo** | Cada spec termina en algo usable. La spec 1 ya sirve para dar un curso con las rutas que existen |
| Roles | **Administrador (por variable de entorno), guía (por invitación del administrador), alumno (por invitación de un guía)** | Una misma persona puede ser guía y alumno a la vez |
| Invitaciones | **Enlace con vencimiento y límite de usos, o lista de correos** | El enlace es cómodo; la lista da control cuando hace falta |
| Qué se asigna | **Solo rutas existentes: curadas y generadas** | Las rutas propias del guía traen texto de terceros y van en la spec 2 |
| Qué ve el guía | **Solo el avance en las rutas que asignó** | Menos dato personal expuesto y alcanza para enseñar |
| Stack | **Neon (Postgres) + Drizzle + Better Auth + Resend** | Los permisos quedan en TypeScript y se prueban con Vitest y PGlite, igual que el resto |

## 2. Enfoque técnico

Se mantiene Next.js. Las páginas actuales siguen generándose en el build. Las páginas nuevas se generan en el servidor en cada visita.

- **Base de datos:** Postgres en Neon, instalado desde el Marketplace de Vercel. Esquema y consultas con Drizzle. Migraciones con `drizzle-kit`, aplicadas en el build antes de publicar. Los despliegues de vista previa (los PR) usan una rama de Neon propia, para que una migración en revisión nunca toque la base de datos de producción.
- **Inicio de sesión:** Better Auth, con sus tablas en la misma base de datos. Proveedores: Google y enlace mágico por correo.
- **Correo:** Resend, instalado desde el Marketplace de Vercel, para los enlaces mágicos y las invitaciones por correo.
- **Pruebas:** PGlite (Postgres en WebAssembly) dentro de Vitest, con el mismo esquema y las mismas migraciones que producción.

## 3. Modelo de datos

### 3.1 Tablas de Better Auth

`user`, `session`, `account` y `verification`, con los nombres y columnas de Better Auth. A `user` se le agrega `is_guide` (booleano, por defecto `false`).

### 3.2 Tablas propias

| Tabla | Columnas | Restricciones |
|---|---|---|
| `learned` | `user_id`, `node_id` (texto), `learned_at` | Clave primaria (`user_id`, `node_id`) |
| `groups` | `id`, `name`, `guide_id`, `created_at`, `archived_at` (nulo si está activo) | `name` de 1 a 80 caracteres, texto plano |
| `memberships` | `group_id`, `user_id`, `joined_at` | Clave primaria (`group_id`, `user_id`) |
| `invites` | `id`, `group_id`, `kind` (`link` o `email`), `token_hash`, `email` (solo si `kind = email`), `expires_at`, `max_uses` (nulo = sin límite), `uses`, `revoked_at`, `created_by`, `created_at` | `token_hash` único |
| `assignments` | `id`, `group_id`, `path_ref` (texto), `due_date` (opcional), `created_at` | Único por (`group_id`, `path_ref`) |
| `guide_invites` | `email`, `created_at`, `used_at` | `email` único, guardado en minúsculas |

### 3.3 Reglas

1. **Nadie se registra solo.** Antes de crear un usuario, un *hook* de Better Auth llama a `mayRegister`. El registro se acepta solo si se cumple una de estas condiciones:
   - el correo está en `ADMIN_EMAILS`;
   - el correo tiene un `guide_invites` sin usar;
   - la sesión trae una invitación de grupo válida para ese correo.
2. **El administrador no se guarda en la base de datos.** Se decide comparando el correo con `ADMIN_EMAILS`.
3. **El contenido no tiene claves foráneas.** `node_id` y `path_ref` son texto, porque el contenido vive en git.
   - Un nodo que sale del catálogo conserva sus filas en `learned` y no se muestra.
   - `path_ref` toma la forma `curated:<id>` o `generated:<nodo>`. La spec 2 agregará `guide:<id>`.
   - Asignar una ruta valida que `path_ref` exista en el catálogo del build actual.
4. **El token del enlace no se guarda.** Se generan 32 bytes aleatorios y solo se guarda su hash SHA-256. El enlace es `/unirse/<token>`.
5. **El canje es atómico.** Se valida y se descuenta en una sola sentencia: `UPDATE invites SET uses = uses + 1 WHERE … AND (max_uses IS NULL OR uses < max_uses) RETURNING`. Si no devuelve fila, el canje falla. La membresía se crea en la misma transacción.
6. **El vencimiento por defecto es de 14 días.** El guía puede elegir otro de 1 a 90 días.
7. **El guía ve solo lo asignado.** El avance de un alumno en un grupo se calcula con `pathProgress` para cada ruta asignada, cruzada con su `learned`. El guía nunca recibe la lista completa de lo que el alumno marcó.

## 4. Flujos

### 4.1 Alumno que llega por enlace

1. Abre `/unirse/<token>`. Si el enlace venció, fue revocado o se agotó, ve "Este enlace ya no es válido. Pídele uno nuevo a tu guía." y nada más.
2. Si es válido, ve el nombre del grupo y del guía, y los botones para entrar con Google o con un enlace al correo.
3. Al volver con la sesión iniciada, se canjea la invitación (regla 5) y entra a `/cuenta`.
4. Si ya tenía cuenta, solo se suma al grupo. Si ya era miembro, el canje no descuenta un uso.

### 4.2 Alumno invitado por correo

El guía pega una lista de correos (hasta 50 por vez). Cada correo recibe, vía Resend, un enlace `/unirse/<token>` de un solo uso. El canje exige que el correo de la sesión coincida con el de la invitación. Si no coincide, el alumno ve "Esta invitación es para a\*\*\*@dominio.com".

### 4.3 El avance al iniciar sesión

- **Primera vez:** si el navegador tiene avance local, se ofrece "Traer tu avance de este navegador (N nodos)". Importar une lo local con lo del servidor y no borra nada. Después de importar, o si la persona lo descarta, la oferta no vuelve a aparecer en ese navegador.
- **Con sesión:** "Lo aprendí" actualiza la interfaz al instante y guarda en el servidor. Si el servidor falla, la marca vuelve atrás y aparece un aviso.
- **Sin sesión:** todo funciona como en 5a.

### 4.4 Guía

- `/guia`: sus grupos activos y archivados, y el botón para crear uno.
- `/guia/[grupo]`:
  - **Invitar:** generar un enlace (vencimiento y máximo de usos), ver los enlaces vigentes con sus usos, revocarlos, o pegar una lista de correos.
  - **Asignar:** elegir una ruta curada o buscar un nodo para usar su ruta generada, con fecha opcional. Quitar una asignación.
  - **Avance:** una tabla con un alumno por fila y una ruta asignada por columna. Cada celda muestra "N de M" y "Completada" cuando corresponde.
  - **Alumnos:** quitar a un alumno del grupo.
  - **Grupo:** renombrarlo y archivarlo. Un grupo archivado no acepta canjes nuevos.

### 4.5 Alumno en su cuenta

`/cuenta` muestra sus grupos, con las rutas asignadas, su avance en cada una y la fecha si la hay. Desde ahí puede salir de un grupo y cerrar la sesión.

### 4.6 Administrador

`/admin` permite autorizar un correo como guía, ver la lista de guías y quitarle el rol a uno. Quitar el rol archiva sus grupos y no borra nada.

### 4.7 Casos borde

- Si el enlace se agota mientras alguien inicia sesión, esa persona ve el mensaje de enlace no válido y no se crea su cuenta.
- Si un alumno sale de un grupo o el guía lo quita, el guía deja de ver su avance. El alumno conserva lo que aprendió.
- Si una ruta asignada deja de existir en el catálogo, la columna se muestra como "Ruta no disponible" y el guía puede quitarla.

## 5. Módulos

| Archivo | Responsabilidad | Depende de |
|---|---|---|
| `lib/db/schema.ts` | Tablas con Drizzle | — |
| `lib/db/client.ts` | Conexión: Neon en producción, PGlite en pruebas | `schema` |
| `lib/access.ts` | Reglas puras: `isAdmin`, `mayRegister`, `canViewGroup`, `canManageGroup` | Solo los datos que recibe |
| `lib/invites.ts` | Crear, listar, revocar y canjear invitaciones | `db`, `access` |
| `lib/groups.ts` | Crear, renombrar y archivar grupos; quitar miembros; asignar rutas | `db`, `access`, catálogo |
| `lib/progress.ts` | Leer y marcar `learned`, importar el avance local y armar la tabla del guía | `db`, `lib/paths.ts` |
| `lib/auth.ts` | Configuración de Better Auth y el *hook* de registro | `db`, `access` |
| `app/api/auth/[...all]/route.ts` | Rutas de Better Auth | `auth` |
| `app/api/learned/route.ts` | GET (lista), POST (marcar o desmarcar), POST `/import` | `progress`, sesión |
| `components/learned-provider.tsx` | Elige la fuente (`localStorage` o la API) según la sesión. Su interfaz (`learned`, `ready`, `toggle`) no cambia | API |

Las páginas dinámicas (`/entrar`, `/unirse/[token]`, `/cuenta`, `/guia`, `/guia/[grupo]`, `/admin`) cargan los datos, preguntan a `access` y responden. No contienen reglas de permisos propias.

El encabezado muestra "Entrar" o el nombre de la persona leyendo la sesión desde el cliente, para que las páginas estáticas sigan siéndolo.

## 6. Seguridad

- **Autorización:** toda página y API dinámica pasa por `lib/access.ts`. Pedir un grupo ajeno, o uno que no existe, responde 404 en ambos casos.
- **Secretos:** `DATABASE_URL`, `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `RESEND_API_KEY` y `ADMIN_EMAILS` viven solo en las variables de entorno de Vercel y en `.env.local` (ignorado por git). Nunca en el repo ni en el chat. Las credenciales de Google las crea y carga el dueño del proyecto.
- **Texto del guía:** el nombre del grupo se valida con Zod (texto plano, de 1 a 80 caracteres) y React lo escapa al mostrarlo.
- **Correo:** máximo 5 enlaces mágicos por correo por hora y 100 invitaciones por guía por día.
- **Login de prueba:** existe solo con `NODE_ENV=test`. En cualquier otro entorno su ruta responde 404, y un test lo verifica.

## 7. Pruebas

### 7.1 Unitarias (Vitest + PGlite)

- `access.ts`: cada regla con sus casos permitidos y negados, incluida una persona que es guía y alumna a la vez.
- `mayRegister`: acepta un administrador, un correo de `guide_invites` y una invitación válida; rechaza cualquier otro caso.
- Canje: enlace válido, vencido, revocado, agotado, de un grupo archivado, invitación por correo con un correo distinto, alumno que ya era miembro, y **dos canjes en paralelo por el último uso** (solo uno entra).
- Grupos: un guía no puede leer, invitar, asignar ni quitar alumnos en un grupo ajeno.
- Asignaciones: rechaza un `path_ref` que no existe en el catálogo; la tabla del guía muestra "Ruta no disponible" si la ruta desaparece.
- Avance: marcar, desmarcar, importar uniendo con lo existente, y conservar un `node_id` que ya no está en el catálogo.
- El token nunca se guarda en texto plano.

### 7.2 E2E (Playwright)

Con el login de prueba:

1. El administrador autoriza a un guía.
2. El guía crea un grupo, genera un enlace y asigna una ruta curada.
3. Un alumno abre el enlace, entra, importa su avance local y marca un nodo.
4. El guía ve el avance del alumno en la tabla.
5. Un segundo guía intenta abrir el grupo del primero y recibe 404.

Además se conservan las 30 pruebas E2E actuales sin sesión.

## 8. Puesta en marcha

1. Instalar Neon y Resend desde el Marketplace de Vercel y traer las variables con `vercel env pull`.
2. El dueño del proyecto crea las credenciales de Google OAuth en Google Cloud y las carga en Vercel.
3. Cargar `ADMIN_EMAILS` y `BETTER_AUTH_SECRET` en Vercel.
4. Verificar el dominio de envío en Resend.

## 9. Puntos de extensión

- **Spec 2:** las rutas propias del guía agregan `path_ref = guide:<id>` y sus tablas. `assignments` y la tabla de avance no cambian.
- **Spec 3:** el radar personal y de grupo se apoya en `user`, `groups` y `memberships`.

## 10. Fuera de alcance

- Registro abierto.
- Grupos con más de un guía.
- Que un alumno vea a sus compañeros o su avance.
- Rutas, notas, preguntas o material propio del guía (spec 2).
- Radar personal y de grupo (spec 3).
- Borrar la cuenta desde la interfaz: por ahora lo hace el administrador a mano.
- Notificaciones por correo de fechas límite.
