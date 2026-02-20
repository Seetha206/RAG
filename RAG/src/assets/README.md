# Assets

## Purpose
Static assets such as images, icons, fonts, and other media files.

## Structure
Organize by type:
- `images/` — PNG, JPG, SVG images
- `fonts/` — Custom font files
- `icons/` — SVG icon files

## Rules
- Use descriptive file names in kebab-case
- Optimize images before committing
- Prefer SVG for icons and illustrations
- Use Vite's asset handling for imports

## Usage
```tsx
import logo from '@assets/images/logo.svg';
<img src={logo} alt="Logo" />
```

## Adding New Assets
1. Place the file in the appropriate subdirectory
2. Import using the `@assets` alias
3. Reference in your component
