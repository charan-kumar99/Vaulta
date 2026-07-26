/* ============================================
   DocVault — Search & Filter Engine
   ============================================ */

const DocSearch = (() => {
  let debounceTimer = null;

  /**
   * Normalize a string for comparison (lowercase, trim, remove extra spaces)
   */
  function normalize(str) {
    return (str || '').toLowerCase().trim().replace(/\s+/g, ' ');
  }

  /**
   * Simple fuzzy match — checks if all characters in the query
   * appear in order within the target string.
   */
  function fuzzyMatch(query, target) {
    const q = normalize(query);
    const t = normalize(target);

    if (!q) return true;
    if (t.includes(q)) return true;

    let qi = 0;
    for (let ti = 0; ti < t.length && qi < q.length; ti++) {
      if (t[ti] === q[qi]) qi++;
    }
    return qi === q.length;
  }

  /**
   * Calculate relevance score for sorting results.
   * Higher score = more relevant.
   */
  function relevanceScore(query, doc) {
    const q = normalize(query);
    if (!q) return 0;

    let score = 0;
    const name = normalize(doc.name);
    const category = normalize(doc.category);
    const folder = normalize(doc.folder || '');
    const tags = (doc.tags || []).map(normalize);

    // Exact name match
    if (name === q) score += 100;
    // Name starts with query
    else if (name.startsWith(q)) score += 80;
    // Name contains query
    else if (name.includes(q)) score += 60;
    // Fuzzy name match
    else if (fuzzyMatch(q, name)) score += 30;

    // Category match
    if (category.includes(q)) score += 40;

    // Folder match
    if (folder.includes(q)) score += 35;

    // Tag match
    for (const tag of tags) {
      if (tag === q) score += 50;
      else if (tag.includes(q)) score += 25;
    }

    // Favorite boost
    if (doc.isFavorite) score += 5;

    return score;
  }

  /**
   * Search documents by query string.
   * Searches across name, category, and tags.
   * @param {Object[]} documents - Array of document metadata
   * @param {string} query - Search query
   * @returns {Object[]} Filtered and sorted results
   */
  function search(documents, query) {
    const q = normalize(query);

    if (!q) return documents;

    return documents
      .map((doc) => ({
        ...doc,
        _score: relevanceScore(query, doc),
      }))
      .filter((doc) => doc._score > 0)
      .sort((a, b) => b._score - a._score)
      .map(({ _score, ...doc }) => doc);
  }

  /**
   * Filter documents by criteria.
   * @param {Object[]} documents - Array of document metadata
   * @param {Object} filters
   * @param {string} [filters.vault] - 'personal' or 'official'
   * @param {string} [filters.category] - Category name (or 'all')
   * @param {string} [filters.folder] - Folder name (or 'all')
   * @param {boolean} [filters.favoritesOnly] - Only show favorites
   * @returns {Object[]} Filtered results
   */
  function filter(documents, filters = {}) {
    let result = [...documents];

    if (filters.vault) {
      result = result.filter((doc) => doc.vault === filters.vault);
    }

    if (filters.category && filters.category !== 'all') {
      result = result.filter(
        (doc) => normalize(doc.category) === normalize(filters.category)
      );
    }

    if (filters.folder && filters.folder !== 'all') {
      result = result.filter(
        (doc) => normalize(doc.folder || '') === normalize(filters.folder)
      );
    }

    if (filters.favoritesOnly) {
      result = result.filter((doc) => doc.isFavorite);
    }

    return result;
  }

  /**
   * Sort documents by a given criterion.
   * @param {Object[]} documents
   * @param {string} sortBy - 'date-desc', 'date-asc', 'name-asc', 'name-desc', 'category'
   * @returns {Object[]} Sorted results
   */
  function sort(documents, sortBy = 'date-desc') {
    const sorted = [...documents];

    switch (sortBy) {
      case 'date-desc':
        return sorted.sort((a, b) => b.createdAt - a.createdAt);
      case 'date-asc':
        return sorted.sort((a, b) => a.createdAt - b.createdAt);
      case 'name-asc':
        return sorted.sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
        );
      case 'name-desc':
        return sorted.sort((a, b) =>
          b.name.localeCompare(a.name, undefined, { sensitivity: 'base' })
        );
      case 'category':
        return sorted.sort((a, b) =>
          a.category.localeCompare(b.category, undefined, { sensitivity: 'base' })
        );
      default:
        return sorted;
    }
  }

  /**
   * Combined: search + filter + sort in one pass.
   */
  function query(documents, { searchQuery = '', filters = {}, sortBy = 'date-desc' } = {}) {
    let result = documents;

    // Apply filter
    result = filter(result, filters);

    // Apply search
    if (searchQuery) {
      result = search(result, searchQuery);
    } else {
      // If no search query, apply sort
      result = sort(result, sortBy);
    }

    return result;
  }

  /**
   * Debounced search callback.
   * @param {Function} callback - Called with the search query after debounce
   * @param {number} delay - Debounce delay in ms
   */
  function debounced(callback, delay = 250) {
    return (query) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => callback(query), delay);
    };
  }

  /**
   * Get unique categories from a list of documents.
   */
  function getCategories(documents) {
    const categories = new Set();
    documents.forEach((doc) => {
      if (doc.category) categories.add(doc.category);
    });
    return Array.from(categories).sort();
  }

  // Public API
  return {
    search,
    filter,
    sort,
    query,
    debounced,
    getCategories,
    fuzzyMatch,
  };
})();
