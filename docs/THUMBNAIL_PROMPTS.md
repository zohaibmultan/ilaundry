# iCleaners &mdash; CodeCanyon Thumbnail & Graphic Asset Generation Guide

This guide provides ready-to-use AI generation prompts (Midjourney, DALL-E 3, Stable Diffusion / Flux) and design composition specifications for producing **Envato / CodeCanyon marketplace thumbnails and hero banners** for **iCleaners**.

---

## 1. Generated Assets Reference

The following presentation assets have already been generated and saved directly to your [`docs/`](file:///e:/Products/Laragon_Laundary/www/docs/) folder:

| Asset File | Dimensions / Ratio | Purpose |
| :--- | :---: | :--- |
| [`docs/codecanyon_main_banner.jpg`](file:///e:/Products/Laragon_Laundary/www/docs/codecanyon_main_banner.jpg) | 1920 &times; 1080 (16:9) | **Main Item Preview Image** (CodeCanyon search result & category hero) |
| [`docs/codecanyon_square_icon.jpg`](file:///e:/Products/Laragon_Laundary/www/docs/codecanyon_square_icon.jpg) | 1024 &times; 1024 (1:1) | **Item Thumbnail Icon** (80 &times; 80px square avatar on Envato) |
| [`docs/pos.png`](file:///e:/Products/Laragon_Laundary/www/docs/pos.png) | 1920 &times; 1080 | Original high-res POS software UI screenshot |
| [`docs/logo-rec.png`](file:///e:/Products/Laragon_Laundary/www/docs/logo-rec.png) | 1000 &times; 300 | High-res rectangular brand logo |
| [`docs/logo-sqr.png`](file:///e:/Products/Laragon_Laundary/www/docs/logo-sqr.png) | 400 &times; 400 | High-res square emblem icon |

---

## 2. AI Prompts for Generating Custom Variations

### Option A: Midjourney v6 / v6.1 (Recommended for Photorealism & Hardware)

#### Main 16:9 Hero Preview Banner
```text
A commercial, high-converting product showcase banner for a software marketplace listing titled "iCleaners Laundry ERP & POS". In the center-left, a modern, ultra-clean web application interface displayed on a floating borderless glass canvas showing laundry clothing services (formal shirts, tuxedos, trousers) and shopping cart totals. In the top-left corner, a bold blue and red "iCleaners" brand logo with a red tie emblem. On the right side, an impressive physical hardware setup: a sleek matte black 80mm thermal receipt printer with an itemized cash receipt and barcode emerging from the slot, next to realistic waterproof nylon cloth garment tags with printed Code128 barcodes attached to luxury fabric with safety pins. Subtle glowing blue badge pills along the bottom: "Silent Printing Server", "Waterproof Cloth Wash Tags", "Multi-Store & POS", "10 Languages & Full RTL". Clean royal blue studio lighting, soft glassmorphism reflections, minimalist tech background, cinematic 8k product photography, ultra-detailed --ar 16:9 --style raw --v 6.0
```

#### Square 1:1 App Thumbnail Icon
```text
A sleek, modern 3D glossy app icon for "iCleaners", featuring a prominent capital letter 'C' in vibrant royal blue paired with a stylized red necktie forming the letter 'i'. Set inside a squircle icon frame with smooth rounded corners, bevelled glass edges, and subtle surface reflections. In the upper-right corner of the icon badge, a miniature high-tech thermal receipt printer icon; in the lower-left corner, a miniature waterproof barcoded laundry wash tag icon. Deep oceanic blue gradient background, soft drop shadow, clean iOS/macOS Big Sur app icon aesthetics, 8k resolution --ar 1:1 --v 6.0
```

---

### Option B: DALL-E 3 / ChatGPT Plus Prompt

```text
Create a professional, high-resolution commercial graphic banner for an Envato CodeCanyon product listing named "iCleaners".

Visual Composition:
1. Main Stage (Left to Center): A floating, sleek 3D perspective display of a modern web POS application for dry cleaners and laundromats. The UI displays categorized laundry garments (suits, jackets, formal shirts, dresses) with real-time shopping cart totals and clean Bootstrap 5 glassmorphism cards.
2. Top-Left Branding: Prominently feature the "iCleaners" logo in bold royal blue with a red necktie icon representing the lowercase letter 'i'.
3. Hardware Showcase (Right Side): Feature physical POS equipment:
   - A compact desktop 80mm thermal receipt printer with a printed customer bill emerging from the top slot showing a clear barcode and store details.
   - Realistic waterproof nylon garment wash tags printed with Code128 barcodes, item numbers, and care symbols, pinned with chrome safety pins to dry-cleaned clothing fabric.
4. Promotional Badges (Bottom): Sleek glassmorphism pills with white bold text:
   - "Silent Printing Server (0-Dialog)"
   - "Garment Cloth Wash Tags"
   - "Multi-Store & POS"
   - "10 Languages + Full RTL"
5. Style & Lighting: High-end commercial SaaS product render, crisp focus, soft blue and white ambient studio lighting, premium marketing aesthetic.
```

---

### Option C: Stable Diffusion (SDXL / Flux.1) Prompt

```text
Positive Prompt:
(masterpiece, top quality, photorealistic, 8k:1.2), commercial SaaS marketing banner, iCleaners POS, modern web dashboard on floating glass screen showing laundry garment items, (matte black 80mm thermal receipt printer:1.2) with printed paper receipt, (waterproof nylon cloth laundry tags with printed Code128 barcodes and safety pins:1.3), bold blue and red iCleaners logo, badge pills "Silent Printing Server", "Garment Cloth Tags", "Multi-Store", "10 Languages RTL", vibrant royal blue studio backdrop, cinematic lighting, sharp focus, ray tracing reflections

Negative Prompt:
blurry, low resolution, distorted text, ugly, amateur, bad anatomy, deformed hardware, cluttered background, oversaturated, watermark, grain
```

---

## 3. Figma / Photoshop Manual Layer Composition Guide

If you or your graphic designer want to composite the exact files into a custom PSD or Figma template:

```
┌────────────────────────────────────────────────────────────────────────┐
│ [logo-rec.png]                                                         │
│                                                                        │
│   ┌────────────────────────────────┐       ┌──────────────────────┐    │
│   │                                │       │  Thermal Printer     │    │
│   │        [pos.png]               │       │  [Receipt Emerging]  │    │
│   │                                │       └──────────────────────┘    │
│   │  (Slight 3D Perspective Tilt   │       ┌──────────────────────┐    │
│   │   + Soft Ambient Shadow)       │       │  [Cloth Wash Tags]   │    │
│   │                                │       │  (Nylon + Code128)   │    │
│   └────────────────────────────────┘       └──────────────────────┘    │
│                                                                        │
│  [Badge: Silent Print Server] [Badge: Cloth Tags] [Badge: 10 Langs RTL]│
└────────────────────────────────────────────────────────────────────────┘
```

### Color Palette Tokens
* **Primary Royal Blue**: `#0056D2` / `rgb(0, 86, 210)`
* **Brand Red (Tie Accent)**: `#C8102E` / `rgb(200, 16, 46)`
* **Surface Background**: `#0b1329` (Dark Navy) to `#1e3a8a` (Deep Blue Gradient)
* **Pill Badges**: `rgba(255, 255, 255, 0.12)` with `backdrop-filter: blur(12px)` and `1px solid rgba(255, 255, 255, 0.25)`
* **Typography**: Inter / Montserrat / Poppins (Bold 700 & 800)

### Key Marketing Callouts to Emphasize
1. **"Silent Printing Server Included"**: Highlight that cashiers never see the browser `Ctrl+P` dialog.
2. **"Garment Cloth Tags + Code128 Barcodes"**: Highlight waterproof 75mm/50mm wash tags printed per garment.
3. **"Multi-Store & Franchise Ready"**: Highlight branch isolation and commission payouts.
4. **"10 Languages + Native Arabic RTL"**: Highlight international readiness.
