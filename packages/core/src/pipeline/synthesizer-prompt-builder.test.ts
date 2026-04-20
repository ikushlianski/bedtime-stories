import { describe, it, expect } from 'vitest'
import { buildSynthesizerPrompt, type SynthesizerInput, SIGNAL_WEIGHTS } from './synthesizer-prompt-builder'

const emptyInput: SynthesizerInput = {
  profile: null,
  parentNotesOnText: [],
  parentNotesOnPlan: [],
  sashaLaughed: [],
  sashaLoved: [],
  sashaDisliked: [],
  structuredFeedback: [],
  sashaReactions: [],
  diaryEntries: [],
  storyAnalyses: [],
  recentTitles: [],
}

describe('synthesizer prompt builder', () => {
  describe('parent notes on story text', () => {
    it('includes the parent note with its quoted passage and story attribution', () => {
      const input: SynthesizerInput = {
        ...emptyInput,
        parentNotesOnText: [
          { selectedText: 'ёжик побежал', noteText: 'слишком быстро для концовки', storyTitle: 'Сказка о ёжике' },
        ],
      }

      const prompt = buildSynthesizerPrompt(input)

      expect(prompt).toContain('«ёжик побежал»')
      expect(prompt).toContain('слишком быстро для концовки')
      expect(prompt).toContain('Сказка о ёжике')
    })

    it('marks the parent note section as critically important', () => {
      const input: SynthesizerInput = {
        ...emptyInput,
        parentNotesOnText: [
          { selectedText: 'медведь зарычал', noteText: null, storyTitle: 'Лесная история' },
        ],
      }

      const prompt = buildSynthesizerPrompt(input)

      expect(prompt).toContain(`[ВЕС ${SIGNAL_WEIGHTS.parentNoteOnStory}]`)
      expect(prompt).toContain('КРИТИЧЕСКИ ВАЖНО')
    })

    it('includes an annotation that has no note text — only the quoted passage and attribution', () => {
      const input: SynthesizerInput = {
        ...emptyInput,
        parentNotesOnText: [
          { selectedText: 'луна светила ярко', noteText: null, storyTitle: 'Ночная прогулка' },
        ],
      }

      const prompt = buildSynthesizerPrompt(input)

      expect(prompt).toContain('«луна светила ярко»')
      expect(prompt).toContain('Ночная прогулка')
      expect(prompt).not.toContain('→ null')
    })

    it('omits the parent-notes-on-text section when there are no such notes', () => {
      const prompt = buildSynthesizerPrompt(emptyInput)

      expect(prompt).not.toContain('ЗАМЕТКИ РОДИТЕЛЯ НА ГОТОВЫХ ИСТОРИЯХ')
    })
  })

  describe('parent notes on plans', () => {
    it('includes plan notes with their own weight label', () => {
      const input: SynthesizerInput = {
        ...emptyInput,
        parentNotesOnPlan: [
          { selectedText: 'герой встречает волшебника', noteText: 'сделать встречу неожиданной', storyTitle: 'Путь героя' },
        ],
      }

      const prompt = buildSynthesizerPrompt(input)

      expect(prompt).toContain(`[ВЕС ${SIGNAL_WEIGHTS.parentNoteOnPlan}]`)
      expect(prompt).toContain('«герой встречает волшебника»')
      expect(prompt).toContain('сделать встречу неожиданной')
    })

    it('omits the plan-notes section when there are no plan annotations', () => {
      const prompt = buildSynthesizerPrompt(emptyInput)

      expect(prompt).not.toContain('ЗАМЕТКИ РОДИТЕЛЯ К ПЛАНАМ')
    })
  })

  describe('moments where Sasha laughed', () => {
    it('includes the laughed moment with passage and story title', () => {
      const input: SynthesizerInput = {
        ...emptyInput,
        sashaLaughed: [
          { selectedText: 'лягушка упала в лужу', noteText: 'хохотал долго', storyTitle: 'Болотные друзья' },
        ],
      }

      const prompt = buildSynthesizerPrompt(input)

      expect(prompt).toContain('«лягушка упала в лужу»')
      expect(prompt).toContain('хохотал долго')
      expect(prompt).toContain('Болотные друзья')
    })

    it('labels the laughed section as very important', () => {
      const input: SynthesizerInput = {
        ...emptyInput,
        sashaLaughed: [
          { selectedText: 'кот промахнулся', noteText: null, storyTitle: 'Кошачьи истории' },
        ],
      }

      const prompt = buildSynthesizerPrompt(input)

      expect(prompt).toContain(`[ВЕС ${SIGNAL_WEIGHTS.sashaLaughed}]`)
      expect(prompt).toContain('ОЧЕНЬ ВАЖНО')
    })

    it('omits the laughed section when Sasha had no laughed annotations', () => {
      const prompt = buildSynthesizerPrompt(emptyInput)

      expect(prompt).not.toContain('СМЕЯЛСЯ')
    })
  })

  describe('things Sasha loved', () => {
    it('includes loved passages in their own section', () => {
      const input: SynthesizerInput = {
        ...emptyInput,
        sashaLoved: [
          { selectedText: 'дракон подружился с мышкой', noteText: 'просил перечитать', storyTitle: 'Дракон и мышка' },
        ],
      }

      const prompt = buildSynthesizerPrompt(input)

      expect(prompt).toContain('«дракон подружился с мышкой»')
      expect(prompt).toContain('просил перечитать')
    })

    it('omits the loved section when there are no loved annotations', () => {
      const prompt = buildSynthesizerPrompt(emptyInput)

      expect(prompt).not.toContain('ПОНРАВИЛОСЬ')
    })
  })

  describe('things Sasha disliked', () => {
    it('includes disliked passages under an avoid label', () => {
      const input: SynthesizerInput = {
        ...emptyInput,
        sashaDisliked: [
          { selectedText: 'злая ведьма кричала', noteText: 'испугался', storyTitle: 'Страшная история' },
        ],
      }

      const prompt = buildSynthesizerPrompt(input)

      expect(prompt).toContain('«злая ведьма кричала»')
      expect(prompt).toContain('испугался')
      expect(prompt).toContain('ИЗБЕГАТЬ')
    })

    it('omits the disliked section when there are no disliked annotations', () => {
      const prompt = buildSynthesizerPrompt(emptyInput)

      expect(prompt).not.toContain('НЕ ПОНРАВИЛОСЬ')
    })
  })

  describe('section ordering by weight', () => {
    it('places parent notes before diary entries because parent notes carry higher weight', () => {
      const input: SynthesizerInput = {
        ...emptyInput,
        parentNotesOnText: [
          { selectedText: 'важный момент', noteText: 'заметка', storyTitle: 'История А' },
        ],
        diaryEntries: ['Саша сегодня играл с кубиками'],
      }

      const prompt = buildSynthesizerPrompt(input)

      const notesPos = prompt.indexOf('ЗАМЕТКИ РОДИТЕЛЯ НА ГОТОВЫХ ИСТОРИЯХ')
      const diaryPos = prompt.indexOf('ДНЕВНИКОВЫЕ ЗАПИСИ')

      expect(notesPos).toBeGreaterThan(-1)
      expect(diaryPos).toBeGreaterThan(-1)
      expect(notesPos).toBeLessThan(diaryPos)
    })

    it('places laughed moments before diary entries', () => {
      const input: SynthesizerInput = {
        ...emptyInput,
        sashaLaughed: [
          { selectedText: 'смешной момент', noteText: null, storyTitle: 'История Б' },
        ],
        diaryEntries: ['Саша ходил в магазин'],
      }

      const prompt = buildSynthesizerPrompt(input)

      const laughPos = prompt.indexOf('СМЕЯЛСЯ')
      const diaryPos = prompt.indexOf('ДНЕВНИКОВЫЕ ЗАПИСИ')

      expect(laughPos).toBeLessThan(diaryPos)
    })
  })

  describe('child profile', () => {
    it('includes the child name and age when profile is provided', () => {
      const input: SynthesizerInput = {
        ...emptyInput,
        profile: { name: 'Гоша', age: 6, activities: null, interests: null, dislikes: null, favourites: null, notes: null },
      }

      const prompt = buildSynthesizerPrompt(input)

      expect(prompt).toContain('Гоша')
      expect(prompt).toContain('6 лет')
    })

    it('includes interests and dislikes from the profile', () => {
      const input: SynthesizerInput = {
        ...emptyInput,
        profile: { name: 'Гоша', age: null, activities: 'плавание', interests: 'динозавры', dislikes: 'лук', favourites: null, notes: null },
      }

      const prompt = buildSynthesizerPrompt(input)

      expect(prompt).toContain('плавание')
      expect(prompt).toContain('динозавры')
      expect(prompt).toContain('лук')
    })

    it('omits the profile section when no profile exists', () => {
      const prompt = buildSynthesizerPrompt(emptyInput)

      expect(prompt).not.toContain('ПРОФИЛЬ РЕБЁНКА')
    })
  })

  describe('recent story titles', () => {
    it('includes recent titles to help the synthesizer avoid repeating themes', () => {
      const input: SynthesizerInput = {
        ...emptyInput,
        recentTitles: ['Сказка о зайке', 'Дракон и рыцарь'],
      }

      const prompt = buildSynthesizerPrompt(input)

      expect(prompt).toContain('Сказка о зайке')
      expect(prompt).toContain('Дракон и рыцарь')
    })

    it('omits the titles section when there are no recent stories', () => {
      const prompt = buildSynthesizerPrompt(emptyInput)

      expect(prompt).not.toContain('ПОСЛЕДНИЕ ИСТОРИИ')
    })
  })
})
