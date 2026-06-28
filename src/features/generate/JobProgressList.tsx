import { XIcon } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

import type { GenerationJob } from './hooks';

export type JobProgressListProps = {
  jobs: GenerationJob[];
  cancelingRequestId?: string | null;
  onCancel: (requestId: string) => void;
};

export function JobProgressList({
  jobs,
  cancelingRequestId = null,
  onCancel,
}: JobProgressListProps) {
  if (jobs.length === 0) {
    return null;
  }

  return (
    <section aria-label="Generation jobs" className="flex flex-col gap-3">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          In progress
        </h2>
        <Badge variant="outline">{jobs.length} active</Badge>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {jobs.map((job) => {
          const previews = previewImages(job);
          const isCanceling = job.status === 'canceling' || cancelingRequestId === job.requestId;

          return (
            <article
              key={job.requestId}
              className="flex flex-col gap-3 rounded-2xl border bg-card p-3 text-card-foreground shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={job.stale ? 'outline' : 'secondary'}>{statusLabel(job)}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {job.count === 1 ? '1 image' : `${job.count} variants`}
                    </span>
                  </div>
                  <p className="truncate text-sm font-medium" title={job.prompt}>
                    {job.prompt}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {job.provider === 'codex' ? 'Codex / OpenAI' : 'Grok'} · {job.model} · {job.size}
                  </p>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isCanceling}
                  onClick={() => onCancel(job.requestId)}
                >
                  <XIcon data-icon="inline-start" />
                  {isCanceling ? 'Canceling…' : 'Cancel'}
                </Button>
              </div>

              <Progress value={job.progress} aria-label={`${job.prompt} progress`} />

              {previews.length > 0 ? (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {previews.map((preview, index) =>
                    preview.image ? (
                      <img
                        key={preview.filename ?? preview.index ?? index}
                        src={preview.image}
                        alt="Generation preview"
                        className="aspect-square size-16 rounded-lg border object-cover"
                      />
                    ) : null,
                  )}
                </div>
              ) : null}

              {job.error ? (
                <p role="alert" className="text-xs text-destructive">
                  {job.error}
                </p>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function previewImages(job: GenerationJob) {
  const images = job.finalImages.length > 0 ? job.finalImages : job.partialImages;
  return images.slice(0, 4);
}

function statusLabel(job: GenerationJob) {
  if (job.stale) {
    return 'Reconnecting';
  }

  if (job.phase && job.phase !== job.status) {
    return job.phase;
  }

  return job.status;
}
