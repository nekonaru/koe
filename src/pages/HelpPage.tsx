import { useI18n } from '../i18n/useI18n'

export function HelpPage() {
  const { t } = useI18n()
  const sections: Array<{ titleKey: string; bodyKey: string }> = [
    { titleKey: 'help.browserTitle', bodyKey: 'help.browserBody' },
    { titleKey: 'help.modelTitle', bodyKey: 'help.modelBody' },
    { titleKey: 'help.memoryTitle', bodyKey: 'help.memoryBody' },
    { titleKey: 'help.formatTitle', bodyKey: 'help.formatBody' },
    { titleKey: 'help.privacyTitle', bodyKey: 'help.privacyBody' },
    { titleKey: 'help.troubleTitle', bodyKey: 'help.troubleBody' },
  ]

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-black tracking-tight text-ai dark:text-warm">{t('help.title')}</h1>
      <div className="mt-6 space-y-6">
        {sections.map((section) => (
          <section key={section.titleKey}>
            <h2 className="text-base font-extrabold text-coral">{t(section.titleKey)}</h2>
            <p className="mt-1 leading-relaxed text-neutral-700 dark:text-neutral-200">{t(section.bodyKey)}</p>
          </section>
        ))}
      </div>
    </main>
  )
}
