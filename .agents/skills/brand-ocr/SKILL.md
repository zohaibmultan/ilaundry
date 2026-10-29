---
name: brand-ocr
description: >-
  Use this skill when developing, testing, or diagnosing the Python Flask Garment Brand
  OCR microservice (brand-reader-ocr), testing /api/scan endpoints, tuning RapidOCR/OpenCV pipelines, or updating brands.xlsx.
---

# Garment Brand OCR Service Runbook & Diagnostics

This skill provides step-by-step procedures for running, testing, and debugging the `brand-reader-ocr` Python microservice.

## 1. Architecture Overview
- **Location**: `brand-reader-ocr/`
- **Framework**: Python 3, Flask, Phusion Passenger WSGI
- **OCR Engine**: RapidOCR ONNX Runtime with OpenCV contrast & threshold preprocessing (`NeckTagOCRPipeline`)
- **Matching Engine**: RapidFuzz fuzzy ratio matcher (`BrandMatcher`) loaded from `brands.xlsx`
- **Default Port**: 5050 (or 5000 in standalone test mode)

## 2. Environment Setup & Execution

### Activate Virtual Environment & Install Dependencies:
```powershell
cd brand-reader-ocr
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
```

### Run Local Development Server:
```powershell
python app.py
```
Server starts on `http://127.0.0.1:5050` (or `5000`).

## 3. Diagnostic Health Checks

### Check Microservice Health:
```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:5050/health" -Method Get
```
Expected response:
```json
{
  "ok": true,
  "total_brands": 1236,
  "ocr_loaded": false
}
```

## 4. Testing Brand Recognition & OCR

### A. Test with Sample Tag Image:
```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:5050/api/scan" -Method Post -ContentType "application/json" -Body '{"sample": "sample_zara.jpg"}'
```

### B. Test with Base64 Camera Snapshot:
```powershell
$b64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes("brand-reader-ocr/samples/sample_armani.jpg"))
$body = @{ image_base64 = "data:image/jpeg;base64,$b64"; threshold = 75.0 } | ConvertTo-Json
Invoke-RestMethod -Uri "http://127.0.0.1:5050/api/scan" -Method Post -ContentType "application/json" -Body $body
```

### C. Test Brand Query Lookup:
```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:5050/api/brands?q=gucci" -Method Get
```

## 5. Brand Catalog Synchronization
When new garment brands are added in `laundry-cms` (`tbl_garment_brands`), ensure they are mirrored in `brand-reader-ocr/brands.xlsx` with:
- `Brand / Label`: Official brand name.
- `Category`: `REGULAR`, `DESIGNER`, `HIGH-END`, `BESPOKE`.
- `POS Search Key`: Space-separated search variants.
- `Price Multiplier`: Pricing multiplier (e.g. 1.00, 1.25, 1.50, 2.00).
- `Upcharge Note`: Optional upcharge percentage note.

