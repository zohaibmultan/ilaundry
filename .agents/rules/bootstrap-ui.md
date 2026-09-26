# Rule: Pure Bootstrap UI & Custom CSS Prohibition

## Purpose
Ensures consistent visual design, clean templates, maintainability, and responsiveness across the iCleaners application by strictly adhering to standard Bootstrap components and utilities while eliminating custom, unmaintainable CSS.

## Invariant Rules
1. **Always Use Bootstrap Components & Grid**:
   - Use `.card`, `.card-header`, `.card-body`, `.card-footer` for containers.
   - Use `.modal`, `.modal-dialog`, `.modal-content`, `.modal-header`, `.modal-body`, `.modal-footer` for dialogs.
   - Use `.btn`, `.btn-primary`, `.btn-outline-*`, `.btn-sm` for buttons.
   - Use `.form-control`, `.form-select`, `.form-check`, `.form-label` for inputs and forms.
   - Use `.badge`, `.alert`, `.table`, `.table-responsive` for data and notifications.
   - Use `.row`, `.col-*`, `.container-fluid` for grid structures.

2. **Custom CSS Restriction (Two Established Files Only)**:
   * The application has exactly **two** maintained CSS files for custom styling:
     * `public/css/liquid-glass-theme.css` — Global glassmorphism design system, dark theme adaptations, component-level styling (header, notifications, reports, calendar icons, frosted menus).
     * `public/css/server-datatable.css` — Server-side DataTables unified design system (badge pills, action buttons, pagination).
   - ❌ **No additional CSS files**: Do not create or introduce new `.css` files beyond these two.
   - ❌ **No inline `<style>` tags**: Do not write `<style>` blocks in EJS view files.
   - ❌ **No inline `style="..."` attributes**: Do not use inline styles for margins, padding, colors, font sizes, or flexbox layouts. Minimal exceptions allowed for fixed-dimension elements (icon circles, avatars) where Bootstrap utilities are insufficient.

3. **Pure Bootstrap Utilities Replacement Guide**:
   Instead of custom CSS, always use Bootstrap's standard utility classes:
   - Margin/Padding: `m-0`, `my-2`, `mb-3`, `ms-auto`, `p-2`, `px-3`, `py-4`
   - Flexbox: `d-flex`, `align-items-center`, `justify-content-between`, `justify-content-center`, `flex-wrap`, `gap-2`, `gap-3`
   - Colors: `text-primary`, `text-secondary`, `text-success`, `text-danger`, `text-muted`, `bg-light`, `bg-white`, `bg-dark`
   - Borders: `border`, `border-top`, `border-0`, `rounded`, `rounded-circle`, `rounded-pill`
   - Typography: `fw-bold`, `fw-semibold`, `fw-normal`, `fs-4`, `fs-5`, `fs-6`, `text-center`, `text-end`
   - Display: `d-none`, `d-block`, `d-inline-flex`, `d-md-block`

4. **Thermal Printer Exemption**:
   - Media queries and page declarations strictly required for physical thermal printer hardware (`@page { size: 80mm auto; margin: 0; }` or `@media print`) on thermal receipt and wash tag views are exempt from this restriction.
