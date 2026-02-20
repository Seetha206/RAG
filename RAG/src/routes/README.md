# Routes

## Purpose
Centralized route path definitions for the application.

## Structure
- `routeNames.ts` — All route path constants and dynamic route functions

## Rules
- All route paths must be defined in `routeNames.ts`
- Static routes are string constants (e.g., `LOGIN: '/login'`)
- Dynamic routes are functions (e.g., `MY_PROFILE: (org: string) => ...`)
- Never hardcode route paths in components

## Usage
```tsx
import { ROUTES } from '@routes/routeNames';

<Link to={ROUTES.LOGIN}>Login</Link>
<Link to={ROUTES.MY_PROFILE('my-org')}>Profile</Link>
```

## Adding a New Route
1. Add the path constant/function to `ROUTES` in `routeNames.ts`
2. Add the corresponding page component in `src/pages/`
3. Wire the route in your router configuration
