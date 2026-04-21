import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api, type StoryGroup, type UniverseCharacter, type UniverseSuggestion } from '../lib/api'
import FormField from '../components/form-field'
import UniverseCharacters from '../components/universe-characters'
import UniverseSuggestions from '../components/universe-suggestions'
import { compileStyleGuide } from '../lib/compile-style-guide'

interface StyleGuideEditorProps {
  works: string
  doesntWork: string
  techniques: string
  minimize: string
  onWorksChange: (v: string) => void
  onDoesntWorkChange: (v: string) => void
  onTechniquesChange: (v: string) => void
  onMinimizeChange: (v: string) => void
}

function StyleGuideEditor({
  works, doesntWork, techniques, minimize,
  onWorksChange, onDoesntWorkChange, onTechniquesChange, onMinimizeChange,
}: StyleGuideEditorProps) {
  return (
    <div className="space-y-4">
      <FormField label="Что работает" hint="Паттерны, которые работают — конкретно, не абстрактно">
        <textarea
          className="textarea textarea-bordered min-h-24 w-full bg-base-200 font-mono text-xs"
          placeholder="- длинные предложения с ритмом&#10;- диалог между персонажами..."
          value={works}
          onChange={(e) => onWorksChange(e.target.value)}
        />
      </FormField>
      <FormField label="Что не работает" hint="Паттерны, которых следует избегать">
        <textarea
          className="textarea textarea-bordered min-h-20 w-full bg-base-200 font-mono text-xs"
          placeholder="- слишком много действий за раз..."
          value={doesntWork}
          onChange={(e) => onDoesntWorkChange(e.target.value)}
        />
      </FormField>
      <FormField label="Предпочтительные техники" hint="Структура, ритм, соотношение диалога и нарратива">
        <textarea
          className="textarea textarea-bordered min-h-20 w-full bg-base-200 font-mono text-xs"
          placeholder="Свободный текст о структуре историй..."
          value={techniques}
          onChange={(e) => onTechniquesChange(e.target.value)}
        />
      </FormField>
      <FormField label="Минимизировать">
        <textarea
          className="textarea textarea-bordered min-h-16 w-full bg-base-200 font-mono text-xs"
          placeholder="- лишние описания природы..."
          value={minimize}
          onChange={(e) => onMinimizeChange(e.target.value)}
        />
      </FormField>
    </div>
  )
}

