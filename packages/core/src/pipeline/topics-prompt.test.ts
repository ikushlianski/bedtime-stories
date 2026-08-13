import { describe, it, expect } from 'vitest'
import { extractTopicMarkers, buildTopicsBlock, MAX_TOPICS_PER_STORY } from './topics-prompt'

describe('extractTopicMarkers', () => {
  it('extracts several comma-separated ids and strips the marker line', () => {
    const plan = 'ЭМОЦИОНАЛЬНАЯ ЗАДАЧА\nтекст плана\n\nТЕМЫ: 4, 9'
    const result = extractTopicMarkers(plan)

    expect(result.topicIds).toEqual([4, 9])
    expect(result.cleanedText).toBe('ЭМОЦИОНАЛЬНАЯ ЗАДАЧА\nтекст плана')
    expect(result.cleanedText).not.toContain('ТЕМЫ')
  })

  it('accepts the # the model echoes and mixed separators', () => {
    const plan = 'план\nТЕМЫ: #4 и #9'
    const result = extractTopicMarkers(plan)

    expect(result.topicIds).toEqual([4, 9])
    expect(result.cleanedText).toBe('план')
  })

  it('returns empty when the plan declines all topics', () => {
    const plan = 'план истории\nТЕМЫ: нет'
    const result = extractTopicMarkers(plan)

    expect(result.topicIds).toEqual([])
    expect(result.cleanedText).toBe('план истории')
  })

  it('still accepts the singular ТЕМА heading', () => {
    const plan = 'план\nТЕМА: 5'
    const result = extractTopicMarkers(plan)

    expect(result.topicIds).toEqual([5])
  })

  it('dedupes repeated ids', () => {
    const plan = 'план\nТЕМЫ: 5, 5, 9'
    const result = extractTopicMarkers(plan)

    expect(result.topicIds).toEqual([5, 9])
  })

  it('treats a missing marker as no topics and leaves the text intact', () => {
    const plan = 'обычный план без маркера'
    const result = extractTopicMarkers(plan)

    expect(result.topicIds).toEqual([])
    expect(result.cleanedText).toBe(plan)
  })

  it('does not confuse an unrelated sentence containing "тем" with the marker', () => {
    const plan = 'Гоша наблюдает за тем, что происходит с другими.\nТЕМЫ: 2'
    const result = extractTopicMarkers(plan)

    expect(result.topicIds).toEqual([2])
    expect(result.cleanedText).toBe('Гоша наблюдает за тем, что происходит с другими.')
  })

  it('extracts fragment and topic markers independently when both are present', () => {
    const plan = 'план\nФРАГМЕНТЫ: 1\nТЕМЫ: 2, 3'
    const result = extractTopicMarkers(plan)

    expect(result.topicIds).toEqual([2, 3])
    expect(result.cleanedText).toBe('план\nФРАГМЕНТЫ: 1')
  })

  it('extracts the topics marker when it is the very last line after the fragments footer', () => {
    const plan = 'план\nФРАГМЕНТЫ: 1\nТЕМЫ: 2, 3\n'
    const result = extractTopicMarkers(plan)

    expect(result.topicIds).toEqual([2, 3])
    expect(result.cleanedText).toBe('план\nФРАГМЕНТЫ: 1')
  })
})

describe('buildTopicsBlock', () => {
  it('is empty when there are no eligible topics', () => {
    expect(buildTopicsBlock([])).toBe('')
  })

  it('marks previously-used topics, includes notes, and states the 2-3 guidance', () => {
    const block = buildTopicsBlock([
      { id: 1, title: 'терпение', note: 'умение ждать своей очереди', rank: 0, usedCount: 0 },
      { id: 2, title: 'зависть', note: null, rank: 0, usedCount: 3 },
    ])

    expect(block).toContain('[Тема #1] терпение — умение ждать своей очереди')
    expect(block).toContain('[Тема #2 (уже поднималась раньше)] зависть')
    expect(block).toContain('Выбери 2–3 темы')
    expect(block).toContain(`Обычно 2, иногда 3`)
    expect(block).toContain('ТЕМЫ: <id выбранных тем через запятую или слово нет>')
  })

  it('exposes a 3-topic per-story cap', () => {
    expect(MAX_TOPICS_PER_STORY).toBe(3)
  })

  it('instructs the plotter to weave in every topic, not pick a subset, in manual mode', () => {
    const block = buildTopicsBlock(
      [{ id: 1, title: 'терпение', note: null, rank: 0, usedCount: 0 }],
      'manual',
    )

    expect(block).toContain('вплети в сюжет КАЖДУЮ из них')
    expect(block).not.toContain('Выбери 2–3 темы')
    expect(block).not.toContain('можно взять меньше, вплоть до нуля')
    expect(block).toContain('ТЕМЫ: <id выбранных тем через запятую или слово нет>')
  })
})
