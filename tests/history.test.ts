import { describe, expect, it } from 'vitest'
import { canRedo, canUndo, commit, initHistory, redo, undo } from '../src/lib/history'

describe('history', () => {
  it('initializes with empty past and future', () => {
    expect(initHistory(1)).toEqual({ past: [], present: 1, future: [] })
  })

  it('commits a new value and clears the future', () => {
    const first = commit(initHistory(1), 2)
    const second = commit(first, 3)
    const undone = undo(second)
    const redone = commit(undone, 4)
    expect(first).toEqual({ past: [1], present: 2, future: [] })
    expect(second).toEqual({ past: [1, 2], present: 3, future: [] })
    expect(redone.future).toEqual([])
  })

  it('skips a commit when the next value is strictly equal', () => {
    const h = initHistory(2)
    expect(commit(h, 2)).toBe(h)
    expect(commit(h, 2, 0)).toBe(h)
  })

  it('undoes and redoes in order', () => {
    const h = commit(commit(initHistory('a'), 'b'), 'c')
    const once = undo(h)
    expect(once).toEqual({ past: ['a'], present: 'b', future: ['c'] })
    const twice = undo(once)
    expect(twice).toEqual({ past: [], present: 'a', future: ['b', 'c'] })
    expect(redo(twice)).toEqual(once)
    expect(redo(once)).toEqual(h)
  })

  it('reports availability correctly', () => {
    const h = initHistory(0)
    expect(canUndo(h)).toBe(false)
    expect(canRedo(h)).toBe(false)
    expect(canUndo(commit(h, 1))).toBe(true)
    expect(canRedo(undo(commit(h, 1)))).toBe(true)
  })

  it('keeps at most the requested number of past states', () => {
    let h = initHistory(0)
    for (let i = 1; i <= 6; i++) h = commit(h, i, 3)
    expect(h.past).toEqual([3, 4, 5])
    expect(h.present).toBe(6)
    h = commit(h, 7, 0)
    expect(h.past).toEqual([])
  })

  it('does nothing at the undo and redo boundaries', () => {
    const h = initHistory('only')
    expect(undo(h)).toBe(h)
    expect(redo(h)).toBe(h)
  })
})
