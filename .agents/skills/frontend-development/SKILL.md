---
name: frontend-development
description: >-
  Comprehensive guide, runbooks, and performance patterns for modern frontend development: zero-overflow mobile responsiveness (320px–768px+), 60 FPS HTML5 2D Canvas physics, Three.js WebGL integration, touch gesture handling, and automated viewport testing. Use whenever designing, building, refactoring, or optimizing frontend user interfaces, mobile layouts, canvas simulations, or responsive web components.
---

# Frontend Development & Mobile Engineering Skill

This skill codifies production-grade frontend architecture, zero-overflow mobile responsive design, high-performance 2D/WebGL rendering, and automated viewport verification.

---

## 1. Zero-Overflow Mobile Responsiveness (320px – 768px+)

### The Golden Rule of Viewport Discipline
Mobile web pages must **never** trigger unintentional horizontal scrolling (`scrollWidth` must strictly equal `clientWidth`).

```css
/* Core Base Reset: Lock Viewport Boundary */
html {
  scroll-behavior: smooth;
  font-size: 16px;
  overflow-x: hidden;
  max-width: 100vw;
}

body {
  overflow-x: hidden;
  max-width: 100vw;
  width: 100%;
}
```

### The Fluid Pill & Toolbar Pattern
Long rows of buttons or filter pills (e.g. tabs, device toggles, material selectors) will break mobile layouts if forced into fixed rows:

```css
/* Desktop: Clean flex row */
.toolbar-pills {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Mobile (<= 768px): Horizontal Touch-Swipe Without Page Widening */
@media (max-width: 768px) {
  .toolbar-group {
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
    width: 100%;
    max-width: 100%;
  }

  .toolbar-pills {
    width: 100%;
    max-width: 100%;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none; /* Firefox */
    display: flex;
    flex-wrap: nowrap;
    padding: 4px;
    box-sizing: border-box;
  }
  .toolbar-pills::-webkit-scrollbar {
    display: none; /* Chrome/Safari */
  }

  .pill-item {
    flex-shrink: 0;
    white-space: nowrap;
    padding: 6px 12px;
    font-size: 0.8rem;
  }
}
```

### Header Pixel Budget on Narrow Screens (`<= 420px`)
On devices like the iPhone 5/SE (320px) or iPhone SE 2/3 (375px), header actions can collide with the brand logo.
- Calculate budget: `Available Width = Viewport Width - (2 * Container Padding)`
- For 320px viewport: `320 - 32 = 288px`.
- Logo (120px) leaves only 168px for actions.
- Rule: Hide secondary quick-actions (e.g. search shortcut, sound toggle) on screens `<= 420px` and keep them accessible inside the mobile drawer menu.

```css
@media (max-width: 420px) {
  .nav-cmd-k-btn,
  .sound-toggle-btn {
    display: none !important;
  }
  .brand-logo {
    font-size: 1.05rem;
    gap: 6px;
  }
}
```

### Overlay Badge Collision Prevention
Never position two absolute overlays at the same vertical level with opposing alignments (`left: 16px` and `right: 16px`) without a mobile override, as they will collide on viewports `< 450px`.
- Move the secondary badge to `bottom: 10px; left: 10px; right: 10px; text-align: center;`.
- Anchor the primary badge to `top: 10px; left: 10px; right: 10px; justify-content: center;`.

---

## 2. 60 FPS HTML5 2D Canvas & Physics Simulations

### A. The 3 Laws of Smooth Canvas Animation
1. **Never use `ctx.shadowBlur` in high-frequency loops**:
   `ctx.shadowBlur` triggers multi-pass Gaussian blur on every frame, causing massive frame-rate drops on mobile GPUs.
   - *Fix*: Use crisp offset fills (`ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ...; ctx.fill();`) or pre-rendered gradient textures.
2. **Never read layout properties in `requestAnimationFrame`**:
   Calling `canvas.getBoundingClientRect()` inside the render loop causes synchronous layout recalculation (layout thrashing).
   - *Fix*: Cache the bounding rect in resize/scroll/pointer events, or update it only on `mousedown` / `touchstart`.
3. **Auto-pause offscreen render loops**:
   ```javascript
   const observer = new IntersectionObserver((entries) => {
     entries.forEach(entry => {
       const isVisible = entry.isIntersecting && entry.intersectionRatio > 0;
       if (isVisible) {
         if (!animFrameId) animFrameId = requestAnimationFrame(renderLoop);
       } else {
         if (animFrameId) {
           cancelAnimationFrame(animFrameId);
           animFrameId = null;
         }
       }
     });
   }, { threshold: [0, 0.05] });
   observer.observe(canvasElement);
   ```

### B. Adaptive Coordinate Scaling (`uiScale`)
Canvas drawings must scale dynamically so that all visual components fit comfortably inside mobile screen widths without clipping:

```javascript
// Dynamic UI scale based on viewport width
const isMobile = width < 640;
const uiScale = isMobile ? Math.max(0.55, Math.min(0.85, width / 520)) : 1.0;

// Dimensions scale with uiScale; positions anchor relative to dynamic centers
const objectWidth = baseWidth * uiScale;
const objectHeight = baseHeight * uiScale;
const objectX = centerX - objectWidth / 2;
```

### C. Conflict-Free Touch Dragging
To drag objects on canvas on mobile without triggering page scrolling:
1. CSS: Set `touch-action: none;` on the canvas container.
2. JavaScript:
   ```javascript
   canvas.addEventListener('touchstart', (e) => {
     const pos = getPos(e);
     // Find draggable node
     activeDragNode = findClosestNode(pos);
   }, { passive: true });

   window.addEventListener('touchmove', (e) => {
     if (!activeDragNode) return;
     // Only cancel page scroll when actively dragging a physics node
     if (e.cancelable) e.preventDefault();
     updateNodePosition(getPos(e));
   }, { passive: false });

   window.addEventListener('touchend', () => {
     activeDragNode = null;
   });
   ```

---

## 3. WebGL & Three.js Best Practices

1. **Pixel Ratio Clamping**: Always clamp device pixel ratio:
   ```javascript
   renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
   ```
2. **Mobile Backdrop-Filter Fallback**:
   Disable expensive CSS `backdrop-filter: blur(...)` on mobile overlays (`<= 768px`), using opaque or semi-transparent backgrounds instead (`rgba(15, 23, 42, 0.95)`).
3. **OrbitControls Inertia**:
   Enable damping for smooth touch and mouse interaction:
   ```javascript
   controls.enableDamping = true;
   controls.dampingFactor = 0.05;
   ```
4. **Offscreen Optimization**:
   Hook Three.js animation loops to `IntersectionObserver` to halt WebGL draw calls when the canvas is scrolled out of view.

---

## 4. Automated Viewport Verification Workflow

Run automated checks across key device viewports using the included verification script:

```bash
python .agents/skills/frontend-development/scripts/verify_viewport.py
```

Standard benchmark matrix:
- **iPhone 5 / SE 1st Gen**: 320 × 568
- **iPhone SE 2nd/3rd Gen**: 375 × 667
- **iPhone 14 / 15**: 390 × 844
- **iPhone XR / 11**: 414 × 896
- **iPad Air / Pro**: 768 × 1024

Success criteria:
1. `docScrollW === clientWidth` (0px horizontal overflow).
2. `errors.length === 0` (0 console errors or unhandled exceptions).
