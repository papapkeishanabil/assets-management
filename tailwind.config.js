/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        white: 'rgb(var(--color-white) / <alpha-value>)',
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        ink: {
          990: 'rgb(var(--ink-990) / <alpha-value>)',
          950: 'rgb(var(--ink-950) / <alpha-value>)',
          900: 'rgb(var(--ink-900) / <alpha-value>)',
          880: 'rgb(var(--ink-880) / <alpha-value>)',
          870: 'rgb(var(--ink-870) / <alpha-value>)',
          860: 'rgb(var(--ink-860) / <alpha-value>)',
          850: 'rgb(var(--ink-850) / <alpha-value>)',
          840: 'rgb(var(--ink-840) / <alpha-value>)',
          800: 'rgb(var(--ink-800) / <alpha-value>)',
          700: 'rgb(var(--ink-700) / <alpha-value>)',
          600: 'rgb(var(--ink-600) / <alpha-value>)',
          500: 'rgb(var(--ink-500) / <alpha-value>)',
          400: 'rgb(var(--ink-400) / <alpha-value>)',
          300: 'rgb(var(--ink-300) / <alpha-value>)',
          200: 'rgb(var(--ink-200) / <alpha-value>)',
        },
        success: {
          50: '#ecfdf5', 100: '#d1fae5', 200: '#a7f3d0', 300: '#6ee7b7',
          400: '#34d399', 500: '#10b981', 600: '#059669', 700: '#047857',
          800: '#065f46', 900: '#064e3b',
        },
        warning: {
          50: '#fffbeb', 100: '#fef3c7', 200: '#fde68a', 300: '#fcd34d',
          400: '#fbbf24', 500: '#f59e0b', 600: '#d97706', 700: '#b45309',
          800: '#92400e', 900: '#78350f',
        },
        danger: {
          50: '#fef2f2', 100: '#fee2e2', 200: '#fecaca', 300: '#fca5a5',
          400: '#f87171', 500: '#ef4444', 600: '#dc2626', 700: '#b91c1c',
          800: '#991b1b', 900: '#7f1d1d',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'Menlo', 'monospace'],
        display: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.5s ease-out',
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'pulse-slow': 'pulseSlow 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow-pulse': 'glowPulse 3s ease-in-out infinite',
        'shimmer': 'shimmer 3s linear infinite',
        'orbit': 'orbit 20s linear infinite',
        'ping-slow': 'pingSlow 2s cubic-bezier(0, 0, 0.2, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        pulseSlow: {
          '0%, 100%': { opacity: '0.5' },
          '50%': { opacity: '0.9' },
        },
        glowPulse: {
          '0%, 100%': { boxShadow: '0 0 0 1px rgba(59,130,246,0.3), 0 4px 24px -4px rgba(59,130,246,0.45)' },
          '50%': { boxShadow: '0 0 0 1px rgba(59,130,246,0.5), 0 6px 32px -4px rgba(59,130,246,0.65)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        orbit: {
          '0%': { transform: 'translate(0, 0) scale(1)' },
          '50%': { transform: 'translate(40px, -30px) scale(1.1)' },
          '100%': { transform: 'translate(0, 0) scale(1)' },
        },
        pingSlow: {
          '75%, 100%': { transform: 'scale(2)', opacity: '0' },
        },
      },
      boxShadow: {
        'glow-blue': '0 0 0 1px rgba(59,130,246,0.3), 0 4px 24px -4px rgba(59,130,246,0.45), inset 0 1px 0 rgba(255,255,255,0.1)',
        'glow-emerald': '0 0 0 1px rgba(16,185,129,0.3), 0 4px 24px -4px rgba(16,185,129,0.4), inset 0 1px 0 rgba(255,255,255,0.08)',
        'glow-amber': '0 0 0 1px rgba(245,158,11,0.3), 0 4px 24px -4px rgba(245,158,11,0.4), inset 0 1px 0 rgba(255,255,255,0.08)',
        'glow-rose': '0 0 0 1px rgba(244,63,94,0.3), 0 4px 24px -4px rgba(244,63,94,0.4), inset 0 1px 0 rgba(255,255,255,0.08)',
        'glow-indigo': '0 0 0 1px rgba(99,102,241,0.3), 0 4px 24px -4px rgba(99,102,241,0.45), inset 0 1px 0 rgba(255,255,255,0.1)',
        'soft': '0 2px 15px -3px rgba(0, 0, 0, 0.4), 0 2px 8px -2px rgba(0, 0, 0, 0.2)',
        'soft-lg': '0 10px 40px -10px rgba(0, 0, 0, 0.5), 0 2px 10px -2px rgba(0, 0, 0, 0.3)',
      },
      backgroundImage: {
        'dot-grid': 'radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)',
      },
      backgroundSize: {
        '24': '24px 24px',
      },
    },
  },
  plugins: [],
}
