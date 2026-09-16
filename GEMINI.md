# Project Engineering Rules: Frontend & UI

## Viewport & Mobile Discipline
- All pages and UI modules MUST strictly adhere to zero horizontal overflow (`scrollWidth === clientWidth`) on viewports down to 320px.
- Toolbars and pill filters must wrap or use horizontal touch-scrolling (`overflow-x: auto; -webkit-overflow-scrolling: touch;`) rather than overflowing flex rows.
- Ensure all interactive touch targets are at least 44x44px.

## High-Performance Canvas & Animations
- Do NOT use `ctx.shadowBlur` inside animation loops.
- Cache all bounding rects; do not trigger layout thrashing via `getBoundingClientRect()` inside `requestAnimationFrame`.
- Always pause animation loops when elements are off-screen using `IntersectionObserver`.
- Support responsive coordinate scaling via `uiScale` so canvas scenes never clip on narrow screens.
- Use `touch-action: none` and prevent default on touchmove only when actively interacting with canvas elements.

## Skillset Reference
- For full runbooks and testing procedures, refer to the `frontend-development` skill in `.agents/skills/frontend-development/SKILL.md`.
