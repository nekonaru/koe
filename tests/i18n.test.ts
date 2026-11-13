import { describe, expect, it } from 'vitest'
import en from '../src/i18n/en.json'
import id from '../src/i18n/id.json'

const EN_OR_EM_DASH = /[\u2013\u2014]/

function flatten(dict: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(dict).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key
    if (value !== null && typeof value === 'object') {
      return flatten(value as Record<string, unknown>, path)
    }
    return [path]
  })
}

describe('i18n dictionaries', () => {
  it('English and Indonesian have identical key sets', () => {
    const enKeys = flatten(en as unknown as Record<string, unknown>).sort()
    const idKeys = flatten(id as unknown as Record<string, unknown>).sort()
    expect(idKeys).toEqual(enKeys)
  })

  it('no empty strings', () => {
    const check = (dict: Record<string, unknown>) => {
      for (const value of Object.values(dict)) {
        if (value !== null && typeof value === 'object') {
          check(value as Record<string, unknown>)
        } else {
          expect(String(value).trim().length).toBeGreaterThan(0)
        }
      }
    }
    check(en as unknown as Record<string, unknown>)
    check(id as unknown as Record<string, unknown>)
  })

  it('has no en or em dashes', () => {
    const check = (dict: Record<string, unknown>) => {
      for (const value of Object.values(dict)) {
        if (value !== null && typeof value === 'object') {
          check(value as Record<string, unknown>)
        } else {
          expect(String(value)).not.toMatch(EN_OR_EM_DASH)
        }
      }
    }
    check(en as unknown as Record<string, unknown>)
    check(id as unknown as Record<string, unknown>)
  })
})