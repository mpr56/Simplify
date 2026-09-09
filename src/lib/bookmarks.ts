/**
 * A bookmark is typed as "example.com" far more often than as a full URL, and
 * the scheme rule lives here so the dock and the settings panel cannot drift.
 */
export function normalizeBookmarkUrl(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
}
