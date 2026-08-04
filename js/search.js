const DocSearch = (() => {
  let debounceTimer = null;

  function normalize(str) {
    return (str || '').toLowerCase().trim().replace(/\s+/g, ' ');
  }

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

  function relevanceScore(query, doc) {
    const q = normalize(query);
    if (!q) return 0;

    let score = 0;
    const name = normalize(doc.name);
    const category = normalize(doc.category);
    const folder = normalize(doc.folder || '');
    const tags = (doc.tags || []).map(normalize);

    if (name === q) score += 100;
    else if (name.startsWith(q)) score += 80;
    else if (name.includes(q)) score += 60;
    else if (fuzzyMatch(q, name)) score += 30;

    if (category.includes(q)) score += 40;
    if (folder.includes(q)) score += 35;

    for (const tag of tags) {
      if (tag === q) score += 50;
      else if (tag.includes(q)) score += 25;
    }

    if (doc.isFavorite) score += 5;

    return score;
  }

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

  function query(documents, { searchQuery = '', filters = {}, sortBy = 'date-desc' } = {}) {
    let result = documents;

    result = filter(result, filters);

    if (searchQuery) {
      result = search(result, searchQuery);
    } else {
      result = sort(result, sortBy);
    }

    return result;
  }

  function debounced(callback, delay = 250) {
    return (query) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => callback(query), delay);
    };
  }

  return {
    search,
    filter,
    sort,
    query,
    debounced,
  };
})();
