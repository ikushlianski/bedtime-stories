import '@testing-library/jest-dom/vitest'
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import PatchDiffView from './patch-diff-view'

afterEach(() => {
  cleanup()
})

describe('PatchDiffView', () => {
  it('renders unchanged text without any diff styling', () => {
    render(<PatchDiffView original="Гоша идёт домой" patched="Гоша идёт домой" />)

    const view = screen.getByTestId('patch-diff-view')
    expect(view).toHaveTextContent('Гоша идёт домой')
    expect(view.querySelector('[data-diff-type="added"]')).not.toBeInTheDocument()
    expect(view.querySelector('[data-diff-type="removed"]')).not.toBeInTheDocument()
  })

  it('marks removed and added words as visually distinguishable from unchanged and each other', () => {
    render(<PatchDiffView original="Гоша боится темноты" patched="Гоша боится грозы" />)

    const view = screen.getByTestId('patch-diff-view')
    const removed = view.querySelector('[data-diff-type="removed"]')
    const added = view.querySelector('[data-diff-type="added"]')

    expect(removed).toBeInTheDocument()
    expect(removed).toHaveTextContent('темноты')
    expect(added).toBeInTheDocument()
    expect(added).toHaveTextContent('грозы')

    expect(removed?.className).not.toBe('')
    expect(added?.className).not.toBe('')
    expect(removed?.className).not.toBe(added?.className)
  })

  it('renders the full replacement text as one added segment when nothing overlaps', () => {
    render(<PatchDiffView original="" patched="Совсем новый текст" />)

    const view = screen.getByTestId('patch-diff-view')
    const added = view.querySelector('[data-diff-type="added"]')

    expect(added).toHaveTextContent('Совсем новый текст')
  })
})
