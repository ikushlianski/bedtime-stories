import FormField from './form-field'

export interface CharacterBibleValues {
  age: string
  setting: string
  traits: string
  relationships: string
  coOccurrenceNote: string
}

interface CharacterBibleFieldsProps {
  values: CharacterBibleValues
  onChange: (patch: Partial<CharacterBibleValues>) => void
}

function CharacterBibleFields({ values, onChange }: CharacterBibleFieldsProps) {
  return (
    <>
      <FormField label="Возраст" hint="Свободный текст: «5 лет», «грудничок», «младшая группа»">
        <input
          type="text"
          className="input input-bordered input-sm w-full bg-base-100"
          placeholder="5 лет..."
          value={values.age}
          onChange={(e) => onChange({ age: e.target.value })}
        />
      </FormField>
      <FormField label="Где / группа" hint="Садик, дом, класс — где персонаж живёт и бывает">
        <input
          type="text"
          className="input input-bordered input-sm w-full bg-base-100"
          placeholder="Старшая группа садика..."
          value={values.setting}
          onChange={(e) => onChange({ setting: e.target.value })}
        />
      </FormField>
      <FormField label="Черты">
        <textarea
          className="textarea textarea-bordered min-h-16 w-full bg-base-100 text-sm"
          placeholder="Любопытный, упрямый, добрый..."
          value={values.traits}
          onChange={(e) => onChange({ traits: e.target.value })}
        />
      </FormField>
      <FormField label="Связи">
        <textarea
          className="textarea textarea-bordered min-h-16 w-full bg-base-100 text-sm"
          placeholder="Младший брат Гоши, воспитательница..."
          value={values.relationships}
          onChange={(e) => onChange({ relationships: e.target.value })}
        />
      </FormField>
      <FormField label="С кем в сцене" hint="Кто может и кто не может быть в одной сцене">
        <textarea
          className="textarea textarea-bordered min-h-16 w-full bg-base-100 text-sm"
          placeholder="Никогда в одной сцене со школьниками..."
          value={values.coOccurrenceNote}
          onChange={(e) => onChange({ coOccurrenceNote: e.target.value })}
        />
      </FormField>
    </>
  )
}

export default CharacterBibleFields
