# GeekNook JavaScript Architecture & Modules Guide

## Overview

GeekNook uses a lightweight, zero-build headless architecture designed for instant execution on both standalone hosting (GitHub Pages / static web server) and Tilda Headless (`tilda-bundle/tilda-loader.html`).

---

## Active Production Architecture

### 1. The Canonical Engine: `js/modern-app.js`
- **Global namespace**: `window.geekNookApp`
- **Role**: Standalone core application engine. Handles:
  - Global reactive application state (`window.geekNookApp.state`)
  - Full product catalog rendering, filtering, sorting, search, and badges
  - Cart state, persistence (`localStorage`), drawer rendering, and discount rules
  - Focus Station 3D Studio & Production 3D Scene Controller (Three.js lazy loaded on demand)
  - Interactive cable routing physics simulator (Canvas 2D)
  - FEA mechanical load deformation lab (Canvas 2D)
  - Audio feedback sound engine (Web Audio API synthesizers)
  - Modal manager, toast notifications, drawer overlays, and ESC key navigation
  - 1-Click Quick Buy modal and full checkout workflow

### 2. Active External Modules
These modules are loaded alongside `modern-app.js` in `index.html` and `tilda-bundle/tilda-loader.html`:

| Module | Global Namespace | Role |
| :--- | :--- | :--- |
| `js/modules/analytics.js` | `window.geekNookAnalytics` | Multi-provider telemetry (Yandex.Metrika, VK Pixel, e-commerce purchase events). |
| `js/modules/cdek-picker.js` | `window.geekNookCdekPicker` | Interactive CDEK PVZ picker modal with Yandex Maps API, search, and lazy-loaded points database. |
| `js/modules/tilda-adapter.js` | `window.geekNookTilda` | Headless bridge for Tilda publishing: cart syncing, Tilda form injection, and payment redirection. |

---

## Performance & Lazy-Loading Strategy

To guarantee rapid First Contentful Paint (FCP) and zero blocking on mobile (320px+ viewports):

1. **Three.js (`js/three.min.js`, ~603 KB)**:
   - **Lazy-loaded on demand**: Three.js is not loaded on initial page load.
   - Triggered automatically via `IntersectionObserver` when `#prod3dViewport` or `#configurator` enters within 600px of the viewport, or instantly when a user interacts with 3D controls or opens the 3D configurator modal.
   - Implemented via `window.geekNookApp.ensureThreeLoaded(callback)`.

2. **CDEK Points Catalog (`js/data/cdek-popular.js`, ~348 KB)**:
   - **Lazy-loaded on demand**: Only fetched when the user triggers the checkout process (`openCheckout` or `openQuickBuy`) or opens the PVZ selector.
   - Implemented via `window.geekNookCdekPicker.preload()`.
