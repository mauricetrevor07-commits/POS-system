// Simple IndexedDB cache for GET requests
const Cache = {
  db: null,
  async init() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('pos-cache', 1);
      req.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('store')) db.createObjectStore('store');
      };
      req.onsuccess = e => {
        this.db = e.target.result;
        resolve();
      };
      req.onerror = () => reject(req.error);
    });
  },
  async get(key) {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('store', 'readonly');
      const store = tx.objectStore('store');
      const req = store.get(key);
      req.onsuccess = () => {
        const data = req.result;
        if (data && data.expiry > Date.now()) resolve(data.value);
        else resolve(null);
      };
      req.onerror = () => resolve(null);
    });
  },
  async set(key, value, ttl = 30000) {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('store', 'readwrite');
      const store = tx.objectStore('store');
      store.put({ value, expiry: Date.now() + ttl }, key);
      tx.oncomplete = resolve;
    });
  }
};