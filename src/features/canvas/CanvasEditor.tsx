import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { EraserIcon, PaintbrushIcon, RotateCcwIcon, SparklesIcon, XIcon } from 'lucide-react';

import type { HistoryItem } from '@/lib/ima2/schemas';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

import { CANVAS_INPAINT_CONTRACT } from './constants';
import {
  clientPointToCanvasPoint,
  exportInpaintPngs,
  hasNonTransparentPixel,
  readCanvasImageData,
  type CanvasPoint,
  type InpaintPngExport,
} from './export';

const DEFAULT_BRUSH_SIZE = 72;
const MIN_BRUSH_SIZE = 12;
const MAX_BRUSH_SIZE = 240;

const MODEL_OPTIONS = [
  { value: 'gpt-5.4-mini', label: 'GPT-5.4 mini' },
  { value: 'gpt-5.4', label: 'GPT-5.4' },
  { value: 'gpt-5.5', label: 'GPT-5.5' },
];

const SIZE_OPTIONS = [
  { value: '1024x1024', label: 'Square 1:1' },
  { value: '1824x1024', label: 'Wide 16:9' },
  { value: '1024x1824', label: 'Tall 9:16' },
  { value: '1536x1024', label: 'Frame 3:2' },
  { value: '1024x1536', label: 'Portrait 2:3' },
];

const QUALITY_OPTIONS = [
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

const MODERATION_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'auto', label: 'Auto' },
];

type Tool = 'brush' | 'eraser';
type LoadState = 'idle' | 'loading' | 'ready' | 'error';

export type CanvasEditorSubmitValues = InpaintPngExport & {
  prompt: string;
  model: string;
  quality: string;
  size: string;
  moderation: string;
};

export type CanvasEditorProps = {
  asset: HistoryItem;
  sourceUrl: string | undefined;
  codexConnected: boolean;
  codexStatusText?: string;
  onSubmit: (values: CanvasEditorSubmitValues) => Promise<void> | void;
  onCancel?: () => void;
  isSubmitting?: boolean;
  submitError?: string | null;
  submitSuccess?: string | null;
};

