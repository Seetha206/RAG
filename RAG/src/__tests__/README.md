# Tests

## Purpose
Test setup and shared test utilities.

## Structure
- `setup.ts` — Global test setup (imports jest-dom matchers)
- `test-utils.tsx` — Custom `render()` with Redux Provider and MemoryRouter

## Rules
- Component tests are co-located with their components (e.g., `Button.test.tsx`)
- This folder is for shared test infrastructure only
- Use `should + verb` for test descriptions
- Use the custom `render` from `test-utils.tsx` for components that need Redux or routing

## Usage
```tsx
import { render, screen } from '../__tests__/test-utils';
import { describe, it, expect } from 'vitest';

describe('MyComponent', () => {
  it('should render correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});
```

## Adding Test Utilities
1. Add shared mocks or helpers to this directory
2. Export from `test-utils.tsx` or create a new utility file
