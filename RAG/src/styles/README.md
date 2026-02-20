# Styles

## Purpose
Global stylesheets, design tokens, and utility classes.

## Structure
- `variables.css` — CSS custom properties (design tokens)
- `reset.css` — Browser reset/normalize
- `common.css` — Utility classes using design tokens
- `global.css` — Entry point that imports all style files

## Rules
- All color, spacing, font, and sizing values must use `var(--token)` syntax
- Never use hardcoded values — always reference design tokens
- Component styles go in CSS Modules (`.module.css`), not here
- Import `global.css` once in the app entry point

## Usage
Import `global.css` in your main entry file:
```tsx
import '@styles/global.css';
```

Use utility classes in JSX:
```tsx
<div className="flex items-center gap-4">
```

## Adding New Tokens
1. Add CSS custom properties to `variables.css`
2. Use them in components via `var(--your-token)`
