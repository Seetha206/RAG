# Functions

## Purpose
Environment-aware configuration utilities. Resolves runtime values based on the current Vite mode.

## Structure
- `Utils.ts` — The ONLY file that reads `import.meta.env.MODE`. Contains getter functions.
- `static_variable.ts` — Calls Utils once at startup and exports a frozen config object.

## Rules
- **NEVER** import `Utils.ts` directly in components or services
- **ALWAYS** import from `static_variable.ts` instead
- Only `Utils.ts` may branch on `import.meta.env.MODE`
- `static_variable` is `as const` — values are resolved once and never change

## Usage
```tsx
import static_variable from '@functions/static_variable';
const url = static_variable.server_url;
```

## Adding a New Config Value
1. Add the getter function to `Utils.ts`
2. Add the resolved value to `static_variable.ts`
3. Import from `static_variable` in your code
