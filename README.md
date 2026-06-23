# Bravo Reels App — Generador de Copyouts & Calendario

App para subir guiones de reels y obtener automáticamente:
1. Un **PDF** con los copyouts de cada guion (identidad Bravo Agencia).
2. Una **imagen PNG** con el calendario editorial de publicación.

Todo corre gratis: la página vive en **GitHub Pages** y la IA se llama a través de un **Cloudflare Worker** (capa gratuita) que protege tu API key de Anthropic.

---

## Costos

- **GitHub Pages:** gratis, sin límite relevante para esto.
- **Cloudflare Workers (plan free):** 100,000 llamadas al día gratis. Para este uso (tu equipo subiendo guiones) no se acerca ni de lejos al límite.
- **API de Anthropic:** se cobra por uso normal de tu cuenta (centavos por tanda de guiones, según cuántos reels proceses). Esta es la única parte con costo real, y es el mismo costo que tendrías hablando conmigo directamente.

---

## Paso 1 — Subir el código a GitHub

1. Crea un repositorio nuevo en GitHub, por ejemplo `bravo-reels-app`.
2. Sube estos 3 archivos a la raíz del repo: `index.html`, `style.css`, `app.js`.
   (El archivo `worker.js` **no** se sube aquí, va en Cloudflare — ver paso 2).
3. Ve a **Settings → Pages**, en "Branch" selecciona `main` y carpeta `/ (root)`. Guarda.
4. Espera 1-2 minutos. Tu app quedará publicada en algo como:
   `https://TU-USUARIO.github.io/bravo-reels-app/`

---

## Paso 2 — Publicar el Worker en Cloudflare

1. Crea una cuenta gratis en [cloudflare.com](https://cloudflare.com) si no tienes una.
2. Ve a **Workers & Pages → Create → Create Worker**.
3. Ponle un nombre, por ejemplo `bravo-reels-worker`, y créalo.
4. Entra al editor del Worker y **reemplaza todo el código de ejemplo** por el contenido completo de `worker.js`.
5. Antes de publicar, edita estas dos líneas dentro del código:
   - `ALLOWED_ORIGIN` → pon la URL exacta de tu GitHub Pages del paso 1 (ej. `https://tu-usuario.github.io`).
   - (Opcional) `MODEL` → puedes dejar `claude-sonnet-4-6` (mejor calidad de copy) o cambiarlo a `claude-haiku-4-5-20251001` (más barato, copy un poco más simple).
6. Guarda y dale **Deploy**.
7. Ve a **Settings → Variables and Secrets** del Worker → **Add → Secret**:
   - Nombre: `ANTHROPIC_API_KEY`
   - Valor: tu API key real (la obtienes en console.anthropic.com → API Keys). Tú la pegas directamente ahí, nunca queda visible en el código ni en GitHub.
8. Copia la URL pública del Worker, algo como:
   `https://bravo-reels-worker.tu-subdominio.workers.dev`

---

## Paso 3 — Conectar la app con el Worker

1. Abre `app.js`.
2. Busca la línea:
   ```js
   const WORKER_URL = "https://bravo-reels-worker.TU-SUBDOMINIO.workers.dev";
   ```
3. Reemplázala con la URL real que copiaste en el paso anterior.
4. Sube el archivo actualizado a GitHub (esto vuelve a publicar la página automáticamente).

¡Listo! Ya puedes compartir la URL de GitHub Pages con tu equipo.

---

## Cómo se usa

1. **Paso 1 — Carga:** sube un PDF, Word o texto con los guiones, o pégalos directo. Si vienen varios en un solo bloque, sepáralos con una línea `---` (o deja que la IA los detecte sola si vienen claramente numerados).
2. **Paso 2 — Revisión:** la IA entrega el tema y el copyout de cada reel. Puedes editar cualquier texto antes de continuar.
3. **Paso 3 — Calendario:** llena cliente, fecha de inicio, reels por día, horarios y días de publicación. Si dejas horarios u días vacíos, se usan los valores recomendados de Bravo (10:00 / 18:00, lunes a viernes).
4. **Paso 4 — Entrega:** descarga el PDF de copyouts y la imagen del calendario, listos para enviar a cliente o equipo.

---

## Notas técnicas

- Todo el procesamiento de archivos (PDF/Word) y la generación de los entregables (PDF/PNG) ocurre en el navegador — no se sube nada a ningún servidor más que el texto plano que se envía al Worker para generar los copyouts.
- Si en el futuro quieres agregar tu logo real en vez del wordmark de texto, lo agregamos como imagen embebida tanto en el PDF (jsPDF `addImage`) como en el calendario (un `<img>` dentro del HTML que genera la imagen).
- Si quieres que la app además guarde historial de clientes y calendarios pasados, se puede sumar Firebase después — se dejó fuera ahora a propósito para mantenerlo simple, como pediste.
