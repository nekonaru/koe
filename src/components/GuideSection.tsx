import { useI18n } from '../i18n/useI18n'

interface FaqItem {
  questionKey: string
  answerKey: string
}

const FAQ_ITEMS: FaqItem[] = [
  { questionKey: 'guide.faq.firstLoad.q', answerKey: 'guide.faq.firstLoad.a' },
  { questionKey: 'guide.faq.error.q', answerKey: 'guide.faq.error.a' },
  { questionKey: 'guide.faq.offline.q', answerKey: 'guide.faq.offline.a' },
  { questionKey: 'guide.faq.whichModel.q', answerKey: 'guide.faq.whichModel.a' },
  { questionKey: 'guide.faq.privacy.q', answerKey: 'guide.faq.privacy.a' },
  { questionKey: 'guide.faq.longFile.q', answerKey: 'guide.faq.longFile.a' },
]

const STEPS: Array<{ titleKey: string; bodyKey: string }> = [
  { titleKey: 'guide.step1.title', bodyKey: 'guide.step1.body' },
  { titleKey: 'guide.step2.title', bodyKey: 'guide.step2.body' },
  { titleKey: 'guide.step3.title', bodyKey: 'guide.step3.body' },
  { titleKey: 'guide.step4.title', bodyKey: 'guide.step4.body' },
]

export function GuideSection() {
  const { t } = useI18n()

  return (
    <section aria-labelledby="guide-title" className="mt-8">
      <h2 id="guide-title" className="text-xs font-black uppercase tracking-widest text-ai/70 dark:text-warm/70">
        {t('guide.title')}
      </h2>

      <ol className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((step) => (
          <li
            key={step.titleKey}
            className="rounded-2xl border border-ai/15 bg-white/60 p-4 dark:border-warm/10 dark:bg-ai/20"
          >
            <p className="text-sm font-extrabold text-coral">{t(step.titleKey)}</p>
            <p className="mt-1 text-xs leading-relaxed text-neutral-600 dark:text-neutral-300">
              {t(step.bodyKey)}
            </p>
          </li>
        ))}
      </ol>

      <div className="mt-4">
        <h3 className="text-sm font-extrabold text-ai dark:text-warm">{t('guide.faqTitle')}</h3>
        <div className="mt-2 divide-y divide-ai/10 overflow-hidden rounded-2xl border border-ai/15 dark:divide-warm/10 dark:border-warm/10">
          {FAQ_ITEMS.map((item) => (
            <details key={item.questionKey} className="group bg-white/60 dark:bg-ai/20">
              <summary className="cursor-pointer px-4 py-3 text-sm font-bold text-neutral-800 outline-none transition hover:bg-ai/5 focus-visible:ring-2 focus-visible:ring-coral/50 dark:text-warm dark:hover:bg-warm/5">
                {t(item.questionKey)}
              </summary>
              <div className="px-4 pb-3 text-xs leading-relaxed text-neutral-600 dark:text-neutral-300">
                {t(item.answerKey)}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
