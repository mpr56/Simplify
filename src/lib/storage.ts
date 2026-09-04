/**
 * Versioned, fail-soft localStorage. Every accessor is wrapped: getItem and
 * setItem throw in private browsing and when the quota is exceeded, and a
 * dashboard should never blank out because a preference could not be saved.
 */
export const STORAGE_VERSION = 'v1'

export function storageKey(name: string): string {
  return `dashboard:${name}:${STORAGE_VERSION}`
}

export function loadJSON<T>(name: string): T | null {
  try {
    const raw = localStorage.getItem(storageKey(name))
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export function saveJSON(name: string, value: unknown): void {
  try {
    localStorage.setItem(storageKey(name), JSON.stringify(value))
  } catch {
    // Private browsing, quota exceeded, or storage disabled — non-fatal.
  }
}
