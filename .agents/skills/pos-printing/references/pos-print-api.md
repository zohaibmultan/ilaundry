# POS Printing Server API Reference

The local printing service runs as a standalone daemon listening on `http://127.0.0.1:4321`.

## Endpoints

### 1. Health Check
* **Route**: `GET /health`
* **Response**:
  ```json
  {
    "status": "ok",
    "version": "1.2.0",
    "uptime": 12450
  }
  ```

### 2. Print HTML
* **Route**: `POST /print/html`
* **Headers**: `Content-Type: application/json`
* **Payload**:
  ```json
  {
    "html": "<html>...</html>",
    "printerId": "XP-80C",
    "widthMm": 80,
    "options": {
      "copies": 1,
      "cut": true,
      "openCashDrawer": false
    }
  }
  ```
* **Success Response**:
  ```json
  {
    "success": true,
    "jobId": "JOB-98214",
    "printer": "XP-80C"
  }
  ```

### 3. List Printers
* **Route**: `GET /printers`
* **Response**: List of installed system printers with driver names, port names, and paper sizes.

## Database Configurations (`tbl_master_shop`)
* `printing_server_url`: e.g. `http://127.0.0.1:4321`
* `silent_print_enabled`: 1 (enabled) or 0 (disabled)
* `invoice_printer_name`: Printer device name for thermal receipts
* `invoice_printer_format`: 1 (80mm), 2 (58mm), 0 (Letter/A4)
* `tag_printer_name`: Printer device name for cloth tags
* `tag_printer_format`: 0 (50mm), 1 (75mm), 2 (80mm)
* `printer_auto_cut`: 1 (yes) or 0 (no)
* `printer_open_cash_drawer`: 1 (yes) or 0 (no)
* `printer_copies`: Integer number of copies
