# i18n (Internationalization)

## Purpose
Centralized string registry for all user-facing text in the application.

## Structure
- `i18n.ts` — String lookup map and `t()` function

## Rules
- All user-facing strings must go through `t('key')`
- Keys follow the pattern: `app.section.identifier`
- Never use raw text strings in JSX
- The `t()` function accepts an optional fallback parameter

## Usage
```tsx
import { t } from '@i18n/i18n';

<h1>{t('app.auth.login')}</h1>
<p>{t('app.custom.key', 'Default fallback text')}</p>
```

## Adding New Strings
1. Add key-value pairs to the `strings` object in `i18n.ts`
2. Follow the naming convention: `app.section.identifier`
3. Use the `t()` function to reference strings in components
