import { describe, it, expect } from 'vitest'
import { computeLineDiff } from './line-diff'

describe('computeLineDiff', () => {
  describe('identical inputs', () => {
    it('marks every line as unchanged', () => {
      const diff = computeLineDiff('A\nB\nC', 'A\nB\nC')

      expect(diff).toEqual([
        { type: 'unchanged', text: 'A' },
        { type: 'unchanged', text: 'B' },
        { type: 'unchanged', text: 'C' },
      ])
    })
  })

  describe('pure insertion', () => {
    it('shows only the inserted line and keeps surrounding lines unchanged', () => {
      const diff = computeLineDiff('A\nB\nC', 'A\nX\nB\nC')

      expect(diff).toEqual([
        { type: 'unchanged', text: 'A' },
        { type: 'added', text: 'X' },
        { type: 'unchanged', text: 'B' },
        { type: 'unchanged', text: 'C' },
      ])
    })

    it('handles insertion at the very start', () => {
      const diff = computeLineDiff('B\nC', 'A\nB\nC')

      expect(diff).toEqual([
        { type: 'added', text: 'A' },
        { type: 'unchanged', text: 'B' },
        { type: 'unchanged', text: 'C' },
      ])
    })

    it('handles insertion at the very end', () => {
      const diff = computeLineDiff('A\nB', 'A\nB\nC')

      expect(diff).toEqual([
        { type: 'unchanged', text: 'A' },
        { type: 'unchanged', text: 'B' },
        { type: 'added', text: 'C' },
      ])
    })
  })

  describe('pure deletion', () => {
    it('shows only the deleted line and keeps surrounding lines unchanged', () => {
      const diff = computeLineDiff('A\nB\nC', 'A\nC')

      expect(diff).toEqual([
        { type: 'unchanged', text: 'A' },
        { type: 'removed', text: 'B' },
        { type: 'unchanged', text: 'C' },
      ])
    })
  })

  describe('modification', () => {
    it('shows a removed-then-added pair for a replaced line', () => {
      const diff = computeLineDiff('A\nB\nC', 'A\nX\nC')

      expect(diff).toEqual([
        { type: 'unchanged', text: 'A' },
        { type: 'removed', text: 'B' },
        { type: 'added', text: 'X' },
        { type: 'unchanged', text: 'C' },
      ])
    })
  })

  describe('insertion inside a large block does not mark every later line as changed', () => {
    it('only inserted lines are marked added — key regression fix', () => {
      const original = 'one\ntwo\nthree\nfour\nfive'
      const revised = 'one\ntwo\nNEW\nthree\nfour\nfive'

      const diff = computeLineDiff(original, revised)

      expect(diff).toEqual([
        { type: 'unchanged', text: 'one' },
        { type: 'unchanged', text: 'two' },
        { type: 'added', text: 'NEW' },
        { type: 'unchanged', text: 'three' },
        { type: 'unchanged', text: 'four' },
        { type: 'unchanged', text: 'five' },
      ])
    })
  })

  describe('empty inputs', () => {
    it('returns an empty diff when both sides are empty', () => {
      expect(computeLineDiff('', '')).toEqual([])
    })

    it('treats every line as added when original is empty', () => {
      expect(computeLineDiff('', 'A\nB')).toEqual([
        { type: 'added', text: 'A' },
        { type: 'added', text: 'B' },
      ])
    })

    it('treats every line as removed when revised is empty', () => {
      expect(computeLineDiff('A\nB', '')).toEqual([
        { type: 'removed', text: 'A' },
        { type: 'removed', text: 'B' },
      ])
    })
  })

  describe('completely disjoint inputs', () => {
    it('removes every original line and adds every revised line', () => {
      const diff = computeLineDiff('A\nB', 'X\nY')

      expect(diff.filter((l) => l.type === 'removed').map((l) => l.text)).toEqual(['A', 'B'])
      expect(diff.filter((l) => l.type === 'added').map((l) => l.text)).toEqual(['X', 'Y'])
      expect(diff.every((l) => l.type !== 'unchanged')).toBe(true)
    })
  })
})
