# Rule: Liquid Glass Design System (`liquid-glass-theme.css`)

## Purpose
Documents the glassmorphism design system conventions used across all modernized iCleaners pages. All agents must follow these naming patterns and critical CSS techniques when modifying or extending `public/css/liquid-glass-theme.css`.

## File
`public/css/liquid-glass-theme.css` — Loaded globally via `views/templet/meta.ejs` (line 111). **Changes here affect ALL pages.**

## Dark Theme Selector
Always use `[data-theme-version="dark"]` as the dark mode prefix selector. This attribute is set on `<html>` and `<body>` by the global theme toggle in `meta.ejs`.

## Established Component Naming Conventions

### Report Components
1. **KPI Metric Icons**: `.daily-metric-icon` with variants `.icon-orders`, `.icon-delivered`, `.icon-sales`, `.icon-payment`, `.icon-expense`. Must define separate light and dark foreground/background color pairs to avoid blue-on-blue collisions.
2. **KPI Cards**: `.daily-kpi-card` — Used instead of `bg-white` to support dark frosted glass backgrounds.
3. **Category Badges**: `.daily-badge` with `.badge-volume`, `.badge-fulfillment`, `.badge-revenue`, `.badge-collection`, `.badge-expenditure`.
4. **Tax Index Badges**: `.tax-index-badge` — Small numbered circle badges for table rows.

### Header Components
5. **Store Badge**: `.header-store-badge` / `.header-store-dot` — Live store status pill with pulsing emerald dot.
6. **POS Button**: `.header-pos-btn` — Quick POS action gradient pill button.
7. **Icon Containers**: `.header-icon-btn` — Frosted glass icon container for theme toggle and notification bell.
8. **Badge Dot**: `.header-badge-dot` — Pulsing coral notification indicator dot.

### Glass Dropdown Menus
9. **Notification Menu**: `.notification-glass-menu` — Frosted `backdrop-filter: blur(20px)` container.
10. **Language Menu**: `.lang-glass-menu` — 2-column language selection dropdown.
11. **Profile Menu**: `.profile-glass-menu` — User profile options dropdown.
12. **Language Grid**: `.lang-grid`, `.lang-grid-item` — 2-column card layout for language selection.

### Notification Items
13. `.notif-item` — Flex row container for a single notification.
14. `.notif-item-icon` — Fixed 34px circular icon.
15. `.notif-item-body` — Flex-shrinking text container (`flex: 1 1 0%; min-width: 0; width: 0;`).
16. `.notif-item-text` — Multi-line clamped text (`-webkit-line-clamp: 3`).
17. `.notif-item-time` — Timestamp row.

## Critical CSS Patterns

### Flexbox Overflow Prevention
When a flex child can contain arbitrarily long text, always use:
```css
.container-body {
  flex: 1 1 0% !important;
  min-width: 0 !important;
  width: 0 !important;
  overflow: hidden !important;
  word-break: break-word !important;
  overflow-wrap: anywhere !important;
}
```

### Calendar Picker Dark Mode
Date inputs require two rules under `[data-theme-version="dark"]`:
```css
[data-theme-version="dark"] input[type="date"] {
  color-scheme: dark !important;
}
[data-theme-version="dark"] input[type="date"]::-webkit-calendar-picker-indicator {
  filter: invert(1) brightness(1.2) !important;
  opacity: 0.95 !important;
}
```

### Dropdown Z-Index Layering
Filter sections with `bootstrap-select` must use `z-index: 1050+` to ensure dropdowns render above sibling cards. **Never** nest filter controls inside a `backdrop-filter` card that creates a new stacking context.
```css
.filter-section { z-index: 1050; overflow: visible !important; }
.kpi-row { z-index: 1; }
.bootstrap-select .dropdown-menu { z-index: 1060 !important; }
```
