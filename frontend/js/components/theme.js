(function () {
  const STORAGE_KEY = 'almaarefa-theme';

  function getSavedTheme() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === 'dark' || raw === 'night') return 'dark';
    if (raw === 'light' || raw === 'paper' || raw === 'day') return 'light';
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_KEY, theme);
    renderThemeSwitchers(theme);
  }

  function renderThemeSwitchers(theme) {
    const containers = document.querySelectorAll('[data-theme-switcher]');
    containers.forEach((container) => {
      const isLight = theme === 'light';
      container.innerHTML = `
        <div role="radiogroup" aria-label="Color theme" class="inline-flex items-center gap-0.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            type="button"
            data-set-theme="light"
            aria-checked="${isLight}"
            title="Light — Warm sand & Almaarefa teal"
            class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              isLight ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }"
          >
            <i data-lucide="sun" class="w-3.5 h-3.5"></i>
            <span>Light</span>
          </button>
          <button
            type="button"
            data-set-theme="dark"
            aria-checked="${!isLight}"
            title="Dark — Obsidian dark theme for night study"
            class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              !isLight ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }"
          >
            <i data-lucide="moon" class="w-3.5 h-3.5"></i>
            <span>Dark</span>
          </button>
        </div>
      `;
    });

    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-set-theme]');
    if (btn) {
      applyTheme(btn.getAttribute('data-set-theme'));
    }
  });

  document.addEventListener('DOMContentLoaded', () => {
    applyTheme(getSavedTheme());
  });

  window.ThemeManager = { applyTheme, getSavedTheme };
})();