import { DashboardPanel, PageHeader, PendingStoryIdeasPanel } from '../components'

function ComingSoon({ label }: { label: string }) {
  return (
    <div className="flex h-40 items-center justify-center rounded-box border border-dashed border-base-300 bg-base-200 text-sm text-base-content/45">
      <span>{label}</span>
    </div>
  )
}

export function DashboardPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Аналитика"
        title="Панель"
        description="Отслеживай качество, отзывы, влияние агентов, реакции Саши и стоимость по мере развития системы сказок."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="lg:col-span-2">
          <DashboardPanel
            title="Ожидающие идеи историй"
            description="Идеи, предложенные ИИ по всем вселенным. Прими, чтобы сразу создать историю, или отклони."
          >
            <PendingStoryIdeasPanel />
          </DashboardPanel>
        </div>

        <DashboardPanel
          title="Динамика качества"
          description="Оценки по времени с отметками об изменениях промптов и моделей. Показывает, улучшается ли качество после обновлений агентов."
        >
          <ComingSoon label="Скоро — график качества" />
        </DashboardPanel>

        <DashboardPanel
          title="Эффективность агентов"
          description="Для каждого критика и психолога: % историй, где их замечания изменили результат, средний размер правок и твои отзывы об их работе."
        >
          <ComingSoon label="Скоро — таблица эффективности" />
        </DashboardPanel>

        <DashboardPanel
          title="Паттерны отзывов"
          description="Повторяющиеся темы из твоих комментариев, сгруппированные Улучшателем. Показывает, исчезают ли темы после правок промптов."
        >
          <ComingSoon label="Скоро — кластеры отзывов" />
        </DashboardPanel>

        <DashboardPanel
          title="Реакции Саши"
          description="Заметки по типам, самые отмеченные отрывки и ответы Саши на вопросы для обсуждения со временем."
        >
          <ComingSoon label="Скоро — анализ реакций" />
        </DashboardPanel>

        <div className="lg:col-span-2">
          <DashboardPanel
            title="Стоимость"
            description="Использование токенов и реальная стоимость для каждой истории в разбивке по агентам. Помогает понять, где тратятся деньги без видимого влияния на качество."
          >
            <ComingSoon label="Скоро — разбивка по стоимости" />
          </DashboardPanel>
        </div>
      </div>
    </div>
  )
}
