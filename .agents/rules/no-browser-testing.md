# Rule: Prohibition of Chrome Browser Testing by AI Agent

## Purpose
Prevents sluggish, error-prone, or disruptive automated browser sessions in Chrome by AI agents. All visual and end-to-end browser testing is reserved for the human developer.

## Invariant Rules
1. **Never Launch Browser Subagents**:
   - The AI agent must **never** call `browser_subagent` or attempt to automate Chrome browser clicks, form fills, or navigation.
   - Do not open URLs or tabs in Chrome.
2. **Acceptable Non-Browser Verification Techniques**:
   - **Syntax & Template Compilation**: Run `node .agents/skills/icleaners-core/scripts/validate-ejs.js` to compile templates.
   - **API & Endpoint Checks**: Ping endpoints using HTTP requests (`node -e "..."` or `curl`).
   - **Hardware & Service Checks**: Run dedicated health-check scripts (e.g. `node .agents/skills/pos-printing/scripts/check-print-server.js`).
   - **Database & Log Checks**: Inspect server console logs, task logs, or query the database via Node.js scripts.
3. **Instruct the User for UI Checks**:
   - Once backend code or templates are modified and verified via non-browser scripts, provide the exact steps/URLs for the user to view in their own browser.
