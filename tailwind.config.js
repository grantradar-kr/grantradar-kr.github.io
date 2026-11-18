/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#ecfdf7',
          100: '#d1faec',
          200: '#a6f3da',
          300: '#6ee7c2',
          400: '#34d3a6',
          500: '#12b98d',
          600: '#059674',
          700: '#04785f',
          800: '#065f4c',
          900: '#064e40',
        },
        ink: {
          900: '#0b1220',
          700: '#1f2a3d',
          500: '#475569',
          400: '#64748b',
          300: '#94a3b8',
        },
        canvas: '#f5f7f9',
      },
      fontFamily: {
        sans: [
          'Pretendard',
          '-apple-system',
          'BlinkMacSystemFont',
          'Apple SD Gothic Neo',
          'Malgun Gothic',
          'Noto Sans KR',
          'system-ui',
          'sans-serif',
        ],
      },
      boxShadow: {
        card: '0 1px 2px rgba(15, 23, 42, 0.04), 0 8px 24px -12px rgba(15, 23, 42, 0.12)',
        pop: '0 24px 60px -20px rgba(15, 23, 42, 0.35)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'radar-ping': {
          '0%': { transform: 'scale(0.6)', opacity: '0.7' },
          '80%, 100%': { transform: 'scale(1.9)', opacity: '0' },
        },
      },
      animation: {
        'fade-up': 'fade-up 240ms ease-out both',
        'radar-ping': 'radar-ping 2.6s cubic-bezier(0, 0, 0.2, 1) infinite',
      },
    },
  },
  plugins: [],
}
