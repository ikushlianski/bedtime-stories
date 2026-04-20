import { useState, useEffect, useCallback } from 'react'
import { FormField, PageHeader, StatusCallout } from '../components'
import { api, type ChildProfile } from '../lib/api'

export function ChildProfilePage() {
  const [profile, setProfile] = useState<ChildProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [age, setAge] = useState('')
  const [activities, setActivities] = useState('')
  const [interests, setInterests] = useState('')
  const [dislikes, setDislikes] = useState('')
  const [favourites, setFavourites] = useState('')
  const [notes, setNotes] = useState('')

  const fetchProfile = useCallback(() => {
    setLoading(true)

    api.childProfile
      .get()
      .then((p) => {
        setProfile(p)

        if (p) {
          setName(p.name ?? '')
          setAge(p.age != null ? String(p.age) : '')
          setActivities(p.activities ?? '')
          setInterests(p.interests ?? '')
          setDislikes(p.dislikes ?? '')
          setFavourites(p.favourites ?? '')
          setNotes(p.notes ?? '')
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Не удалось загрузить профиль'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchProfile()
  }, [fetchProfile])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSaved(false)

    try {
      const updated = await api.childProfile.update({
        name: name.trim(),
        age: age.trim() ? parseInt(age, 10) : null,
        activities: activities.trim() || null,
        interests: interests.trim() || null,
        dislikes: dislikes.trim() || null,
        favourites: favourites.trim() || null,
        notes: notes.trim() || null,
      })

      setProfile(updated)
      setSaved(true)

      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить профиль')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div>
        <PageHeader eyebrow="Ребёнок" title="Профиль ребёнка" description="" />
        <StatusCallout title="Загрузка" message="Получаем профиль..." />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        eyebrow="Ребёнок"
        title="Профиль ребёнка"
        description="Расскажи об ребёнке, чтобы истории были максимально персонализированы."
      />

      {error && (
        <div className="mb-4">
          <StatusCallout tone="error" title="Ошибка" message={error} />
        </div>
      )}

      <section className="rounded-box border border-base-300 bg-base-100 p-6 shadow-sm">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <FormField label="Имя" required>
            <input
              type="text"
              className="input input-bordered w-full bg-base-200"
              placeholder="Саша"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={saving}
            />
          </FormField>

          <FormField label="Возраст (лет)">
            <input
              type="number"
              className="input input-bordered w-full bg-base-200"
              placeholder="5"
              min={0}
              max={18}
              value={age}
              onChange={(e) => setAge(e.target.value)}
              disabled={saving}
            />
          </FormField>
        </div>

        <div className="mt-5 space-y-5">
          <FormField label="Кружки и занятия" hint="Чем занимается ребёнок — спорт, творчество, музыка и т.д.">
            <textarea
              className="textarea textarea-bordered min-h-20 w-full bg-base-200"
              placeholder="Плавание, рисование, робототехника..."
              value={activities}
              onChange={(e) => setActivities(e.target.value)}
              disabled={saving}
            />
          </FormField>

          <FormField label="Чем увлекается" hint="Интересы, хобби, любимые темы для разговоров.">
            <textarea
              className="textarea textarea-bordered min-h-20 w-full bg-base-200"
              placeholder="Динозавры, космос, машинки, строительство..."
              value={interests}
              onChange={(e) => setInterests(e.target.value)}
              disabled={saving}
            />
          </FormField>

          <FormField label="Что не любит" hint="Темы, образы или ситуации, которых лучше избегать.">
            <textarea
              className="textarea textarea-bordered min-h-20 w-full bg-base-200"
              placeholder="Страшных персонажей, слишком длинные истории, грустные концовки..."
              value={dislikes}
              onChange={(e) => setDislikes(e.target.value)}
              disabled={saving}
            />
          </FormField>

          <FormField label="Любимые персонажи и истории" hint="Из каких книг, мультфильмов, игр — что особенно нравится.">
            <textarea
              className="textarea textarea-bordered min-h-20 w-full bg-base-200"
              placeholder="Фиксики, Лего Сити, истории про животных..."
              value={favourites}
              onChange={(e) => setFavourites(e.target.value)}
              disabled={saving}
            />
          </FormField>

          <FormField label="Дополнительно" hint="Всё остальное, что может помочь сделать истории лучше.">
            <textarea
              className="textarea textarea-bordered min-h-20 w-full bg-base-200"
              placeholder="Боится темноты, лучший друг — Миша, любит когда в историях есть юмор..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={saving}
            />
          </FormField>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          {saved && <span className="text-sm text-success">Сохранено</span>}
          <button
            className={`btn btn-primary ${saving ? 'loading' : ''}`}
            onClick={() => void handleSave()}
            disabled={saving}
          >
            {saving ? 'Сохраняю...' : profile ? 'Сохранить изменения' : 'Создать профиль'}
          </button>
        </div>
      </section>
    </div>
  )
}
