(function () {
  const STORAGE_KEY = 'font-comparison-ratings';
  const SELECTION_STORAGE_KEY = 'font-comparison-selections';
  const APPEARANCE_STORAGE_KEY = 'vitepress-theme-appearance';
  const DEFAULT_PREFERENCE = Object.freeze({
    rating: 0,
    weight: 400,
    style: 'normal',
    kerning: true,
    naturalTitleSpacing: false
  });
  const SUPPORTED_WEIGHTS = new Set([100, 200, 300, 400, 500, 600, 700, 800]);

  function normalizePreference(value) {
    if (typeof value === 'number') {
      return {
        ...DEFAULT_PREFERENCE,
        rating: [1, 2, 3].includes(value) ? value : 0
      };
    }

    return {
      ...DEFAULT_PREFERENCE,
      rating: [0, 1, 2, 3].includes(Number(value?.rating)) ? Number(value.rating) : 0,
      weight: SUPPORTED_WEIGHTS.has(Number(value?.weight)) ? Number(value.weight) : 400,
      style: value?.style === 'italic' ? 'italic' : 'normal',
      kerning: value?.kerning !== false,
      naturalTitleSpacing: value?.naturalTitleSpacing === true
    };
  }

  function readPreferences() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return Object.fromEntries(
        Object.entries(stored).map(([name, value]) => [name, normalizePreference(value)])
      );
    } catch (error) {
      return {};
    }
  }

  function readSelections() {
    try {
      const stored = JSON.parse(localStorage.getItem(SELECTION_STORAGE_KEY) || '{}');
      return stored && typeof stored === 'object' ? stored : {};
    } catch (error) {
      return {};
    }
  }

  function readAppearance() {
    try {
      const stored = localStorage.getItem(APPEARANCE_STORAGE_KEY);
      return ['auto', 'dark', 'light'].includes(stored) ? stored : null;
    } catch (error) {
      return null;
    }
  }

  function prefersDark() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  function isDarkAppearance(appearance) {
    return appearance === 'dark' || (appearance !== 'light' && prefersDark());
  }

  function applyAppearance(appearance = readAppearance()) {
    const isDark = isDarkAppearance(appearance);
    document.documentElement.classList.toggle('dark', isDark);
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
    return isDark;
  }

  applyAppearance();

  function createPreferenceStore() {
    let preferences = readPreferences();
    const listeners = new Set();

    function get(name) {
      return preferences[name] || { ...DEFAULT_PREFERENCE };
    }

    function update(name, changes) {
      preferences[name] = normalizePreference({ ...get(name), ...changes });
    }

    function save() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
      } catch (error) {
        // Preferences still work in the current tab if storage is unavailable.
      }
    }

    function refresh() {
      preferences = readPreferences();
      listeners.forEach(listener => listener());
    }

    window.addEventListener('storage', event => {
      if (event.key === STORAGE_KEY) refresh();
    });

    return {
      get,
      update,
      save,
      subscribe(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      }
    };
  }

  function createSelectionStore() {
    let selections = readSelections();
    const listeners = new Set();

    function get(key) {
      return typeof selections[key] === 'string' ? selections[key] : null;
    }

    function set(key, value) {
      if (typeof value === 'string') selections[key] = value;
    }

    function save() {
      try {
        localStorage.setItem(SELECTION_STORAGE_KEY, JSON.stringify(selections));
      } catch (error) {
        // Selections still work in the current tab if storage is unavailable.
      }
    }

    function refresh() {
      selections = readSelections();
      listeners.forEach(listener => listener());
    }

    window.addEventListener('storage', event => {
      if (event.key === SELECTION_STORAGE_KEY) refresh();
    });

    return {
      get,
      set,
      save,
      subscribe(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      }
    };
  }

  function createAppearanceStore() {
    let appearance = readAppearance();
    const listeners = new Set();

    function isDark() {
      return isDarkAppearance(appearance);
    }

    function notify() {
      applyAppearance(appearance);
      listeners.forEach(listener => listener(isDark()));
    }

    function setDark(value) {
      appearance = value === prefersDark() ? 'auto' : value ? 'dark' : 'light';
      try {
        localStorage.setItem(APPEARANCE_STORAGE_KEY, appearance);
      } catch (error) {
        // The appearance still works in the current tab if storage is unavailable.
      }
      notify();
    }

    function refresh() {
      appearance = readAppearance();
      notify();
    }

    window.addEventListener('storage', event => {
      if (event.key === APPEARANCE_STORAGE_KEY) refresh();
    });

    const mediaQuery = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery?.addEventListener('change', () => {
      if (appearance !== 'dark' && appearance !== 'light') notify();
    });

    return {
      isDark,
      setDark,
      subscribe(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      }
    };
  }

  window.SDD_FONT_TOOLS = {
    createAppearanceStore,
    createPreferenceStore,
    createSelectionStore
  };
}());
