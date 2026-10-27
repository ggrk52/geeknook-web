# Playwright Test Infrastructure Ready — GeekNook E2E Suite

**Milestone**: M1 (Test Infrastructure & E2E Suites Creation)  
**Status**: Ready & 100% Passing (57/57 tests passing)  
**Test Framework**: `@playwright/test` v1.64.1  
**Target Browser**: System Google Chrome (`channel: 'chrome'`, macOS arm64, 0 downloads required)  
**Web Server**: Python 3 built-in static server (`python3 -m http.server 8080`), automatically managed via Playwright `webServer` block.

---

## 1. Quick Start & Execution Commands

### Run Full Test Suite (Headless, All 57 Tests)
```bash
npm test
# or
npx playwright test
```

### Run Specific Test Suites
```bash
# 1. Responsiveness & Zero-Overflow Suite (37 tests)
npm run test:responsiveness
# or npx playwright test tests/e2e/responsiveness.spec.js

# 2. Interactive Components & Catalog Mechanics Suite (11 tests)
npm run test:interactive
# or npx playwright test tests/e2e/interactive.spec.js

# 3. Browser Console Errors & Unhandled Exceptions Suite (9 tests)
npm run test:console
# or npx playwright test tests/e2e/console-errors.spec.js
```

### View HTML Test Report
```bash
npm run test:report
# or npx playwright show-report
```

---

## 2. Test Architecture & Files

```
geeknook/
├── package.json                   # Test scripts & @playwright/test dependency
├── playwright.config.js            # Configuration: system Chrome, WebGL flags, webServer on 8080
├── TEST_READY.md                  # This file
└── tests/
    └── e2e/
        ├── test-helpers.js        # Shared helpers (checkZeroOverflow, setupPageRoutes)
        ├── responsiveness.spec.js # R1 / F2: Zero-overflow across 5 viewports on 7 pages
        ├── interactive.spec.js    # R2 / F3: Materials, sizes, QuickView, X-Ray, theme
        └── console-errors.spec.js # R2 / F4: 0 console.error & 0 pageerror exceptions
```

---

## 3. Test Suites & Coverage Breakdown

### Suite 1: `responsiveness.spec.js` (37 Tests)
- **Viewports Audited**:
  - `320px` (320 × 640, Ultra-compact mobile / iPhone SE 1st gen)
  - `375px` (375 × 667, Standard compact mobile / iPhone SE 2nd/3rd gen)
  - `768px` (768 × 1024, Tablet portrait / iPad)
  - `1024px` (1024 × 768, Small desktop / iPad landscape)
  - `1440px` (1440 × 900, Full desktop)
- **Pages Audited**:
  1. `index.html` (Main store / catalog / 3D studio)
  2. `b2b.html` (Corporate solutions & calculator)
  3. `podstavki-pod-monitor.html` (Focus Station catalog)
  4. `kabel-menedzhment.html` (Cable organizers & physics simulator)
  5. `kovriki-dlya-stola.html` (Desk mats & sizing guide)
  6. `journal.html` (Ergonomics blog & knowledge hub)
  7. `legal.html` (Public offer & legal terms)
- **Special Scenarios**:
  - Mobile navigation drawer open/close on `index.html` at 320px without page overflow.
  - Horizontal pill tabs on `journal.html` at 320px without widening document width.
- **Assertion**:
  - Strict zero-overflow: `document.documentElement.scrollWidth <= window.innerWidth`.
  - Automated diagnostic reporting identifying offending selector, bounding box, and overflow delta if regression occurs.

### Suite 2: `interactive.spec.js` (11 Tests)
- **Material Selection (Oak / Walnut / Ash)**:
  - Product cards on `index.html` (`#focus-station-walnut`, `#focus-station-oak`, `#focus-station-black`) with authentic titles and isolated studio photography.
  - Production 3D Studio finish pills (`#prod3dFinishPills .prod-pill` for Oak, Walnut, Black) toggling active state.
  - Dedicated monitor stands category cards (`#walnut`, `#oak`, `#black`).
- **Size Selection (85 cm / 116 cm) & Price Dynamics**:
  - QuickView modal dynamic option chips (`.option-chip[data-val="85 см"]` vs `116 см`).
  - Price recalculation (`#qvPriceCurrent`), strikethrough price (`#qvPriceOld`), -20% discount badge (`#qvDiscountBadge`).
  - Dimensions update (`.qv-verified-dimensions`) from `85 × 9 × 23 см` to `116 × 9 × 23 см`.
  - Category page size toggle on `#walnut` switching between 85 cm and 116 cm with price update (`#walnut-price`).
- **QuickView Modal Lifecycle & Focus Trapping**:
  - Opening modal applies `.active` class, locks body scrolling (`overflow: hidden`), and adds `has-modal-open`.
  - Closing via close button (`.btn-close-modal`) restores body scrolling.
  - Closing via `Escape` key restores body scrolling.
  - Closing via clicking outside modal content (backdrop click).
- **X-Ray ISO-9241 Schematic CAD Viewer**:
  - Button `.btn-card-xray` toggles active state and button text between `'X-Ray'` and `'Фото'`.
  - Blueprint `#cardXray_focus-station-walnut` activates with header tag `ISO-9241 // CAD SCHEMATIC` and technical SVG blueprint.
  - Interactive inspection of 4 node pins (`.xray-node-pin`) triggering haptic toast descriptions.
  - Toggle back cleanly returns to photo.
- **Theme Switcher (Dark / Light Mode)**:
  - Toggles `data-theme` attribute between `'dark'` and `'light'` via `#themeToggleBtn`.
  - Toggles theme via keyboard shortcut `T`.
  - Persists preference in `localStorage` across page reload.

### Suite 3: `console-errors.spec.js` (9 Tests)
- **Global Error Sniffing**:
  - Monitored `page.on('console')` for `console.error`.
  - Monitored `page.on('pageerror')` for uncaught runtime exceptions.
  - Filters out harmless aborted network requests caused by blocking external analytics (`mc.yandex.ru`, `google-analytics.com`).
- **Pages Verified**:
  - `index.html` (0 errors)
  - `b2b.html` (0 errors)
  - `podstavki-pod-monitor.html` (0 errors)
  - `kabel-menedzhment.html` (0 errors)
  - `kovriki-dlya-stola.html` (0 errors)
  - `journal.html` (0 errors)
  - `legal.html` (0 errors)
- **Complex Scenarios Verified**:
  - Full user interaction flow on `index.html` (theme toggle -> QuickView open/switch/close -> X-Ray toggle & pin clicks -> 3D Studio finish switch): 0 errors.
  - Tab switching on `legal.html` (`privacy`, `shipping`, `requisites`, `offer`): 0 errors.

---

## 4. Feature Checklist Mapping

| Feature | Description | Spec File | Status |
| :--- | :--- | :--- | :--- |
| **F1** | Playwright Test Runner Infrastructure | `package.json`, `playwright.config.js` | **VERIFIED** |
| **F2** | Zero-Overflow Test Suite | `tests/e2e/responsiveness.spec.js` | **VERIFIED** (37/37 passing) |
| **F3** | Interactive Components Test Suite | `tests/e2e/interactive.spec.js` | **VERIFIED** (11/11 passing) |
| **F4** | Console Error Monitoring Test Suite | `tests/e2e/console-errors.spec.js` | **VERIFIED** (9/9 passing) |

---

## 5. Execution Performance & Reliability Metrics

- **Total Tests**: 57
- **Passed**: 57
- **Failed**: 0
- **Execution Time**: ~2.0 minutes for full run
- **Network Independence**: 100% offline-capable (uses system Chrome and local Python web server)
