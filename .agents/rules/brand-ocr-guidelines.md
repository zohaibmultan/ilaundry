# Rule: Garment Brand OCR Service & Tag Recognition Microservice

## Purpose
Establishes engineering invariants, runtime constraints, and API contracts for the Python Flask OCR microservice (`brand-reader-ocr/`) providing garment neck tag and laundry care label recognition for iCleaners POS.

## Invariant Rules

### 1. Concurrency & Shared Hosting Thread Isolation
- On cPanel and shared hosting environments, multi-threaded BLAS/OpenMP backends can exhaust thread pools and crash the WSGI worker.
- The following single-thread limits **must** be set before importing NumPy, OpenCV, or ONNX Runtime:
  ```python
  import os
  os.environ.setdefault("OMP_NUM_THREADS", "1")
  os.environ.setdefault("OPENBLAS_NUM_THREADS", "1")
  os.environ.setdefault("MKL_NUM_THREADS", "1")
  os.environ.setdefault("VECLIB_MAXIMUM_THREADS", "1")
  os.environ.setdefault("NUMEXPR_NUM_THREADS", "1")
  ```

### 2. Lazy Model Loading & Passenger WSGI Compatibility
- The ONNX OCR engine (`NeckTagOCRPipeline`) must be lazy-loaded on the first `/api/scan` request using thread locking:
  ```python
  _ocr_lock = threading.Lock()
  _ocr_engine = None

  def get_ocr_engine():
      global _ocr_engine
      if _ocr_engine is None:
          with _ocr_lock:
              if _ocr_engine is None:
                  from ocr_pipeline import NeckTagOCRPipeline
                  _ocr_engine = NeckTagOCRPipeline()
      return _ocr_engine
  ```
- Expose `application = app` in `app.py` and maintain `passenger_wsgi.py` for Phusion Passenger deployments.

### 3. Request Image Decoding Safety
- `/api/scan` must support 3 decoding strategies without throwing unhandled exceptions:
  1. `request.files["image"]`: File upload read as bytes and decoded via `cv2.imdecode`.
  2. `data["sample"]`: Validated against `samples/` using `os.path.basename` to prevent directory traversal.
  3. `data["image_base64"]`: Decodes base64 strings, stripping optional data-URI prefixes (`data:image/...;base64,`).
- Return HTTP 400 with a descriptive JSON error if no valid image is provided.

### 4. Matching Protocol & Response Structure
- The OCR text must be fuzzy-matched against `brands.xlsx` / `tbl_garment_brands` using RapidFuzz.
- Standard response payload:
  ```json
  {
    "ok": true,
    "ocr": {
      "primary_brand_text": "ZARA",
      "candidate_lines": [...]
    },
    "pos_match": {
      "match_score": 100.0,
      "top_candidates": [
        {
          "pos_search_key": "ZARA",
          "brand_label": "Zara",
          "category": "REGULAR",
          "score": 100.0
        }
      ]
    },
    "total_brands": 1236
  }
  ```
- Never return 500 without full exception classification and clean JSON formatting.

