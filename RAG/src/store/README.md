# Store (Redux)

## Purpose
Global state management using Redux Toolkit with redux-persist.

## Structure
- `index.ts` — Store configuration, persistor, type exports
- `slices/authSlice.ts` — Authentication state
- `slices/uiSlice.ts` — UI state (popups, global loading)
- `slices/organizationSlice.ts` — Organization data
- `slices/profileSlice.ts` — User profile data

## Rules
- Use `createSlice` from Redux Toolkit
- Reducer names use `set` prefix for setters: `setLoading`, `setError`
- Selectors use `select` prefix: `selectUser`, `selectIsAuthenticated`
- Never access store directly in components — use `useAppSelector` and `useAppDispatch`
- Only `auth` and `organization` slices are persisted

## Usage
```tsx
import { useAppSelector, useAppDispatch } from '@hooks/redux';
import { selectUser, logout } from '@store/slices/authSlice';

const user = useAppSelector(selectUser);
const dispatch = useAppDispatch();
dispatch(logout());
```

## Adding a New Slice
1. Create `src/store/slices/mySlice.ts`
2. Define state interface, initial state, reducers, and selectors
3. Add the reducer to `combineReducers` in `src/store/index.ts`
4. Add to `persistConfig.whitelist` if persistence is needed
