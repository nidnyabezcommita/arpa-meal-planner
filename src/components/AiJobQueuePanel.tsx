import { useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Sparkles, X } from 'lucide-react';
import { formatAiServiceLine, useAiJobQueue } from '../context/AiJobQueueContext';
import { useTranslation } from 'react-i18next';

export default function AiJobQueuePanel() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { jobs, isMinimized, setMinimized, dismissJob, clearCompleted } = useAiJobQueue();

  if (jobs.length === 0) return null;

  const runningCount = jobs.filter((j) => j.status === 'running').length;
  const hasDone = jobs.some((j) => j.status === 'done');

  const openRestore = (jobId: string) => {
    const job = jobs.find((j) => j.id === jobId);
    if (!job || job.status !== 'done' || !job.restore) return;
    navigate(job.restore.path, { state: job.restore.state });
    dismissJob(job.id);
  };

  if (isMinimized) {
    return (
      <div className="pointer-events-none sticky top-6 z-30 mb-4 flex w-full justify-end">
        <button
          type="button"
          onClick={() => setMinimized(false)}
          className="pointer-events-auto flex items-center gap-2 rounded-full border border-outline-variant/40 bg-surface-container-lowest/95 px-4 py-2.5 text-sm font-display font-semibold text-on-surface shadow-lg backdrop-blur-md dark:border-outline-variant dark:bg-surface-container-low/95 dark:text-on-surface"
          aria-expanded={false}
          aria-label={t('aiJobQueuePanel.labels.jobs', {runningCount, length: jobs.length})}
        >
          <Sparkles className="h-4 w-4 text-primary-container dark:text-primary-fixed-dim" />
          <span>{t('aiJobQueuePanel.jobs')}</span>
          {runningCount > 0 ? (
            <span className="rounded-full bg-primary-container px-2 py-0.5 text-[11px] text-on-primary">{runningCount}</span>
          ) : (
            <span className="text-xs text-outline">{jobs.length}</span>
          )}
          <ChevronDown className="h-4 w-4 text-outline" />
        </button>
      </div>
    );
  }

  return (
    <div className="pointer-events-none sticky top-6 z-30 mb-4 flex w-full justify-end">
      <div
        className="pointer-events-auto w-full max-w-sm overflow-hidden rounded-2xl border border-outline-variant/40 bg-surface-container-lowest/95 shadow-xl backdrop-blur-md dark:border-outline-variant dark:bg-surface-container-low/95"
        role="region"
        aria-label={t('aiJobQueuePanel.labels.queue')}
      >
        <div className="flex items-center justify-between gap-2 border-b border-outline-variant/30 px-4 py-3 dark:border-outline-variant/40">
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles className="h-4 w-4 shrink-0 text-primary-container dark:text-primary-fixed-dim" />
            <span className="truncate font-display text-sm font-bold text-on-surface">
              {t('aiJobQueuePanel.jobs')}
            </span>
            {runningCount > 0 ? (
              <span className="shrink-0 rounded-full bg-primary-container/15 px-2 py-0.5 text-[10px] font-bold text-primary-container dark:bg-primary-fixed-dim/20 dark:text-primary-fixed-dim">
                {runningCount} {t('aiJobQueuePanel.running')}
              </span>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {hasDone ? (
              <button
                type="button"
                onClick={clearCompleted}
                className="rounded-full px-2 py-1 text-[11px] font-semibold text-primary-container hover:bg-primary-container/10 dark:text-primary-fixed-dim dark:hover:bg-primary-fixed-dim/10"
              >
                {t('aiJobQueuePanel.buttons.clear')}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setMinimized(true)}
              className="rounded-full p-1.5 text-outline hover:bg-surface-container-high dark:text-outline dark:hover:bg-surface-container-high"
              aria-label={t('aiJobQueuePanel.labels.minimize')}
            >
              <ChevronUp className="h-4 w-4" />
            </button>
          </div>
        </div>

        <ul className="max-h-[min(50vh,22rem)] divide-y divide-outline-variant/25 overflow-y-auto thin-scrollbar dark:divide-outline-variant/25">
          {jobs.map((job) => {
            const canOpenRestore = job.status === 'done' && Boolean(job.restore);
            const rowClass =
              'flex w-full gap-3 px-4 py-3 pr-12 text-left' +
              (canOpenRestore
                ? ' cursor-pointer transition-colors hover:bg-surface-container-high/40 dark:hover:bg-surface-container-high/60'
                : '');

            const inner = (
              <>
                <div className="relative mt-0.5 h-9 w-9 shrink-0">
                  {job.status === 'running' ? (
                    <>
                      <div className="absolute inset-0 rounded-full border-2 border-outline-variant/35 dark:border-outline-variant/50" />
                      <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary-container border-r-primary-container/30 animate-spin dark:border-t-primary-fixed-dim dark:border-r-primary-fixed-dim/30" />
                    </>
                  ) : job.status === 'done' ? (
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-container/15 text-primary-container dark:bg-primary-fixed-dim/20 dark:text-primary-fixed-dim">
                      <CheckCircle2 className="h-5 w-5" />
                    </div>
                  ) : (
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-error-container/80 text-on-error-container">
                      <AlertCircle className="h-5 w-5" />
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="min-w-0">
                    <p className="font-display text-sm font-bold text-on-surface">{job.title}</p>
                    {job.relatedLabel ? (
                      <p className="mt-0.5 truncate text-xs text-on-surface-variant">
                        {job.relatedLabel}
                      </p>
                    ) : null}
                    <p className="mt-1 truncate text-[11px] text-outline">
                      {formatAiServiceLine(job.providerId, job.modelLabel)}
                    </p>
                    {job.languageLabel ? (
                      <p className="mt-0.5 truncate text-[11px] text-outline">
                        {t('aiJobQueuePanel.language')} · {job.languageLabel}
                      </p>
                    ) : null}
                    {canOpenRestore ? (
                      <p className="mt-1 text-[11px] font-semibold text-primary-container dark:text-primary-fixed-dim">
                        {t('aiJobQueuePanel.click')}
                      </p>
                    ) : null}
                  </div>

                  {job.status === 'running' ? (
                    <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-container-high">
                      <div className="ai-job-indeterminate-fill" />
                    </div>
                  ) : null}

                  {job.status === 'error' && job.error ? (
                    <p className="mt-2 text-xs text-on-error-container dark:text-red-300">{job.error}</p>
                  ) : null}
                </div>
              </>
            );

            return (
              <li key={job.id} className="relative">
                {canOpenRestore ? (
                  <button
                    type="button"
                    className={rowClass}
                    onClick={() => openRestore(job.id)}
                    aria-label={t('aiJobQueuePanel.labels.result', {title: job.title})}
                  >
                    {inner}
                  </button>
                ) : (
                  <div className={rowClass}>{inner}</div>
                )}

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    dismissJob(job.id);
                  }}
                  className="absolute right-3 top-3 rounded-full p-1 text-outline hover:bg-surface-container-high dark:text-outline dark:hover:bg-surface-container-high"
                  aria-label={t('aiJobQueuePanel.labels.dismiss')}
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
