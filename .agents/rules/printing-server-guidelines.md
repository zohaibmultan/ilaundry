# Printing Server Development & Safety Rules

## 1. Core Architecture
- **Runtime**: Hybrid Electron & Node.js Express server (`server.js`, `main.js`).
- **Port Management**: Default server runs on port 4321 (configured in `config.json` and `config.js`). Always handle `EADDRINUSE` gracefully.
- **Background Daemon**: Electron runs in the system tray (`tray/`). Ensure background operation is not broken by changes to lifecycle handlers.

## 2. CORS & Private Network Access (PNA) Invariants
- **PNA Header**: Modern browsers require `Access-Control-Allow-Private-Network: true` when public HTTPS sites (e.g., `https://icleanders.com`) communicate with local endpoints (`http://127.0.0.1:4321`). Never remove this middleware.
- **Preflight Handling**: Explicitly route all OPTIONS requests with `app.options("*", cors(corsOptions))` to ensure browser preflights resolve with 200/204 before print payloads are dispatched.
- **Origin Whitelist**: Keep `allowedOrigins` in `config.json` and `$env:USERPROFILE\.pos-printing-server\config.json` aligned with production domains.

## 3. Printer & ESC/POS Protocol Constraints
- Thermal ESC/POS commands (`escposService.js`) write raw binary buffers. Always validate printer status and wrap socket/USB writes in `try/catch`.
- Never send raw binary print commands without paper-cut or feed safety delimiters.
- Keep `printerService.js` and `escposService.js` decoupled from Express route handlers.

## 4. Logging & Error Handling
- Use `logger.js` for all operational and print event logging. Do not use plain `console.log` in production routines.
- Maintain fallback mechanisms when physical thermal printers are offline or unreachable.
