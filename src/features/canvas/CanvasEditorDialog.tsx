import { useEffect, useState } from 'react';

import { useProviderStatuses, type ProviderStatusClient } from '@/features/auth/hooks';
import type { HistoryItem } from '@/lib/ima2/schemas';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import { CANVAS_INPAINT_PROVIDER } from './constants';
import { CanvasEditor, type CanvasEditorSubmitValues } from './CanvasEditor';
import {
  createInpaintRequestId,
  useInpaint,
  type InpaintClient,
  type InpaintStore,
} from './useInpaint';

export type CanvasEditorDialogProps = {
  asset: HistoryItem;
  sourceUrl: string | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inpaintClient?: InpaintClient;
  providerStatusClient?: ProviderStatusClient;
  store?: InpaintStore;
};

export function CanvasEditorDialog({
  asset,
  sourceUrl,
  open,
  onOpenChange,
  inpaintClient,
  providerStatusClient,
  store,
}: CanvasEditorDialogProps) {
  const { providers } = useProviderStatuses({ client: providerStatusClient });
  const inpaint = useInpaint({ client: inpaintClient, store });
  const [successFilename, setSuccessFilename] = useState<string | null>(null);

  const { reset } = inpaint;

  useEffect(() => {
    if (!open) {
      setSuccessFilename(null);
      reset();
    }
  }, [open, reset]);

  const handleSubmit = async (values: CanvasEditorSubmitValues) => {
    const requestId = createInpaintRequestId();
    const result = await inpaint.mutateAsync({
      source: asset,
      prompt: values.prompt,
      sourcePng: values.sourcePng,
      maskPng: values.maskPng,
      model: values.model,
      quality: values.quality,
      size: values.size,
      moderation: values.moderation,
      requestId,
    });
    setSuccessFilename(result.response.filename);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[calc(100vh-2rem)] max-h-[calc(100vh-2rem)] max-w-[calc(100vw-2rem)] flex-col overflow-hidden p-4 sm:max-w-[calc(100vw-2rem)]">
        <DialogHeader className="shrink-0 pr-10">
          <DialogTitle>Canvas inpaint</DialogTitle>
          <DialogDescription>
            Paint a mask over {asset.filename}, then submit a blocking /api/edit request with provider {CANVAS_INPAINT_PROVIDER}.
          </DialogDescription>
        </DialogHeader>
        <CanvasEditor
          asset={asset}
          sourceUrl={sourceUrl}
          codexConnected={providers.codex.connected}
          codexStatusText={providers.codex.statusText}
          onSubmit={handleSubmit}
          onCancel={inpaint.cancelInFlight}
          isSubmitting={inpaint.isPending}
          submitError={inpaint.isError ? errorToMessage(inpaint.error) : null}
          submitSuccess={successFilename ? `Saved ${successFilename} as a child of ${asset.filename}.` : null}
        />
      </DialogContent>
    </Dialog>
  );
}

function errorToMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return 'Inpaint failed.';
}
