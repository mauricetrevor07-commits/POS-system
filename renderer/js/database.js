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
    
    const text = await res.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch (_) {
      if (!res.ok) {
        throw new Error(`Server Error (${res.status}): ${res.statusText}`);
      }
      throw new Error('Unexpected server response format');
    }

    if (!res.ok) {
      throw new Error(data.error || data.message || `Request failed with status ${res.status}`);
    }

    return data;
  }
};