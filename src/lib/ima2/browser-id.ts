const BROWSER_ID_STORAGE_KEY = 'imahe.browserId';
const BROWSER_ID_PREFIX = 'imahe-';
const SAFE_BROWSER_ID_PATTERN = /^[A-Za-z0-9._~-]+$/;

let fallbackBrowserId: string | null = null;

export function getIma2BrowserId(): string {
  const storage = getLocalStorage();

  if (storage) {
    const storedBrowserId = readStoredBrowserId(storage);

    if (storedBrowserId) {
      return storedBrowserId;
    }
  }

  const browserId = createBrowserId();

  if (storage) {
    writeStoredBrowserId(storage, browserId);
  } else {
    fallbackBrowserId = browserId;
  }

  return browserId;
}

function readStoredBrowserId(storage: Storage): string | null {
  try {
    const storedValue = storage.getItem(BROWSER_ID_STORAGE_KEY);

    if (isSafeBrowserId(storedValue)) {
      return storedValue;
    }
  } catch {
    return null;
  }

  return null;
}

function writeStoredBrowserId(storage: Storage, browserId: string) {
  try {
    storage.setItem(BROWSER_ID_STORAGE_KEY, browserId);
  } catch {
    fallbackBrowserId = browserId;
  }
}

function createBrowserId() {
  if (fallbackBrowserId) {
    return fallbackBrowserId;
  }

  const randomId = getRandomId();
  return `${BROWSER_ID_PREFIX}${randomId}`;
}

function getRandomId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function getLocalStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function isSafeBrowserId(value: string | null): value is string {
  return Boolean(value && SAFE_BROWSER_ID_PATTERN.test(value));
}
