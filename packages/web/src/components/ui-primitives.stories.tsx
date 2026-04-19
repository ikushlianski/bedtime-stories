import type { Meta, StoryObj } from '@storybook/react'
import type { ReactNode } from 'react'

const meta: Meta = {
  title: 'Design System/Primitives',
  parameters: {
    layout: 'fullscreen',
  },
}

export default meta

type Story = StoryObj

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-bold text-base-content">{title}</h2>
      {children}
    </section>
  )
}

function Swatch({ name, className }: { name: string; className: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-base-content/10 bg-base-100 shadow-sm">
      <div className={`h-16 ${className}`} />
      <div className="px-3 py-2 text-sm font-semibold">{name}</div>
    </div>
  )
}

function PrimitiveGallery() {
  return (
    <div className="space-y-10">
      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-3">
          <button className="btn btn-primary">Primary action</button>
          <button className="btn btn-secondary">Secondary action</button>
          <button className="btn btn-outline">Tertiary action</button>
          <button className="btn btn-ghost">Quiet action</button>
          <button className="btn btn-error btn-outline">Destructive</button>
          <button className="btn btn-primary loading">Saving</button>
          <button className="btn btn-primary btn-disabled">Disabled</button>
        </div>
      </Section>

      <Section title="Button group">
        <div className="join">
          <button className="btn join-item btn-primary">Готово</button>
          <button className="btn join-item btn-outline">Черновик</button>
          <button className="btn join-item btn-outline">Архив</button>
        </div>
      </Section>

      <Section title="Icon buttons">
        <div className="flex flex-wrap items-center gap-3">
          <button className="btn btn-primary btn-square" aria-label="Добавить">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" />
            </svg>
          </button>
          <button className="btn btn-outline btn-square" aria-label="Фильтры">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L13 10.414V17a1 1 0 01-.553.894l-4-2A1 1 0 018 15v-4.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" />
            </svg>
          </button>
          <button className="btn btn-ghost btn-square text-error" aria-label="Удалить">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8 2a1 1 0 00-.894.553L6.382 4H3a1 1 0 000 2h.293l.853 10.236A2 2 0 006.14 18h7.72a2 2 0 001.994-1.764L16.707 6H17a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0012 2H8zm1 6a1 1 0 012 0v6a1 1 0 11-2 0V8zm-3 1a1 1 0 112 0v5a1 1 0 11-2 0V9zm7-1a1 1 0 00-1 1v5a1 1 0 102 0V9a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </Section>

      <Section title="Inputs">
        <div className="grid gap-3 sm:grid-cols-3">
          <input className="input input-bordered" placeholder="Название истории" />
          <select className="select select-bordered" defaultValue="ready">
            <option value="ready">Готово к чтению</option>
            <option value="draft">Черновик</option>
            <option value="archived">Архив</option>
          </select>
          <label className="flex min-h-10 items-center gap-3 rounded-lg border border-base-content/15 bg-base-100 px-3 text-sm font-semibold">
            <input type="checkbox" className="checkbox checkbox-sm" defaultChecked />
            В списке чтения
          </label>
        </div>
      </Section>

      <Section title="Badges">
        <div className="flex flex-wrap gap-2">
          <span className="badge badge-primary">Готово</span>
          <span className="badge badge-success">Прочитано</span>
          <span className="badge badge-warning">Архив</span>
          <span className="badge badge-outline">Семейное</span>
        </div>
      </Section>

      <Section title="Color tokens">
        <div className="grid gap-3 sm:grid-cols-4">
          <Swatch name="Primary" className="bg-primary" />
          <Swatch name="Secondary" className="bg-secondary" />
          <Swatch name="Base 100" className="bg-base-100" />
          <Swatch name="Base 300" className="bg-base-300" />
        </div>
      </Section>
    </div>
  )
}

export const Catalogue: Story = {
  render: () => <PrimitiveGallery />,
}
