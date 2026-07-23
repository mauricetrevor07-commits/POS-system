const DB = {
  async _fetch(url, options = {}) {
    const token = localStorage.getItem('authToken') || '';
    const res = await fetch(url, {
      ...options,
      headers: {
        'X-Auth-Token': token,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || res.statusText);
    }
    const data = await res.json();
    return data;
  }
};