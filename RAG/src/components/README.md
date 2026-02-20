# Components

## Purpose
Reusable UI components organized by scope. All React components live here.

## Structure
- `common/` — Shared components used across multiple pages (Button, Input, Modal, etc.)
- `layout/` — Layout components (Header, Sidebar, Footer, PageWrapper)

## Rules
- Each component gets its own folder: `ComponentName/ComponentName.tsx`
- Co-locate styles (`ComponentName.module.css`) and tests (`ComponentName.test.tsx`)
- Always export from an `index.ts` barrel file
- Use CSS Modules only — no inline styles, no global CSS
- All style values must use `var(--token)` design tokens
- Props interface must be exported alongside the component

## Usage
```tsx
import { Button } from '@components/common/Button';
```

## Adding a New Component
1. Create folder: `src/components/common/MyComponent/`
2. Create `MyComponent.tsx` with named + default export
3. Create `MyComponent.module.css` using design tokens
4. Create `MyComponent.test.tsx` with `should + verb` descriptions
5. Create `index.ts` barrel file
