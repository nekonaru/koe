import { useI18n } from '../i18n/useI18n'

export function AboutPage() {
  const { t } = useI18n()
  const sections: Array<{ titleKey: string; bodyKey: string }> = [
    { titleKey: 'about.privacyTitle', bodyKey: 'about.privacyBody' },
    { titleKey: 'about.offlineTitle', bodyKey: 'about.offlineBody' },
    { titleKey: 'about.unlimitedTitle', bodyKey: 'about.unlimitedBody' },
    { titleKey: 'about.nameTitle', bodyKey: 'about.nameBody' },
    { titleKey: 'about.licensesTitle', bodyKey: 'about.licensesBody' },
  ]

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-black tracking-tight text-ai dark:text-warm">{t('about.title')}</h1>
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
