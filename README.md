<p align="center">
  <a href="https://nonstopio.com">
    <img src="https://github.com/nonstopio.png" alt="Nonstop Logo" height="128" />
  </a>
  <h1 align="center">NonStop</h1>
  <p align="center">Digital Product Development Experts for Startups & Enterprises</p>
  <p align="center">
    <a href="https://nonstopio.com/about-us">About</a> |
    <a href="https://nonstopio.com">Website</a>
  </p>
</p>

# JSON Viewer

A modern, intuitive JSON viewer that transforms complex JSON data into a visually appealing, easily navigable interface with comprehensive usage analytics.

## Features

### Core Functionality
- **Smart JSON Parsing & Validation** - Real-time syntax validation with clear error messages
- **Interactive Tree View** - Collapsible/expandable nodes with smooth animations
- **Multiple Input Methods** - Paste, upload, or drag & drop JSON files
- **Advanced Search** - Global search with real-time highlighting and navigation
- **Theme Support** - Dark/light/system theme with automatic detection
- **Copy Functionality** - Copy values and JSON paths with one click

### Analytics & Insights
- **Usage Tracking** - Daily active users, session duration, feature adoption
- **Interaction Analytics** - Node expansion, search queries, copy actions
- **Performance Metrics** - Parse times, file sizes, error rates
- **Privacy-First** - Anonymous tracking with local storage (production-ready for external services)

## Getting Started

### Prerequisites
- Node.js 16+ 
- npm or yarn

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd json-viewer-analytics

# Install dependencies
npm install

# Start development server
npm run dev
```

### Build for Production

```bash
# Build the application
npm run build

# Preview the build
npm run preview
```

## Usage

1. **Input JSON**: Paste JSON directly, upload a .json file, or drag & drop
2. **Explore**: Click to expand/collapse nodes, use search to find specific keys/values  
3. **Copy**: Hover over nodes to copy values or JSON paths
4. **Customize**: Toggle between light/dark themes or use system preference

### Keyboard Shortcuts
- `Ctrl+Enter` / `Cmd+Enter` - Parse JSON
- `Ctrl+F` / `Cmd+F` - Open search
- `Enter` - Next search result
- `Shift+Enter` - Previous search result
- `Escape` - Clear search

## Analytics Features

The application tracks user interactions to provide insights into usage patterns:

- **Core Events**: JSON parsing, file uploads, search queries
- **Interaction Events**: Node expansion/collapse, value copying, theme changes
- **Session Analytics**: User engagement, feature adoption, error tracking

All analytics data is stored locally by default and can be easily integrated with external analytics services.

## Technology Stack

- **Frontend**: React 18 + TypeScript
- **Styling**: Tailwind CSS with custom components
- **Icons**: Lucide React
- **Build Tool**: Vite
- **Analytics**: Custom event tracking system

## Architecture

```
src/
├── components/          # React components
├── hooks/              # Custom React hooks  
├── types/              # TypeScript type definitions
├── utils/              # Utility functions and services
└── App.tsx             # Main application component
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request
