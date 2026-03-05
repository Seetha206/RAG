/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#0d6cf2',
        'bg-light': '#f5f7f8',
        brand: {
          primary: '#fb7185',    // Midnight Rose — buttons, active nodes, chat header
          secondary: '#94a3b8',  // Soft Slate — icons, text highlights
          glow: '#1e293b',       // Warm Charcoal — cursor gradient spread
          dark: '#0f172a',       // Deep Charcoal — base background
        },
        chat: {
          bg: '#f5f7f8',
          sidebar: '#ffffff',
          input: '#ffffff',
          hover: '#f1f5f9',
          border: '#e2e8f0',
          user: '#0d6cf2',
          assistant: '#ffffff',
        },
      },
      fontFamily: {
        display: ['Inter', 'sans-serif'],
      },
      animation: {
        'bounce-dot': 'bounce-dot 1.4s infinite ease-in-out both',
      },
      keyframes: {
        'bounce-dot': {
          '0%, 80%, 100%': { transform: 'scale(0)' },
          '40%': { transform: 'scale(1)' },
        },
      },
    },
  },
  plugins: [],
};
