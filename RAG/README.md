# RAG

A production-ready React + TypeScript application built with Vite.

## Quick Start

```bash
npm install
npm run dev
```

The dev server starts at [http://localhost:3000](http://localhost:3000).

## Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start development server on port 3000 |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint on `src/` |
| `npm run lint:fix` | Run ESLint with auto-fix |
| `npm run format` | Format code with Prettier |
| `npm run format:check` | Check formatting without writing |
| `npm run test` | Run tests with Vitest (watch mode) |
| `npm run test:ui` | Run tests with Vitest UI |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run type-check` | Run TypeScript type checking |

## Environments

| Environment | Mode | API Base URL |
|---|---|---|
| Development | `development` | `http://localhost:8080/app` |
| Staging | `testlive` | `https://testlive.yourapp.com` |
| Production | `production` | `https://services.yourapp.com` |

Environment variables are defined in `.env.development`, `.env.testlive`, and `.env.production`.

## Project Structure

```
src/
├── __tests__/          # Test setup and shared test utilities
├── assets/             # Static assets (images, fonts, icons)
├── components/         # Reusable UI components
│   ├── common/         # Shared components (Button, Input, Modal)
│   └── layout/         # Layout components (Header, Sidebar, Footer)
├── functions/          # Environment config (Utils.ts, static_variable.ts)
├── hooks/              # Custom React hooks
├── i18n/               # Internationalization strings
├── pages/              # Page-level route components
├── routes/             # Route path definitions
├── services/           # API communication layer
│   └── api/            # Axios config, URL constants, service modules
├── store/              # Redux Toolkit store and slices
│   └── slices/         # Individual state slices
├── styles/             # Global styles, design tokens, utilities
├── types/              # Shared TypeScript interfaces
└── utils/              # Pure utility functions and constants
```

## Key Architectural Decisions

| Decision | Rationale |
|---|---|
| Redux Toolkit + redux-persist | Predictable state management with automatic persistence |
| Axios with interceptors | Centralized auth token injection and 401 handling |
| CSS Modules + design tokens | Scoped styles with consistent design system |
| Zod validation | Runtime type safety with inferred TypeScript types |
| Path aliases (13 aliases) | Clean imports, no relative path chains |
| `static_variable.ts` pattern | Single source of truth for environment config |
| i18n string registry | All UI text centralized for easy updates |
| Co-located tests | Tests live next to the components they test |

## Tech Stack

| Category | Technology |
|---|---|
| Framework | React 19 |
| Language | TypeScript 5.9 |
| Build Tool | Vite 7 |
| State Management | Redux Toolkit + redux-persist |
| HTTP Client | Axios |
| Routing | React Router DOM 7 |
| Forms | React Hook Form + Zod |
| Icons | Lucide React |
| Notifications | React Toastify |
| Testing | Vitest + Testing Library |
| Linting | ESLint |
| Formatting | Prettier |
