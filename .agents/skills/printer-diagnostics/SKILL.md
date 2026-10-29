---
name: printer-diagnostics
description: >-
  Use this skill when diagnosing printer connectivity, testing ESC/POS thermal print
  endpoints, verifying CORS & Private Network Access (PNA), inspecting the printing queue, or packaging the Electron printing-server app.
---

# Printer Diagnostics & Build Workflows

Use these procedures to verify printer health, diagnose CORS/PNA issues, and package the application.

## 1. Health & Server Verification
1. Check if the local printing server is listening on port 4321:
   ```powershell
   Get-NetTCPConnection -LocalPort 4321 -ErrorAction SilentlyContinue
   ```
2. Test the server health endpoint:
   ```powershell
   Invoke-RestMethod -Uri "http://127.0.0.1:4321/health" -Method Get
   ```
3. Test Private Network Access (PNA) preflight from a simulated HTTPS origin:
   ```powershell
   Invoke-WebRequest -Uri "http://127.0.0.1:4321/health" -Method Options -Headers @{ "Origin" = "https://icleanders.com"; "Access-Control-Request-Private-Network" = "true"; "Access-Control-Request-Method" = "POST" }
   ```

## 2. Testing Thermal ESC/POS Output
1. Before sending test prints, inspect detected printers on Windows:
   ```powershell
   Get-CimInstance Win32_Printer | Select-Object Name, PortName, PrinterStatus
   ```
2. Send a test receipt payload to the local API endpoint:
   ```powershell
   Invoke-RestMethod -Uri "http://127.0.0.1:4321/print" -Method Post -ContentType "application/json" -Body '{"test": true}'
   ```

## 3. Building & Packaging
To build the Windows executable:
```powershell
npm run build:win
```
Verify the generated files in `dist/`:
- `dist/POS Printing Server-Setup-1.0.0.exe` (installer)
- `dist/POS Printing Server-Standalone-1.0.0.exe` (portable)
