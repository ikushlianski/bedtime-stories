import { describe, it, expect } from 'vitest'
import { splitTextIntoLines, splitTextIntoBlocks } from './text-blocks'

describe('splitTextIntoLines', () => {
  it('returns an empty list for empty text', () => {
    expect(splitTextIntoLines('')).toEqual([{ index: 0, text: '', isBlock: false }])
  })

  it('marks a blank line as not a block', () => {
    const lines = splitTextIntoLines('Первый абзац.\n\nВторой абзац.')

    expect(lines).toEqual([
      { index: 0, text: 'Первый абзац.', isBlock: true },
      { index: 1, text: '', isBlock: false },
      { index: 2, text: 'Второй абзац.', isBlock: true },
    ])
  })

  it('marks a whitespace-only line as not a block', () => {
    const lines = splitTextIntoLines('Текст.\n   \nЕщё текст.')

    expect(lines[1]).toEqual({ index: 1, text: '   ', isBlock: false })
  })

  it('excludes a leading bold title line from being a block', () => {
    const lines = splitTextIntoLines('**Гоша и звёзды**\n\nПервый абзац истории.')

    expect(lines[0]).toEqual({ index: 0, text: '**Гоша и звёзды**', isBlock: false })
    expect(lines[2]).toEqual({ index: 2, text: 'Первый абзац истории.', isBlock: true })
  })

  it('excludes a leading markdown heading line from being a block', () => {
    const lines = splitTextIntoLines('# Гоша и звёзды\nПервый абзац истории.')

    expect(lines[0].isBlock).toBe(false)
    expect(lines[1].isBlock).toBe(true)
  })

  it('does not treat a bold-looking line as a title unless it is the first non-empty line', () => {
    const lines = splitTextIntoLines('Первый абзац.\n**не заголовок**\nТретий абзац.')

    expect(lines[1]).toEqual({ index: 1, text: '**не заголовок**', isBlock: true })
  })

  it('keeps original line index stable when the text contains duplicate paragraphs', () => {
    const lines = splitTextIntoLines('Гоша улыбнулся.\n\nГоша улыбнулся.')

    expect(lines[0].index).toBe(0)
    expect(lines[2].index).toBe(2)
    expect(lines[0].text).toBe(lines[2].text)
  })
})

describe('splitTextIntoBlocks', () => {
  it('returns an empty list for empty text', () => {
    expect(splitTextIntoBlocks('')).toEqual([])
  })

  it('returns an empty list for whitespace-only text', () => {
    expect(splitTextIntoBlocks('   \n\n   \n')).toEqual([])
  })

  it('returns one block per non-blank paragraph line', () => {
    const blocks = splitTextIntoBlocks('Первый абзац.\n\nВторой абзац.\n\nТретий абзац.')

    expect(blocks).toEqual([
      { index: 0, text: 'Первый абзац.' },
      { index: 2, text: 'Второй абзац.' },
      { index: 4, text: 'Третий абзац.' },
    ])
  })

  it('excludes a leading title line from the block list', () => {
    const blocks = splitTextIntoBlocks('**Гоша и звёзды**\n\nПервый абзац истории.\nВторой абзац истории.')

    expect(blocks).toEqual([
      { index: 2, text: 'Первый абзац истории.' },
      { index: 3, text: 'Второй абзац истории.' },
    ])
  })

  it('preserves duplicate paragraphs as separate blocks with distinct indices', () => {
    const blocks = splitTextIntoBlocks('Гоша улыбнулся.\n\nГоша улыбнулся.')

    expect(blocks).toHaveLength(2)
    expect(blocks[0].index).not.toBe(blocks[1].index)
    expect(blocks[0].text).toBe(blocks[1].text)
  })
})
