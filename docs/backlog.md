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
| `BETTER_AUTH_URL` | listo | falta para enviar correos desde preview (las previews corren con `NODE_ENV=production` y `siteUrl` la exige); valor: `https://expia-git-feat-cuentas-serandmoncas-6387s-projects.vercel.app` |
| `DATABASE_URL` (integración Neon, recurso `neon-purple-drawer`) | listo, migraciones aplicadas | listo, **misma base que producción** |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | falta | falta |
| `RESEND_API_KEY`, `EMAIL_FROM` | falta | falta |

Pendiente:

- [ ] Decidir si `expia.site` también será el dominio del sitio; si sí, hacerlo antes de cargar Google OAuth y ajustar `BETTER_AUTH_URL` y la redirección de Google

- [ ] Cargar `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` (el cliente OAuth ya existe en Google Cloud, con redirección a `https://expia-self.vercel.app/api/auth/callback/google`)
- [ ] Resend (cuenta gratuita propia, **no** la integración de Vercel: ahí el plan gratis no está disponible porque la cuenta ya pertenece a un equipo de Resend):
  - [x] Dominio `expia.site` (Namecheap) agregado en Resend, región `us-east-1`, sin click tracking
  - [ ] Registros DNS en Namecheap → Advanced DNS: CNAME `send` → `send.forge.rmta.net`, CNAME `rsend` → `rsend.forge.rmta.net`, TXT `resend._domainkey` → clave DKIM (copiar con el botón en Resend, se muestra recortada), TXT `_dmarc` → `v=DMARC1; p=none;`. Luego "Verify DNS records" en Resend
  - [ ] API key con "Sending access" limitada a `expia.site`; cargarla con `vercel env add RESEND_API_KEY production` y `... preview feat/cuentas`
  - [ ] `EMAIL_FROM=ExpIA <hola@expia.site>` en producción y preview
- [ ] Separar la base de preview de la de producción (rama Neon por preview) o quitar `DATABASE_URL` de preview
- [ ] Poner la rama al día con `main` (al 2026-11-11 va 6 commits atrás, solo radares)
- [ ] Mergear el PR #5 y probar en producción: entrar, crear grupo como guía, invitar, unirse
- [ ] Página `/privacidad` (qué se guarda, para qué, cómo pedir borrarlo) antes de abrir el registro

Notas:

- El Vercel CLI 53.1.1 sin TTY exige la rama al agregar variables de preview, aunque se pase `--value --yes`. Para todas las ramas, usar el dashboard.
- Se creó por error una segunda base Neon (`expia-db`) y se borró el 2026-10-29; queda solo `neon-purple-drawer`.
- La integración de Neon agregó `NEON_AUTH_BASE_URL` y `VITE_NEON_AUTH_URL`. No se usan (el login es Better Auth).

## Después

- Subproyecto 3, radar tecnológico personal y de equipo (sin especificación todavía)