export function CanvasEditor({
  asset,
  sourceUrl,
  codexConnected,
  codexStatusText,
  onSubmit,
  onCancel,
  isSubmitting = false,
  submitError = null,
  submitSuccess = null,
}: CanvasEditorProps) {
  const sourceCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const lastPointRef = useRef<CanvasPoint | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [canvasSize, setCanvasSize] = useState<{ width: number; height: number } | null>(null);
  const [prompt, setPrompt] = useState('');
  const [tool, setTool] = useState<Tool>('brush');
  const [brushSize, setBrushSize] = useState(DEFAULT_BRUSH_SIZE);
  const [model, setModel] = useState(MODEL_OPTIONS[0].value);
  const [size, setSize] = useState(SIZE_OPTIONS[0].value);
  const [quality, setQuality] = useState(QUALITY_OPTIONS[0].value);
  const [moderation, setModeration] = useState(MODERATION_OPTIONS[0].value);
  const [maskHasPaint, setMaskHasPaint] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    const sourceCanvas = sourceCanvasRef.current;
    const maskCanvas = maskCanvasRef.current;

    if (!sourceUrl || !sourceCanvas || !maskCanvas) {
      setLoadState(sourceUrl ? 'loading' : 'idle');
      setCanvasSize(null);
      return undefined;
    }

    let canceled = false;
    const image = new Image();
    image.crossOrigin = 'anonymous';
    setLoadState('loading');
    setLoadError(null);
    setCanvasSize(null);
    setMaskHasPaint(false);
    setExportError(null);

    image.onload = () => {
      if (canceled) {
        return;
      }

      const width = image.naturalWidth || image.width;
      const height = image.naturalHeight || image.height;

      if (width <= 0 || height <= 0) {
        setLoadState('error');
        setLoadError('The source image did not report usable dimensions.');
        return;
      }

      sourceCanvas.width = width;
      sourceCanvas.height = height;
      maskCanvas.width = width;
      maskCanvas.height = height;

      const sourceContext = sourceCanvas.getContext('2d', { willReadFrequently: true });
      const maskContext = maskCanvas.getContext('2d', { willReadFrequently: true });

      if (!sourceContext || !maskContext) {
        setLoadState('error');
        setLoadError('2D canvas support is unavailable in this environment.');
        return;
      }

      sourceContext.clearRect(0, 0, width, height);
      sourceContext.drawImage(image, 0, 0, width, height);
      maskContext.clearRect(0, 0, width, height);
      setCanvasSize({ width, height });
      setLoadState('ready');
    };

    image.onerror = () => {
      if (!canceled) {
        setLoadState('error');
        setLoadError('The source image could not be loaded into the canvas.');
      }
    };

    image.src = sourceUrl;

    return () => {
      canceled = true;
      image.onload = null;
      image.onerror = null;
    };
  }, [sourceUrl]);

  const providerMessage = useMemo(() => {
    if (codexConnected) {
      return 'Codex/OpenAI OAuth connected. Masked edits will use provider oauth.';
    }

    if (codexStatusText) {
      return `${CANVAS_INPAINT_CONTRACT.mask} Grok masked editing is not supported. Codex/OpenAI status: ${codexStatusText}.`;
    }

    return `${CANVAS_INPAINT_CONTRACT.mask} Grok masked editing is not supported. Connect Codex/OpenAI OAuth in Settings.`;
  }, [codexConnected, codexStatusText]);

  const submitDisabled =
    !codexConnected ||
    !maskHasPaint ||
    !canvasSize ||
    loadState !== 'ready' ||
    prompt.trim().length === 0 ||
    isSubmitting;

  const handleClearMask = useCallback(() => {
    const maskCanvas = maskCanvasRef.current;
    const context = maskCanvas?.getContext('2d', { willReadFrequently: true });

    if (!maskCanvas || !context) {
      return;
    }

    context.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
    setMaskHasPaint(false);
    setExportError(null);
  }, []);

  const refreshMaskHasPaint = useCallback(() => {
    const maskCanvas = maskCanvasRef.current;

    if (!maskCanvas) {
      setMaskHasPaint(false);
      return;
    }

    try {
      setMaskHasPaint(hasNonTransparentPixel(readCanvasImageData(maskCanvas)));
    } catch {
      setMaskHasPaint(false);
    }
  }, []);

  const drawStroke = useCallback(
    (from: CanvasPoint, to: CanvasPoint) => {
      const maskCanvas = maskCanvasRef.current;
      const context = maskCanvas?.getContext('2d', { willReadFrequently: true });

      if (!maskCanvas || !context) {
        return;
      }

      context.save();
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.lineWidth = brushSize;

      if (tool === 'eraser') {
        context.globalCompositeOperation = 'destination-out';
      } else {
        context.globalCompositeOperation = 'source-over';
        context.strokeStyle = 'rgba(255,255,255,1)';
        context.fillStyle = 'rgba(255,255,255,1)';
      }

      if (from.x === to.x && from.y === to.y) {
        context.beginPath();
        context.arc(to.x, to.y, brushSize / 2, 0, Math.PI * 2);
        context.fill();
      } else {
        context.beginPath();
        context.moveTo(from.x, from.y);
        context.lineTo(to.x, to.y);
        context.stroke();
      }

      context.restore();

      if (tool === 'brush') {
        setMaskHasPaint(true);
      }
    },
    [brushSize, tool],
  );

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (loadState !== 'ready') {
        return;
      }

      event.preventDefault();
      activePointerIdRef.current = event.pointerId;
      event.currentTarget.setPointerCapture(event.pointerId);
      const point = pointerEventToCanvasPoint(event);
      lastPointRef.current = point;
      drawStroke(point, point);
    },
    [drawStroke, loadState],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (activePointerIdRef.current !== event.pointerId) {
        return;
      }

      event.preventDefault();
      const point = pointerEventToCanvasPoint(event);
      drawStroke(lastPointRef.current ?? point, point);
      lastPointRef.current = point;
    },
    [drawStroke],
  );

  const finishPointerStroke = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (activePointerIdRef.current !== event.pointerId) {
        return;
      }

      event.currentTarget.releasePointerCapture(event.pointerId);
      activePointerIdRef.current = null;
      lastPointRef.current = null;

      if (tool === 'eraser') {
        refreshMaskHasPaint();
      }
    },
    [refreshMaskHasPaint, tool],
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setExportError(null);

    if (submitDisabled) {
      return;
    }

    const sourceCanvas = sourceCanvasRef.current;
    const maskCanvas = maskCanvasRef.current;

    if (!sourceCanvas || !maskCanvas) {
      setExportError('Canvas is not ready yet.');
      return;
    }

    try {
      const exported = exportInpaintPngs(sourceCanvas, maskCanvas);

      if (!exported.maskHasPaint) {
        setMaskHasPaint(false);
        setExportError('Paint at least one region to edit before submitting.');
        return;
      }

      await onSubmit({
        ...exported,
        prompt: prompt.trim(),
        model,
        quality,
        size,
        moderation,
      });
    } catch (error) {
      setExportError(errorToMessage(error));
    }
  };

  return (
    <form aria-label="Canvas inpaint editor" onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-h-0 rounded-2xl border bg-muted/20 p-3">
          <div className="flex min-h-[20rem] items-center justify-center overflow-auto rounded-xl bg-background p-2">
            {loadState === 'ready' ? null : (
              <CanvasLoadState loadState={loadState} loadError={loadError} sourceUrl={sourceUrl} />
            )}
            <div className={cn('relative inline-block max-w-full', loadState !== 'ready' && 'hidden')}>
              <canvas
                ref={sourceCanvasRef}
                className="block max-h-[calc(100vh-18rem)] max-w-full rounded-lg shadow-sm"
              />
              <canvas
                ref={maskCanvasRef}
                aria-label="Mask canvas"
                className={cn(
                  'absolute inset-0 h-full w-full touch-none rounded-lg opacity-60 mix-blend-screen outline-none ring-1 ring-border',
                  tool === 'eraser' ? 'cursor-cell' : 'cursor-crosshair',
                )}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={finishPointerStroke}
                onPointerCancel={finishPointerStroke}
              />
            </div>
          </div>
        </div>

        <aside className="flex min-h-0 flex-col gap-4 overflow-auto rounded-2xl border bg-card p-4 text-card-foreground">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={codexConnected ? 'secondary' : 'outline'}>
                Codex/OpenAI {codexConnected ? 'connected' : 'required'}
              </Badge>
              <Badge variant="outline">provider: {CANVAS_INPAINT_CONTRACT.provider}</Badge>
            </div>
            <p role="status" className="text-sm text-muted-foreground">
              {providerMessage}
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="canvas-prompt" className="text-sm font-medium">
              Inpaint prompt
            </label>
            <Textarea
              id="canvas-prompt"
              aria-label="Inpaint prompt"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Describe what should replace the painted region…"
              disabled={isSubmitting}
              className="min-h-28"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <Select value={model} onValueChange={setModel} disabled={isSubmitting || !codexConnected}>
              <SelectTrigger aria-label="Canvas model" className="w-full">
                <SelectValue placeholder="Model" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {MODEL_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>

            <Select value={size} onValueChange={setSize} disabled={isSubmitting || !codexConnected}>
              <SelectTrigger aria-label="Canvas output size" className="w-full">
                <SelectValue placeholder="Output size" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {SIZE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>

            <Select value={quality} onValueChange={setQuality} disabled={isSubmitting || !codexConnected}>
              <SelectTrigger aria-label="Canvas quality" className="w-full">
                <SelectValue placeholder="Quality" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {QUALITY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>

            <Select
              value={moderation}
              onValueChange={setModeration}
              disabled={isSubmitting || !codexConnected}
            >
              <SelectTrigger aria-label="Canvas moderation" className="w-full">
                <SelectValue placeholder="Moderation" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {MODERATION_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-3 rounded-xl bg-muted/40 p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium">Mask tools</p>
              {canvasSize ? (
                <p className="text-xs text-muted-foreground">
                  {canvasSize.width} × {canvasSize.height}px
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={tool === 'brush' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTool('brush')}
                disabled={isSubmitting}
              >
                <PaintbrushIcon data-icon="inline-start" />
                Brush
              </Button>
              <Button
                type="button"
                variant={tool === 'eraser' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTool('eraser')}
                disabled={isSubmitting}
              >
                <EraserIcon data-icon="inline-start" />
                Eraser
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={handleClearMask} disabled={isSubmitting}>
                <RotateCcwIcon data-icon="inline-start" />
                Clear
              </Button>
            </div>
            <label htmlFor="brush-size" className="text-sm text-muted-foreground">
              Brush size: {brushSize}px
            </label>
            <Input
              id="brush-size"
              type="range"
              min={MIN_BRUSH_SIZE}
              max={MAX_BRUSH_SIZE}
              step={4}
              value={brushSize}
              onChange={(event) => setBrushSize(Number(event.target.value))}
              disabled={isSubmitting}
            />
          </div>

          <div className="flex flex-col gap-2 text-sm text-muted-foreground">
            <p>{CANVAS_INPAINT_CONTRACT.sourceImage}</p>
            <p>{CANVAS_INPAINT_CONTRACT.mask}</p>
            <p>Source asset: {asset.filename}</p>
          </div>

          {exportError || submitError ? (
            <p role="alert" className="text-sm text-destructive">
              {exportError ?? submitError}
            </p>
          ) : null}
          {submitSuccess ? (
            <p role="status" className="text-sm text-muted-foreground">
              {submitSuccess}
            </p>
          ) : null}

          <div className="mt-auto flex flex-wrap justify-end gap-2 border-t pt-4">
            {isSubmitting && onCancel ? (
              <Button type="button" variant="outline" onClick={onCancel}>
                <XIcon data-icon="inline-start" />
                Cancel
              </Button>
            ) : null}
            <Button type="submit" disabled={submitDisabled}>
              <SparklesIcon data-icon="inline-start" />
              {isSubmitting ? 'Inpainting…' : 'Inpaint masked area'}
            </Button>
          </div>
        </aside>
      </div>
    </form>
  );
}

function CanvasLoadState({
  loadState,
  loadError,
  sourceUrl,
}: {
  loadState: LoadState;
  loadError: string | null;
  sourceUrl: string | undefined;
}) {
  if (!sourceUrl) {
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Waiting for the asset URL…
      </p>
    );
  }

  if (loadState === 'error') {
    return (
      <p role="alert" className="max-w-md text-center text-sm text-destructive">
        {loadError ?? 'The source image could not be loaded.'}
      </p>
    );
  }

  return <Skeleton className="h-[min(60vh,32rem)] w-full max-w-3xl" />;
}

function pointerEventToCanvasPoint(event: React.PointerEvent<HTMLCanvasElement>): CanvasPoint {
  const canvas = event.currentTarget;
  return clientPointToCanvasPoint(
    { x: event.clientX, y: event.clientY },
    canvas.getBoundingClientRect(),
    { width: canvas.width, height: canvas.height },
  );
}

function errorToMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return 'Canvas export failed.';
}
