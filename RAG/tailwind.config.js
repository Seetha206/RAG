/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#0d6cf2',
        'bg-light': '#f5f7f8',
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
