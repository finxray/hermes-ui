// Minimal in-memory IndexedDB fake — just enough to exercise
// LocalIndexedDbMemoryStore in Node (which has no native IndexedDB).
//
// It supports the subset the store actually uses: open + onupgradeneeded,
// createObjectStore({ keyPath }), objectStoreNames.contains, transaction()
// with oncomplete/onerror/onabort, and store ops get/getAll/put/delete/clear.
//
// Timing mirrors real IndexedDB closely enough for the store's transaction
// wrapper: request.onsuccess callbacks fire (as microtasks) before the owning
// transaction's oncomplete. This is a test helper, not a spec-complete polyfill.

function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

class FakeRequest {
  constructor() {
    this.result = undefined;
    this.error = null;
    this.onsuccess = null;
    this.onerror = null;
  }
}

class FakeObjectStore {
  constructor(name, keyPath, data, tx) {
    this.name = name;
    this.keyPath = keyPath;
    this._data = data;
    this._tx = tx;
  }

  _run(fn) {
    const request = new FakeRequest();
    this._tx._enqueue(() => {
      try {
        request.result = fn();
        request.onsuccess && request.onsuccess({ target: request });
      } catch (error) {
        request.error = error;
        if (request.onerror) {
          request.onerror({ target: request });
        } else {
          this._tx._fail(error);
        }
      }
    });
    return request;
  }

  get(key) {
    return this._run(() => clone(this._data.get(key)));
  }

  getAll() {
    return this._run(() => [...this._data.values()].map(clone));
  }

  put(value) {
    return this._run(() => {
      const key = value[this.keyPath];
      if (key === undefined) {
        throw new Error(`Missing keyPath "${this.keyPath}" on stored value.`);
      }
      this._data.set(key, clone(value));
      return key;
    });
  }

  delete(key) {
    return this._run(() => {
      this._data.delete(key);
      return undefined;
    });
  }

  clear() {
    return this._run(() => {
      this._data.clear();
      return undefined;
    });
  }
}

class FakeTransaction {
  constructor(db, storeNames) {
    this._db = db;
    this._storeNames = storeNames;
    this._pending = 0;
    this._done = false;
    this.oncomplete = null;
    this.onerror = null;
    this.onabort = null;
    this.error = null;
    // Safety net for transactions with zero requests.
    setTimeout(() => this._maybeComplete(), 0);
  }

  objectStore(name) {
    if (!this._storeNames.includes(name)) {
      throw new Error(`Object store "${name}" is not in this transaction.`);
    }
    return new FakeObjectStore(name, this._db._keyPaths.get(name), this._db._stores.get(name), this);
  }

  _enqueue(task) {
    this._pending += 1;
    queueMicrotask(() => {
      if (this._done) {
        return;
      }
      task();
      this._pending -= 1;
      this._maybeComplete();
    });
  }

  _maybeComplete() {
    if (this._done || this._pending > 0) {
      return;
    }
    queueMicrotask(() => {
      if (this._done || this._pending > 0) {
        return;
      }
      this._done = true;
      this.oncomplete && this.oncomplete({ target: this });
    });
  }

  _fail(error) {
    if (this._done) {
      return;
    }
    this._done = true;
    this.error = error;
    this.onerror && this.onerror({ target: this });
  }

  abort() {
    if (this._done) {
      return;
    }
    this._done = true;
    this.onabort && this.onabort({ target: this });
  }
}

class FakeObjectStoreNames {
  constructor(db) {
    this._db = db;
  }
  contains(name) {
    return this._db._stores.has(name);
  }
}

class FakeDatabase {
  constructor(name, version) {
    this.name = name;
    this.version = version;
    this._stores = new Map();
    this._keyPaths = new Map();
    this.objectStoreNames = new FakeObjectStoreNames(this);
    this.onversionchange = null;
  }

  createObjectStore(name, options) {
    this._stores.set(name, new Map());
    this._keyPaths.set(name, options.keyPath);
    return new FakeObjectStore(name, options.keyPath, this._stores.get(name), {
      _enqueue() {},
      _fail() {}
    });
  }

  transaction(storeNames, _mode) {
    const names = Array.isArray(storeNames) ? storeNames : [storeNames];
    return new FakeTransaction(this, names);
  }

  close() {}
}

class FakeOpenRequest {
  constructor() {
    this.result = undefined;
    this.error = null;
    this.onsuccess = null;
    this.onerror = null;
    this.onupgradeneeded = null;
    this.onblocked = null;
  }
}

export class FakeIDBFactory {
  constructor() {
    this._databases = new Map();
  }

  open(name, version) {
    const request = new FakeOpenRequest();
    queueMicrotask(() => {
      let db = this._databases.get(name);
      const isNew = !db;
      if (isNew) {
        db = new FakeDatabase(name, version);
        this._databases.set(name, db);
      }
      request.result = db;
      if (isNew && request.onupgradeneeded) {
        request.onupgradeneeded({ target: request });
      }
      request.onsuccess && request.onsuccess({ target: request });
    });
    return request;
  }

  deleteDatabase(name) {
    this._databases.delete(name);
    const request = new FakeOpenRequest();
    queueMicrotask(() => request.onsuccess && request.onsuccess({ target: request }));
    return request;
  }
}
