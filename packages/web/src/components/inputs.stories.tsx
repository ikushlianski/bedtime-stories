import type { Meta, StoryObj } from '@storybook/react'
import type { ReactNode } from 'react'
import FormField from './form-field'

const meta: Meta = {
  title: 'Design System/Inputs',
  parameters: { layout: 'fullscreen' },
}

export default meta
type Story = StoryObj

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-base-content/40">{title}</h2>
      <div className="rounded-box border border-base-300 bg-base-100 p-6 shadow-sm">
        {children}
      </div>
    </section>
  )
}

function InputsPage() {
  return (
    <div className="space-y-10">

      <Block title="Один под другим">
        <div className="max-w-md space-y-5">
          <FormField label="Имя ребёнка" hint="Как зовут того, для кого история" required>
            <input className="input input-bordered w-full bg-base-200" placeholder="Саша" />
          </FormField>

          <FormField label="Возраст" hint="Полных лет">
            <input type="number" className="input input-bordered w-full bg-base-200" placeholder="5" min={1} max={18} />
          </FormField>

          <FormField label="Любимый персонаж">
            <input className="input input-bordered w-full bg-base-200" placeholder="Дракон, кот, рыцарь…" />
          </FormField>

          <FormField label="Интересы" hint="Хобби, любимые темы, увлечения">
            <textarea
              className="textarea textarea-bordered w-full bg-base-200"
              rows={3}
              placeholder="Динозавры, космос, машинки…"
            />
          </FormField>

          <FormField label="Язык истории">
            <select className="select select-bordered w-full bg-base-200">
              <option>Русский</option>
              <option>English</option>
            </select>
          </FormField>
        </div>
      </Block>

      <Block title="Рядом друг с другом">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <FormField label="Имя ребёнка" required>
            <input className="input input-bordered w-full bg-base-200" placeholder="Саша" />
          </FormField>

          <FormField label="Возраст">
            <input type="number" className="input input-bordered w-full bg-base-200" placeholder="5" min={1} max={18} />
          </FormField>

          <FormField label="Любимый персонаж">
            <input className="input input-bordered w-full bg-base-200" placeholder="Дракон" />
          </FormField>

          <FormField label="Язык истории">
            <select className="select select-bordered w-full bg-base-200">
              <option>Русский</option>
              <option>English</option>
            </select>
          </FormField>
        </div>
      </Block>

      <Block title="Смешанный макет">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <FormField label="Имя ребёнка" required>
            <input className="input input-bordered w-full bg-base-200" placeholder="Саша" />
          </FormField>

          <FormField label="Возраст">
            <input type="number" className="input input-bordered w-full bg-base-200" placeholder="5" min={1} max={18} />
          </FormField>

          <div className="col-span-full">
            <FormField label="Тема истории" hint="Центральная идея или событие, вокруг которого строится история" required>
              <input className="input input-bordered w-full bg-base-200" placeholder="Саша боится темноты и учится с ней дружить" />
            </FormField>
          </div>

          <div className="col-span-full">
            <FormField label="Интересы ребёнка" hint="Хобби, любимые игрушки, персонажи — всё, что можно вплести в сюжет">
              <textarea
                className="textarea textarea-bordered w-full bg-base-200"
                rows={3}
                placeholder="Динозавры, космос, машинки…"
              />
            </FormField>
          </div>
        </div>
      </Block>

      <Block title="Состояния">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <FormField label="Обычный">
            <input className="input input-bordered w-full bg-base-200" placeholder="Placeholder" />
          </FormField>

          <FormField label="С ошибкой" error="Обязательное поле">
            <input className="input input-bordered input-error w-full bg-base-200" placeholder="Placeholder" />
          </FormField>

          <FormField label="Отключён">
            <input className="input input-bordered w-full bg-base-200" placeholder="Placeholder" disabled />
          </FormField>

          <FormField label="Textarea">
            <textarea className="textarea textarea-bordered w-full bg-base-200" rows={2} placeholder="Placeholder" />
          </FormField>

          <FormField label="Textarea с ошибкой" error="Текст не может быть пустым">
            <textarea className="textarea textarea-bordered textarea-error w-full bg-base-200" rows={2} placeholder="Placeholder" />
          </FormField>

          <FormField label="Textarea отключён">
            <textarea className="textarea textarea-bordered w-full bg-base-200" rows={2} placeholder="Placeholder" disabled />
          </FormField>

          <FormField label="Список">
            <select className="select select-bordered w-full bg-base-200">
              <option>Вариант A</option>
              <option>Вариант B</option>
            </select>
          </FormField>

          <FormField label="Список с ошибкой" error="Выбери вариант">
            <select className="select select-bordered select-error w-full bg-base-200">
              <option value="">— не выбрано —</option>
              <option>Вариант A</option>
            </select>
          </FormField>

          <FormField label="Список отключён">
            <select className="select select-bordered w-full bg-base-200" disabled>
              <option>Вариант A</option>
            </select>
          </FormField>
        </div>
      </Block>

    </div>
  )
}

export const Showcase: Story = {
  render: () => <InputsPage />,
}
