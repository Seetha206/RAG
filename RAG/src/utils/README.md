# Utils

## Purpose
Pure utility functions and constants. No side effects, no React dependencies.

## Structure
- `constants.ts` — Enums, config values, and limits
- `validation.ts` — Zod schemas and inferred types
- `helpers.ts` — Pure helper functions (formatDate, debounce, etc.)
- `alerts.ts` — Toast notification wrapper

## Rules
- Named exports only (tree-shakeable)
- Functions must be pure when possible
- All validation uses Zod — no inline validators
- Boolean variables use `is`/`has`/`show` prefix
- Constants use `UPPER_SNAKE_CASE`

## Usage
```tsx
import { formatDate, debounce } from '@utils/helpers';
import { loginSchema, type LoginForm } from '@utils/validation';
import { showAlert } from '@utils/alerts';
import { MemberStatus, MAX_FILE_SIZE_MB } from '@utils/constants';
```

## Adding a New Utility
1. Add to the appropriate existing file, or create a new one if it's a distinct concern
2. Use named exports only
3. Add TypeScript types for all parameters and return values
