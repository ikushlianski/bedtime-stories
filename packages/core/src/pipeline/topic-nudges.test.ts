import { describe, it, expect } from 'vitest'
import { computeTopicNudges, type TopicNudgeInput } from './topic-nudges'

function topic(partial: Partial<TopicNudgeInput> & { id: number; title: string }): TopicNudgeInput {
  return {
    note: null,
    universeId: null,
    usedCount: 0,
    ...partial,
  }
}

describe('computeTopicNudges', () => {
  describe('clustering by shared stem', () => {
    it('groups three topics sharing the честн stem into one candidate', () => {
      const topics = [
        topic({ id: 1, title: 'Честность, когда трудно' }),
        topic({ id: 2, title: 'Быть честным с друзьями' }),
        topic({ id: 3, title: 'Поступать честно всегда' }),
        topic({ id: 4, title: 'Как построить домик из веток' }),
      ]

      const result = computeTopicNudges(topics)

      expect(result).toHaveLength(1)
      expect(result[0]!.count).toBe(3)
      expect(result[0]!.topicIds).toEqual([1, 2, 3])
      expect(result[0]!.keyword).toContain('честн')
    })

    it('does not pull unrelated topics into a cluster', () => {
      const topics = [
        topic({ id: 1, title: 'Честность важна' }),
        topic({ id: 2, title: 'Честный поступок' }),
        topic({ id: 3, title: 'Честно признаться' }),
        topic({ id: 4, title: 'Динозавры и вулканы' }),
        topic({ id: 5, title: 'Путешествие на луну' }),
      ]

      const result = computeTopicNudges(topics)

      expect(result).toHaveLength(1)
      expect(result[0]!.topicIds).not.toContain(4)
      expect(result[0]!.topicIds).not.toContain(5)
    })
  })

  describe('threshold boundary', () => {
    it('emits a candidate when exactly three topics share a stem', () => {
      const topics = [
        topic({ id: 1, title: 'Храбрость перед врачом' }),
        topic({ id: 2, title: 'Храбрый поступок' }),
        topic({ id: 3, title: 'Храбро шагнуть вперёд' }),
      ]

      const result = computeTopicNudges(topics)

      expect(result).toHaveLength(1)
      expect(result[0]!.count).toBe(3)
    })

    it('emits nothing when only two topics share a stem', () => {
      const topics = [
        topic({ id: 1, title: 'Храбрость перед врачом' }),
        topic({ id: 2, title: 'Храбрый поступок' }),
      ]

      const result = computeTopicNudges(topics)

      expect(result).toHaveLength(0)
    })
  })

  describe('used topics', () => {
    it('excludes topics that were already woven into a story', () => {
      const topics = [
        topic({ id: 1, title: 'Честность важна' }),
        topic({ id: 2, title: 'Честный поступок' }),
        topic({ id: 3, title: 'Честно признаться', usedCount: 1 }),
      ]

      const result = computeTopicNudges(topics)

      expect(result).toHaveLength(0)
    })
  })

  describe('noise suppression', () => {
    it('does not cluster on short stopword-like tokens', () => {
      const topics = [
        topic({ id: 1, title: 'Как про это' }),
        topic({ id: 2, title: 'Как про то' }),
        topic({ id: 3, title: 'Как про сё' }),
      ]

      const result = computeTopicNudges(topics)

      expect(result).toHaveLength(0)
    })

    it('does not cluster on the utility word когда', () => {
      const topics = [
        topic({ id: 1, title: 'Когда идёт снег' }),
        topic({ id: 2, title: 'Когда светит солнце' }),
        topic({ id: 3, title: 'Когда дует ветер' }),
      ]

      const result = computeTopicNudges(topics)

      expect(result).toHaveLength(0)
    })
  })

  describe('ё and е normalization', () => {
    it('clusters topics that differ only by ё versus е on the theme word', () => {
      const topics = [
        topic({ id: 1, title: 'Полёт на воздушном шаре' }),
        topic({ id: 2, title: 'Полет высоко в небе' }),
        topic({ id: 3, title: 'Полёт мечты' }),
      ]

      const result = computeTopicNudges(topics)

      expect(result).toHaveLength(1)
      expect(result[0]!.count).toBe(3)
      expect(result[0]!.keyword).toContain('полет')
    })
  })

  describe('determinism', () => {
    it('produces identical output regardless of input order', () => {
      const base = [
        topic({ id: 1, title: 'Честность важна' }),
        topic({ id: 2, title: 'Честный поступок' }),
        topic({ id: 3, title: 'Честно признаться' }),
        topic({ id: 4, title: 'Смелость и отвага' }),
        topic({ id: 5, title: 'Смелый выбор' }),
        topic({ id: 6, title: 'Смело идти вперёд' }),
      ]

      const forward = computeTopicNudges(base)
      const reversed = computeTopicNudges([...base].reverse())
      const shuffled = computeTopicNudges([base[3]!, base[0]!, base[5]!, base[2]!, base[4]!, base[1]!])

      expect(reversed).toEqual(forward)
      expect(shuffled).toEqual(forward)
    })

    it('orders candidates by count descending then keyword ascending', () => {
      const topics = [
        topic({ id: 1, title: 'Честность важна' }),
        topic({ id: 2, title: 'Честный поступок' }),
        topic({ id: 3, title: 'Честно признаться' }),
        topic({ id: 4, title: 'Честное слово' }),
        topic({ id: 5, title: 'Смелость нужна' }),
        topic({ id: 6, title: 'Смелый шаг' }),
        topic({ id: 7, title: 'Смело вперёд' }),
      ]

      const result = computeTopicNudges(topics)

      expect(result).toHaveLength(2)
      expect(result[0]!.count).toBeGreaterThanOrEqual(result[1]!.count)
      expect(result[0]!.topicIds).toEqual([1, 2, 3, 4])
    })
  })
})
