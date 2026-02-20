# Pages

## Purpose
Top-level route components. Each file maps to a route in the application.

## Structure
Each page is a folder containing the page component and its styles:
- `Login/Login.tsx`
- `Dashboard/Dashboard.tsx`

## Rules
- One page per route
- Pages compose components from `@components/`
- Pages should not contain reusable UI logic — extract to components or hooks
- Keep pages thin: fetch data, manage local state, render components

## Usage
```tsx
import LoginPage from '@pages/Login/Login';
```

## Adding a New Page
1. Create folder: `src/pages/MyPage/`
2. Create `MyPage.tsx` with the page component
3. Create `MyPage.module.css` for page-specific styles
4. Add the route to `src/routes/routeNames.ts`
5. Add the route mapping in your router config
