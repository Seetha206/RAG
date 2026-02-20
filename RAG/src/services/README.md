# Services

## Purpose
API communication layer. All HTTP requests go through this directory.

## Structure
- `api/axiosConfig.ts` — Axios instance with interceptors
- `api/urls.ts` — All API endpoint URLs
- `api/authService.ts` — Authentication API calls
- `api/userService.ts` — User-related API calls

## Rules
- All endpoints must be defined in `urls.ts`
- Use `apiClient` from `axiosConfig.ts` — never import axios directly
- Method names use HTTP verb prefix: `getUser`, `postSignin`, `deleteSession`
- All methods return typed promises
- Never handle UI concerns (toasts, redirects) in services — the 401 interceptor is the only exception

## Usage
```tsx
import { getUser } from '@services/api/userService';
const response = await getUser();
```

## Adding a New Service
1. Add endpoint URLs to `src/services/api/urls.ts`
2. Create `src/services/api/myService.ts`
3. Import `apiClient` and the URL constants
4. Export typed async functions with HTTP verb prefixes
