import { describe, expect, it } from 'vitest'
import { CONFIRM_PHRASE, matchesConfirmPhrase } from './confirm'

describe('matchesConfirmPhrase', () => {
  it('accepts the phrase typed exactly', () => {
    expect(matchesConfirmPhrase(CONFIRM_PHRASE)).toBe(true)
  })

  it('accepts surrounding whitespace, which a paste or a stray space adds', () => {
    expect(matchesConfirmPhrase('  RESET  ')).toBe(true)
  })

  it('rejects the wrong case — typing it deliberately is the whole point', () => {
    expect(matchesConfirmPhrase('reset')).toBe(false)
    expect(matchesConfirmPhrase('Reset')).toBe(false)
  })

  it('rejects anything with extra characters', () => {
    expect(matchesConfirmPhrase('RESET!')).toBe(false)
    expect(matchesConfirmPhrase('RESET NOW')).toBe(false)
    expect(matchesConfirmPhrase('PRESET')).toBe(false)
  })

  it('rejects a partial phrase, so the button stays disabled while typing', () => {
    expect(matchesConfirmPhrase('RES')).toBe(false)
  })

  it('rejects an empty or blank box', () => {
    expect(matchesConfirmPhrase('')).toBe(false)
    expect(matchesConfirmPhrase('   ')).toBe(false)
  })
})