export function UniverseDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const universeId = parseInt(id ?? '', 10)

  const [universe, setUniverse] = useState<StoryGroup | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [universeContext, setUniverseContext] = useState('')
  const [styleGuideWorks, setStyleGuideWorks] = useState('')
  const [styleGuideDoesntWork, setStyleGuideDoesntWork] = useState('')
  const [styleGuideTechniques, setStyleGuideTechniques] = useState('')
  const [styleGuideMinimize, setStyleGuideMinimize] = useState('')
  const [characters, setCharacters] = useState<UniverseCharacter[]>([])
  const [suggestions, setSuggestions] = useState<UniverseSuggestion[]>([])

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (isNaN(universeId)) {
      setLoadError('Неверный ID вселенной')
      setLoading(false)
      return
    }

    Promise.all([
      api.universes.get(universeId),
      api.universes.listSuggestions(universeId),
    ])
      .then(([u, sugg]) => {
        setUniverse(u)
        setName(u.name)
        setDescription(u.description)
        setSystemPrompt(u.systemPrompt)
        setUniverseContext(u.universeContext ?? '')
        setStyleGuideWorks(u.styleGuideWorks ?? '')
        setStyleGuideDoesntWork(u.styleGuideDoesntWork ?? '')
        setStyleGuideTechniques(u.styleGuideTechniques ?? '')
        setStyleGuideMinimize(u.styleGuideMinimize ?? '')
        setCharacters(u.characters)
        setSuggestions(sugg)
      })
      .catch((err) => {
        setLoadError(err instanceof Error ? err.message : 'Ошибка загрузки')
      })
      .finally(() => setLoading(false))
  }, [universeId])

  async function handleSave() {
    setSaving(true)
    setSaveError(null)
    setSaved(false)

    const compiled = compileStyleGuide({
      works: styleGuideWorks,
      doesntWork: styleGuideDoesntWork,
      techniques: styleGuideTechniques,
      minimize: styleGuideMinimize,
    })

    try {
      const updated = await api.universes.update(universeId, {
        name: name.trim(),
        description: description.trim(),
        systemPrompt: systemPrompt.trim(),
        universeContext: universeContext.trim(),
        styleGuideWorks: styleGuideWorks.trim() || null,
        styleGuideDoesntWork: styleGuideDoesntWork.trim() || null,
        styleGuideTechniques: styleGuideTechniques.trim() || null,
        styleGuideMinimize: styleGuideMinimize.trim() || null,
        styleGuide: compiled || null,
      })

      setUniverse(updated)
      setSaved(true)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Не удалось сохранить')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Удалить вселенную «${name}»? Это действие нельзя отменить.`)) return

    setDeleting(true)

    try {
      await api.universes.delete(universeId)
      navigate('/universes')
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Не удалось удалить')
      setDeleting(false)
    }
  }

  if (loading) {
    return <p className="text-base-content/60">Загрузка...</p>
  }

  if (loadError) {
    return <p className="text-error">{loadError}</p>
  }

  return (
    <div className="flex flex-col gap-8 pb-12">
      <div className="flex items-center gap-4">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/universes')}>
          ← Назад
        </button>
        <h1 className="font-serif text-2xl text-base-content">{universe?.name}</h1>
      </div>

      <section className="flex flex-col gap-5">
        <h2 className="text-lg font-semibold">Основное</h2>

        <FormField label="Название" required>
          <input
            type="text"
            className="input input-bordered w-full bg-base-200"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </FormField>

        <FormField label="Описание">
          <input
            type="text"
            className="input input-bordered w-full bg-base-200"
            placeholder="Необязательно"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </FormField>

        <FormField label="Системный промпт" required>
          <textarea
            className="textarea textarea-bordered min-h-48 w-full bg-base-200"
            placeholder="Персонажи, голос, тон, повторяющиеся места..."
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
          />
        </FormField>

        <FormField label="Живой контекст" hint="AI поддерживает автоматически, но можно редактировать вручную.">
          <textarea
            className="textarea textarea-bordered min-h-40 w-full bg-base-200 font-mono text-xs"
            placeholder="## Персонажи&#10;- ...&#10;&#10;## События&#10;- ..."
            value={universeContext}
            onChange={(e) => setUniverseContext(e.target.value)}
          />
        </FormField>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Персонажи</h2>
        <UniverseCharacters
          universeId={universeId}
          characters={characters}
          onChange={setCharacters}
        />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Гайд по стилю</h2>
        <p className="text-sm text-base-content/50">Накапливается при анализе примерных историй. Можно редактировать вручную.</p>
        <StyleGuideEditor
          works={styleGuideWorks}
          doesntWork={styleGuideDoesntWork}
          techniques={styleGuideTechniques}
          minimize={styleGuideMinimize}
          onWorksChange={setStyleGuideWorks}
          onDoesntWorkChange={setStyleGuideDoesntWork}
          onTechniquesChange={setStyleGuideTechniques}
          onMinimizeChange={setStyleGuideMinimize}
        />
      </section>

      {suggestions.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">
            Новые факты
            <span className="ml-2 badge badge-warning badge-sm">{suggestions.length}</span>
          </h2>
          <p className="text-sm text-base-content/50">Извлечены из последних историй. Одобри или отклони каждый.</p>
          <UniverseSuggestions
            universeId={universeId}
            suggestions={suggestions}
            characters={characters}
            onSuggestionsChange={setSuggestions}
            onCharactersChange={setCharacters}
          />
        </section>
      )}

      {saveError && <p className="text-sm text-error">{saveError}</p>}

      <div className="flex items-center gap-3">
        {saved && <span className="text-sm text-success">Сохранено</span>}
        <button
          className="btn btn-primary"
          disabled={saving || !name.trim() || !systemPrompt.trim()}
          onClick={() => void handleSave()}
        >
          {saving ? 'Сохраняем...' : 'Сохранить'}
        </button>
        <button
          className={`btn btn-error btn-outline ml-auto ${deleting ? 'loading' : ''}`}
          disabled={deleting}
          onClick={() => void handleDelete()}
        >
          Удалить вселенную
        </button>
      </div>
    </div>
  )
}
