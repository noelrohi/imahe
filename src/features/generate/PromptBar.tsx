import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ImageIcon, SparklesIcon } from 'lucide-react';

import {
  useProviderStatuses,
  type ProviderCardStatus,
  type ProviderStatusClient,
} from '@/features/auth/hooks';
import { Badge } from '@/components/ui/badge';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from '@/components/ui/input-group';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import {
  type GenerateClient,
  type GenerateMutationResult,
  type UiGenerationProvider,
  useGenerate,
} from './hooks';

const PROVIDER_OPTIONS: Array<{
  value: UiGenerationProvider;
  label: string;
  description: string;
}> = [
  {
    value: 'codex',
    label: 'Codex / OpenAI',
    description: 'OAuth image generation',
  },
  {
    value: 'grok',
    label: 'Grok',
    description: 'xAI image generation',
  },
];

const MODEL_OPTIONS: Record<UiGenerationProvider, Array<{ value: string; label: string }>> = {
  codex: [
    { value: 'gpt-5.4-mini', label: 'GPT-5.4 mini' },
    { value: 'gpt-5.4', label: 'GPT-5.4' },
    { value: 'gpt-5.5', label: 'GPT-5.5' },
  ],
  grok: [
    { value: 'grok-imagine-image', label: 'Grok Imagine' },
    { value: 'grok-imagine-image-quality', label: 'Grok Imagine Quality' },
  ],
};

const COUNT_OPTIONS = [1, 2, 3, 4];

const SIZE_OPTIONS = [
  { value: '1024x1024', label: 'Square 1:1' },
  { value: '1824x1024', label: 'Wide 16:9' },
  { value: '1024x1824', label: 'Tall 9:16' },
  { value: '1536x1024', label: 'Frame 3:2' },
  { value: '1024x1536', label: 'Portrait 2:3' },
];

export type PromptBarProps = {
  generateClient?: GenerateClient;
  providerStatusClient?: ProviderStatusClient;
  onRequestStarted?: (result: GenerateMutationResult) => void;
};

export function PromptBar({
  generateClient,
  providerStatusClient,
  onRequestStarted,
}: PromptBarProps) {
  const { providers } = useProviderStatuses({ client: providerStatusClient });
  const generateMutation = useGenerate({ client: generateClient });
  const [prompt, setPrompt] = useState('');
  const [provider, setProvider] = useState<UiGenerationProvider>('codex');
  const [model, setModel] = useState(MODEL_OPTIONS.codex[0].value);
  const [count, setCount] = useState('1');
  const [size, setSize] = useState(SIZE_OPTIONS[0].value);

  const connectedProvider = useMemo(
    () => PROVIDER_OPTIONS.find((option) => providers[option.value].connected)?.value,
    [providers],
  );

  useEffect(() => {
    if (!providers[provider].connected && connectedProvider) {
      setProvider(connectedProvider);
    }
  }, [connectedProvider, provider, providers]);

  useEffect(() => {
    const validModels = MODEL_OPTIONS[provider];
    if (!validModels.some((option) => option.value === model)) {
      setModel(validModels[0].value);
    }
  }, [model, provider]);

  const selectedProviderStatus = providers[provider];
  const selectedProviderConnected = selectedProviderStatus.connected;
  const imageCount = Number(count);
  const promptIsBlank = prompt.trim().length === 0;
  const submitDisabled =
    promptIsBlank || !selectedProviderConnected || generateMutation.isPending;
  const submitLabel = imageCount > 1 ? 'Create variants' : 'Generate';

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (submitDisabled) {
      return;
    }

    void generateMutation
      .mutateAsync({
        prompt,
        provider,
        model,
        count: imageCount,
        size,
        quality: 'medium',
        format: 'png',
        moderation: 'low',
        references: [],
      })
      .then((result) => {
        setPrompt('');
        onRequestStarted?.(result);
      })
      .catch(() => undefined);
  };

  return (
    <section className="flex flex-col gap-3 rounded-3xl border bg-card p-3 text-card-foreground shadow-sm">
      <div className="flex flex-col gap-1 px-1">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">Create</h1>
            <p className="text-sm text-muted-foreground">
              Write a prompt, choose a signed-in provider, and send async jobs to ima2.
            </p>
          </div>
          <ProviderBadges providers={providers} />
        </div>
      </div>

      <form aria-label="Generate images" onSubmit={handleSubmit}>
        <InputGroup className="h-auto min-h-36 items-stretch overflow-hidden rounded-2xl bg-background">
          <InputGroupTextarea
            aria-label="Prompt"
            className="min-h-24 px-3 py-3 text-base"
            placeholder="Describe the image you want to make…"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
          />
          <InputGroupAddon
            align="block-end"
            className="flex-wrap justify-between gap-2 border-t bg-muted/20"
          >
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <Select
                value={provider}
                onValueChange={(value) => setProvider(value as UiGenerationProvider)}
              >
                <SelectTrigger aria-label="Provider" className="w-40">
                  <SelectValue placeholder="Provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {PROVIDER_OPTIONS.map((option) => {
                      const status = providers[option.value];

                      return (
                        <SelectItem
                          key={option.value}
                          value={option.value}
                          disabled={!status.connected}
                        >
                          {option.label}
                        </SelectItem>
                      );
                    })}
                  </SelectGroup>
                </SelectContent>
              </Select>

              <Select value={model} onValueChange={setModel} disabled={!selectedProviderConnected}>
                <SelectTrigger aria-label="Model" className="w-44">
                  <SelectValue placeholder="Model" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {MODEL_OPTIONS[provider].map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>

              <Select value={count} onValueChange={setCount}>
                <SelectTrigger aria-label="Image count" className="w-32">
                  <SelectValue placeholder="Count" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {COUNT_OPTIONS.map((option) => (
                      <SelectItem key={option} value={String(option)}>
                        {option === 1 ? '1 image' : `${option} variants`}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>

              <Select value={size} onValueChange={setSize}>
                <SelectTrigger aria-label="Aspect ratio" className="w-36">
                  <SelectValue placeholder="Aspect" />
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
            </div>

            <InputGroupButton type="submit" variant="default" disabled={submitDisabled}>
              {generateMutation.isPending ? (
                <ImageIcon data-icon="inline-start" />
              ) : (
                <SparklesIcon data-icon="inline-start" />
              )}
              {generateMutation.isPending ? 'Submitting…' : submitLabel}
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </form>

      {!selectedProviderConnected ? (
        <p role="status" className="px-1 text-sm text-muted-foreground">
          Connect Codex/OpenAI or Grok in Settings before generating.
        </p>
      ) : null}

      {generateMutation.isError ? (
        <p role="alert" className="px-1 text-sm text-destructive">
          {errorToMessage(generateMutation.error)}
        </p>
      ) : null}
    </section>
  );
}

function ProviderBadges({
  providers,
}: {
  providers: Record<UiGenerationProvider, ProviderCardStatus>;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {PROVIDER_OPTIONS.map((option) => {
        const status = providers[option.value];

        return (
          <Badge
            key={option.value}
            variant={status.connected ? 'secondary' : 'outline'}
            title={status.statusText}
          >
            {option.label}: {status.connected ? 'Connected' : 'Disconnected'}
          </Badge>
        );
      })}
    </div>
  );
}

function errorToMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Generation failed.';
}
