# Claude Code Instructions

## Code Quality
After any code changes, always run:
```bash
npm run code-quality
```

This command runs:
- `npm run format` - Prettier formatting
- `npm run lint:fix` - ESLint with auto-fix
- `npm run build` - TypeScript compilation check

## Available Commands
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier
- `npm run preview` - Preview production build