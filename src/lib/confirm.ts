/** The word typed to unlock a destructive action. */
export const CONFIRM_PHRASE = 'RESET'

/**
 * Case-sensitive on purpose. Accepting "reset" would let muscle memory carry
 * you through the gate, and stopping exactly that is why the gate exists.
 * Whitespace is forgiven — a trailing space is a typo, not an intention.
 */
export function matchesConfirmPhrase(input: string): boolean {
  return input.trim() === CONFIRM_PHRASE
}
