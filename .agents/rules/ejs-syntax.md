# Rule: EJS Syntax & JSON Script Injection Guardrails

## Purpose
Prevents runtime JavaScript parse errors in browsers when embedding server-side Node.js data into frontend `<script>` blocks within EJS templates.

## Invariant Rules
1. **Never use space inside scriptlet delimiter (`<% -`)**:
   - In EJS, `<% - ... %>` evaluates as an expression in a scriptlet without printing output.
   - It turns `const data = <% - JSON.stringify(...) %>;` into `const data = ;`, causing a fatal browser `SyntaxError: Unexpected token ';'`.
2. **Correct Syntax**:
   - For raw JSON into `<script>`:
     ```javascript
     const cartServices = <%- JSON.stringify(cartservice || []) %>;
     const orderData = <%- JSON.stringify(order || {}) %>;
     const customerData = <%- JSON.stringify(customer || {}) %>;
     ```
   - For HTML-escaped string properties:
     ```javascript
     const storeName = "<%= (shop && shop.name) ? shop.name : '' %>";
     ```
3. **Always Default Nullish Values**:
   - Always chain `|| []` for arrays and `|| {}` for objects inside `JSON.stringify(...)`.
   - Protect nested array lookups:
     `customer: (Array.isArray(customer) && customer.length > 0) ? customer[0] : (customer || {})`

## Verification
Before committing template changes, run the validation tool:
`node .agents/skills/icleaners-core/scripts/validate-ejs.js`
