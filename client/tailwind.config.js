/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#0b0b0f',
        secondary: '#12121a',
        tertiary: '#1a1a24',
        card: '#15151e',
        'card-hover': '#1c1c28',
        border: {
          DEFAULT: 'rgba(255,255,255,0.08)',
          hover: 'rgba(255,255,255,0.14)',
        },
        accent: {
          DEFAULT: '#e8c49a',
          hover: '#f0d4b0',
          soft: 'rgba(232,196,154,0.12)',
        },
        text: {
          primary: '#faf7f2',
          secondary: '#ddd9ec',
          muted: '#b2aec4',
        },
      },
      fontFamily: {
        display: ['"DM Serif Display"', 'serif'],
        body: ['"DM Sans"', '"PingFang SC"', '"Microsoft YaHei"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      animation: {
        'fade-up': 'fadeUp 0.5s ease-out forwards',
        'fade-in': 'fadeIn 0.4s ease-out forwards',
        'scale-in': 'scaleIn 0.3s ease-out forwards',
        'slide-down': 'slideDown 0.3s ease-out forwards',
      },
      keyframes: {
        fadeUp: {
          'from': { opacity: '0', transform: 'translateY(16px)' },
          'to': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          'from': { opacity: '0' },
          'to': { opacity: '1' },
        },
        scaleIn: {
          'from': { opacity: '0', transform: 'scale(0.95)' },
          'to': { opacity: '1', transform: 'scale(1)' },
        },
        slideDown: {
          'from': { opacity: '0', transform: 'translateY(-8px)' },
          'to': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
