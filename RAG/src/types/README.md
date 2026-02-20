# Types

## Purpose
Shared TypeScript interfaces and type definitions used across the application.

## Structure
- `api.types.ts` — Generic API response types (`ApiResponse<T>`, `PaginatedResponse<T>`)
- `auth.types.ts` — Authentication types (`UserInfo`, `LoginCredentials`, `AuthTokens`)
- `org.types.ts` — Organization types (`OrgInfo`, `OrgMember`)

## Rules
- File names use `.types.ts` suffix
- Use `interface` for object shapes, `type` for unions/intersections
- Never use `any` — use `unknown` with type guards instead
- Export all types as named exports

## Usage
```tsx
import type { UserInfo } from '@types/auth.types';
import type { ApiResponse } from '@types/api.types';
```

## Adding a New Type File
1. Create `src/types/myFeature.types.ts`
2. Define interfaces/types with clear names
3. Export all types as named exports
