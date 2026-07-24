import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

export default function ThemeToggle({ className = '' }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      onClick={toggleTheme}
      className={`relative p-2 text-ink-300 hover:bg-white/5 hover:text-white rounded-md transition-all ${className}`}
      aria-label={isDark ? 'Aktifkan light mode' : 'Aktifkan dark mode'}
      title={isDark ? 'Mode terang' : 'Mode gelap'}
      aria-pressed={!isDark}
    >
      {isDark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
