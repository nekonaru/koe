export interface History<T> {
  past: T[]
  present: T
  future: T[]
}

export function initHistory<T>(present: T): History<T> {
  return { past: [], present, future: [] }
}

export function commit<T>(h: History<T>, next: T, limit = 50): History<T> {
  if (next === h.present) return h
  const safeLimit = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 50
  const past = [...h.past, h.present]
  if (past.length > safeLimit) past.splice(0, past.length - safeLimit)
  return { past, present: next, future: [] }
}

export function undo<T>(h: History<T>): History<T> {
  if (h.past.length === 0) return h
  return {
    past: h.past.slice(0, -1),
    present: h.past[h.past.length - 1],
    future: [h.present, ...h.future],
  }
}

export function redo<T>(h: History<T>): History<T> {
  if (h.future.length === 0) return h
  return {
    past: [...h.past, h.present],
    present: h.future[0],
    future: h.future.slice(1),
  }
}

export function canUndo<T>(h: History<T>): boolean {
  return h.past.length > 0
}

export function canRedo<T>(h: History<T>): boolean {
  return h.future.length > 0
}
