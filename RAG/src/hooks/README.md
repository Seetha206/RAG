# Hooks

## Purpose
Custom React hooks for shared stateful logic.

## Structure
- `redux.ts` — Typed `useAppDispatch` and `useAppSelector` hooks

## Rules
- All hooks must start with `use` prefix
- Keep hooks focused — one responsibility per hook
- Hooks should not contain UI rendering logic
- Always type return values

## Usage
```tsx
import { useAppSelector, useAppDispatch } from '@hooks/redux';
```

## Adding a New Hook
1. Create `src/hooks/useMyHook.ts`
2. Export the hook as a named export
3. Add TypeScript types for parameters and return values
