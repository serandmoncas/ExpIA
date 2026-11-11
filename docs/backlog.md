# Backlog

Estado al 2026-11-11. Hoja de ruta completa en el README.

## Hecho

- Subproyecto 1, catálogo y exploración (PR #1)
- Subproyecto 2, referentes (PR #2)
- Subproyecto 4, radar semanal con Claude (PR #3); informes del 17/10 al 06/11 mergeados (PR #4, #6, #7, #8)
- Subproyecto 5, modo enseñanza: rutas, repaso y progreso en el navegador

## En curso: cuentas y grupos (PR #5, rama `feat/cuentas`)

El código está listo y el CI pasa. Falta configurar producción antes de mergear.

Variables en Vercel (proyecto `expia`, producción en https://expia-self.vercel.app):

| Variable | Producción | Preview |
|---|---|---|
| `BETTER_AUTH_SECRET`, `ADMIN_EMAILS` | listo | solo rama `feat/cuentas` |
| `BETTER_AUTH_URL` | listo | no hace falta |
| `DATABASE_URL` (integración Neon) | listo | listo, **misma base que producción** |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | falta | falta |
| `RESEND_API_KEY`, `EMAIL_FROM` | falta | falta |

Pendiente:

- [ ] Cargar `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` (el cliente OAuth ya existe en Google Cloud, con redirección a `https://expia-self.vercel.app/api/auth/callback/google`)
- [ ] Resend: API key y `EMAIL_FROM` de un dominio verificado
- [ ] Separar la base de preview de la de producción (rama Neon por preview) o quitar `DATABASE_URL` de preview
- [ ] Mergear el PR #5 y probar en producción: entrar, crear grupo como guía, invitar, unirse
- [ ] Página `/privacidad` (qué se guarda, para qué, cómo pedir borrarlo) antes de abrir el registro

Notas:

- El Vercel CLI 53.1.1 sin TTY exige la rama al agregar variables de preview, aunque se pase `--value --yes`. Para todas las ramas, usar el dashboard.
- La integración de Neon agregó `NEON_AUTH_BASE_URL` y `VITE_NEON_AUTH_URL`. No se usan (el login es Better Auth).

## Después

- Subproyecto 3, radar tecnológico personal y de equipo (sin especificación todavía)
