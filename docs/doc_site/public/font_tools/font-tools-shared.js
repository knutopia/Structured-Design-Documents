(function () {
  const STORAGE_KEY = 'font-comparison-ratings';
  const COMBINATION_RATINGS_STORAGE_KEY = 'font-comparison-combinations';
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

  function readCombinationRatings() {
    try {
      const stored = JSON.parse(localStorage.getItem(COMBINATION_RATINGS_STORAGE_KEY) || '{}');
      if (!stored || typeof stored !== 'object' || !stored.combinations) {
        return { combinations: {}, titles: {}, bodyRatings: {} };
      }

      const combinations = {};
      const combinationByFont = new Map();
      Object.values(stored.combinations).forEach(entry => {
        if (![1, 2, 3].includes(Number(entry?.rating)) || !entry.title?.font) return;
        const current = combinationByFont.get(entry.title.font);
        if (!current || entry.rating > current.rating) combinationByFont.set(entry.title.font, entry);
      });
      combinationByFont.forEach(entry => {
        combinations[JSON.stringify({ title: entry.title, body: entry.body })] = entry;
      });

      const titles = {};
      const titleByFont = new Map();
      Object.values(stored.titles || {}).forEach(entry => {
        if (![1, 2, 3].includes(Number(entry?.rating)) || !entry.title?.font) return;
        const current = titleByFont.get(entry.title.font);
        if (!current || entry.rating > current.rating) titleByFont.set(entry.title.font, entry);
      });
      combinationByFont.forEach(entry => titleByFont.set(entry.title.font, {
        title: entry.title,
        rating: entry.rating
      }));
      titleByFont.forEach(entry => {
        titles[JSON.stringify(entry.title)] = entry;
      });

      return {
        combinations,
        titles,
        bodyRatings: stored.bodyRatings && typeof stored.bodyRatings === 'object'
          ? stored.bodyRatings
          : {}
      };
    } catch (error) {
      return { combinations: {}, titles: {}, bodyRatings: {} };
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

    function keyFor(name, role) {
      return role ? `${role}::${name}` : name;
    }

    function get(name, role = '') {
      const key = keyFor(name, role);
      if (preferences[key]) return preferences[key];
      if (role === 'title' && preferences[name]) return preferences[name];
      return { ...DEFAULT_PREFERENCE };
    }

    function update(name, changes, role = '') {
      const key = keyFor(name, role);
      preferences[key] = normalizePreference({ ...get(name, role), ...changes });
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

  function createCombinationRatingStore() {
    let ratings = readCombinationRatings();
    const listeners = new Set();

    function keyFor(title, body) {
      return JSON.stringify({ title, body });
    }

    function titleKey(title) {
      return JSON.stringify(title);
    }

    function get(title, body) {
      return ratings.combinations[keyFor(title, body)]?.rating || 0;
    }

    function has(title, body) {
      return Object.hasOwn(ratings.combinations, keyFor(title, body));
    }

    function getTitle(title) {
      return ratings.titles?.[titleKey(title)]?.rating || 0;
    }

    function hasTitle(title) {
      return Object.hasOwn(ratings.titles || {}, titleKey(title));
    }

    function hasAnyTitle(fontName) {
      return Object.values(ratings.titles || {})
        .some(entry => entry.title?.font === fontName && entry.rating > 0);
    }

    function hasAnyCombinationForTitle(fontName) {
      return Object.values(ratings.combinations || {})
        .some(entry => entry.title?.font === fontName && entry.rating > 0);
    }

    function getPreferredCombinationForTitle(fontName) {
      return Object.values(ratings.combinations || {})
        .filter(entry => entry.title?.font === fontName && entry.rating > 0)
        .sort((left, right) => right.rating - left.rating)[0] || null;
    }

    function bodyKey(body) {
      return JSON.stringify(body);
    }

    function getBody(body) {
      return ratings.bodyRatings?.[bodyKey(body)]?.rating || 0;
    }

    function hasBody(body) {
      return Object.hasOwn(ratings.bodyRatings || {}, bodyKey(body));
    }

    function setBody(body, rating) {
      ratings.bodyRatings ||= {};
      const key = bodyKey(body);
      const normalizedRating = [1, 2, 3].includes(Number(rating)) ? Number(rating) : 0;
      if (normalizedRating) {
        ratings.bodyRatings[key] = { body, rating: normalizedRating };
      } else {
        delete ratings.bodyRatings[key];
      }
    }

    function set(title, body, rating) {
      const normalizedRating = [1, 2, 3].includes(Number(rating)) ? Number(rating) : 0;
      Object.entries(ratings.combinations || {}).forEach(([key, entry]) => {
        if (entry.title?.font === title.font) delete ratings.combinations[key];
      });
      if (normalizedRating) {
        ratings.combinations[keyFor(title, body)] = {
          title,
          body,
          rating: normalizedRating
        };
      }
    }

    function setTitle(title, rating) {
      ratings.titles ||= {};
      Object.entries(ratings.titles).forEach(([key, entry]) => {
        if (entry.title?.font === title.font) delete ratings.titles[key];
      });
      const normalizedRating = [1, 2, 3].includes(Number(rating)) ? Number(rating) : 0;
      if (normalizedRating) {
        ratings.titles[titleKey(title)] = {
          title,
          rating: normalizedRating
        };
      }
    }

    function save() {
      try {
        localStorage.setItem(COMBINATION_RATINGS_STORAGE_KEY, JSON.stringify(ratings));
      } catch (error) {
        // Combination ratings still work in the current tab if storage is unavailable.
      }
    }

    function refresh() {
      ratings = readCombinationRatings();
      listeners.forEach(listener => listener());
    }

    window.addEventListener('storage', event => {
      if (event.key === COMBINATION_RATINGS_STORAGE_KEY) refresh();
    });

    return {
      get,
      has,
      getTitle,
      hasTitle,
      hasAnyTitle,
      hasAnyCombinationForTitle,
      getPreferredCombinationForTitle,
      getBody,
      hasBody,
      setBody,
      set,
      setTitle,
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
    createCombinationRatingStore,
    createPreferenceStore,
    createSelectionStore
  };
}());
