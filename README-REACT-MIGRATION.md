# HITS Attendance — React Frontend Migration

## What changed
- The vanilla HTML/CSS/JS frontend (`public/index.html` + `public/app.js`) was rewritten as a React app using functional components and hooks.
- `server.py` (the Python backend) is **completely unmodified**. Every API endpoint, request body, header, and response shape is identical to the original.
- `public/style.css` and `public/hits_campus.jpg` are reused unchanged.
- The React app is built with Vite and the production build is output straight into `public/`, so `server.py`'s static file serving (`public/index.html`, `public/style.css`, etc.) keeps working exactly as before — no backend changes were needed.

## Layout
- `server.py`, `run_attendance.bat`, `.vscode/` — original backend, untouched.
- `public/` — the **built** frontend that `server.py` serves. This is generated output; don't hand-edit it.
- `frontend-src/` — the React source project (Vite). This is what you edit going forward.

## Running the app
1. `cd frontend-src && npm install` (first time only)
2. `npm run build` — rebuilds the React app into `../public`
3. From the project root: `python3 server.py` — same as before, serves on `http://127.0.0.1:3000`

## Developing with hot reload
`cd frontend-src && npm run dev` starts the Vite dev server. It proxies any `/api/...` request to `http://localhost:3000`, so also run `python3 server.py` in another terminal for the backend while developing.

## Notable React-specific changes (functionality preserved)
- **Icons**: the original used the Lucide CDN script + `data-lucide` attributes re-scanned via `lucide.createIcons()` after every DOM update. React can't attach to CDN-scanned attributes across re-renders, so icons now use the `lucide-react` component library instead — same icon set, same visuals, no CDN script tag needed.
- **DOM manipulation → state**: all the `document.getElementById(...).innerHTML = ...` calls from `app.js` became React state (`useState`) and conditional rendering. The data flow (fetch → compute stats → render) is the same, just expressed as component state instead of imperative DOM writes.
- Everything else — endpoints, payloads, business rules (period status, overdue detection, memo auto-generation is server-side and untouched, etc.) — is preserved as-is.
