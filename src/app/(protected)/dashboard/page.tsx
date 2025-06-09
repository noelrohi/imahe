"use client";

import { ImageGallery } from "@/components/blocks/dashboard/image-gallery";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FileUpload } from "@/components/ui/file-upload";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { authClient } from "@/lib/auth-client";
import { falClient } from "@/lib/fal";
import { models } from "@/lib/models";
import { useTRPC } from "@/lib/trpc";
import type { Images } from "@/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image as ImageIcon, Sparkles } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

export default function Dashboard() {
  const [imageUrl, setImageUrl] = useState("");
  const [fileName, setFileName] = useState("");
  const [status, setStatus] = useState<"idle" | "generating" | "completed">(
    "idle",
  );
  const [isPending, startTransition] = useTransition();
  const [prompt, setPrompt] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedModel, setSelectedModel] =
    useState<keyof typeof models>("professional");

  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const {
    data,
    isLoading: isLoadingBalance,
    refetch,
  } = useQuery({
    queryKey: ["balance"],
    queryFn: async () => {
      const { data } = await authClient.customer.state();
      const activeSubscription = data?.activeSubscriptions[0];
      return {
        balance: data?.activeMeters[0]?.balance ?? 0,
        isFree: activeSubscription?.amount === 0,
      };
    },
  });

  const hasBalance = useMemo(() => {
    return (data?.balance ?? 0) > 0;
  }, [data]);

  const claimFreeCredits = useMutation({
    mutationKey: ["claim-free-credits"],
    mutationFn: async () => {
      await authClient.checkout({
        slug: "free",
      });
    },
  });

  const createRequest = useMutation(
    trpc.generation.createRequest.mutationOptions({
      onSuccess: () => {
        toast.success("Image generated successfully!");
        setPrompt("");
        setImageUrl("");
        setFileName("");
        setSelectedFile(null);
        // Invalidate and refetch the generations query
        queryClient.invalidateQueries(
          trpc.generation.getAllByUser.queryFilter(),
        );
      },
      onError: (error) => {
        toast.error(error.message || "Failed to generate image");
      },
    }),
  );

  const currentModel = models[selectedModel as keyof typeof models];
  const hasPromptInput =
    currentModel &&
    "promptLabel" in currentModel &&
    "promptPlaceholder" in currentModel;

  const handleFileSelect = (file: File | null) => {
    setSelectedFile(file);
    if (file) {
      setFileName(file.name);
    } else {
      setFileName("");
    }
  };

  const handleUrlChange = (url: string) => {
    setImageUrl(url);
    // If it's a regular URL (not base64), clear the file name
    if (url && !url.startsWith("data:")) {
      setFileName("");
    }
  };

  const handleGenerate = async () => {
    if (!imageUrl.trim()) {
      toast.error("Please provide an image URL");
      return;
    }

    if (!currentModel) {
      toast.error("Please select a model");
      return;
    }

    startTransition(async () => {
      const input: { image_url: string; prompt?: string } = {
        image_url: imageUrl.trim(),
      };

      // Add prompt if the model supports it and user provided one
      if (hasPromptInput && prompt.trim()) {
        input.prompt = prompt.trim();
      }

      if (!hasBalance) {
        toast.error("You don't have enough credits to generate an image");
        return;
      }

      await falClient.subscribe(currentModel.model, {
        input,
        logs: true,
        onEnqueue: async (requestId) => {
          await authClient.usage.ingest({
            event: "imageGen-usage",
            metadata: {
              requestId,
              model: selectedModel,
            },
          });
        },
        onQueueUpdate: async (update) => {
          if (update.status === "IN_PROGRESS") {
            setStatus("generating");
          }
          if (update.status === "COMPLETED") {
            setStatus("completed");
            const result = await falClient.queue.result(currentModel.model, {
              requestId: update.request_id,
            });
            createRequest.mutate({
              requestId: update.request_id,
              images: result.data.images as Images[],
              prompt,
            });

            refetch();
          }
        },
      });
    });
  };

  return (
    <div className="container mx-auto p-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Side - Form */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                {currentModel && "promptLabel" in currentModel
                  ? currentModel.promptLabel
                  : selectedModel.charAt(0).toUpperCase() +
                    selectedModel.slice(1).replace(/([A-Z])/g, " $1")}
              </CardTitle>
              <CardDescription>
                {currentModel?.description || "Select a model to get started"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Model Selection */}
              <div className="space-y-2">
                <Label htmlFor="model">Enhancement Model</Label>
                <Select
                  value={selectedModel}
                  onValueChange={(value) => {
                    const model = models[value as keyof typeof models];
                    setSelectedModel(value as keyof typeof models);
                    setPrompt(
                      "promptPlaceholder" in model
                        ? model.promptPlaceholder
                        : "",
                    );
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select an enhancement model" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(models).map(([key, model]) => (
                      <SelectItem key={key} value={key}>
                        {"promptLabel" in model
                          ? model.promptLabel
                          : key.charAt(0).toUpperCase() +
                            key.slice(1).replace(/([A-Z])/g, " $1")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Image Input Tabs */}
              <div className="space-y-2">
                <Label>Image Source</Label>
                <Tabs defaultValue="upload" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="upload">Upload File</TabsTrigger>
                    <TabsTrigger value="url">Image URL</TabsTrigger>
                  </TabsList>
                  <TabsContent value="upload" className="space-y-2">
                    <FileUpload
                      onFileSelect={handleFileSelect}
                      onUrlChange={handleUrlChange}
                      disabled={status === "generating"}
                      currentUrl={imageUrl}
                    />
                    {fileName && (
                      <p className="text-xs text-muted-foreground">
                        Selected file: {fileName}
                      </p>
                    )}
                  </TabsContent>
                  <TabsContent value="url" className="space-y-2">
                    <Input
                      id="imageUrl"
                      type="url"
                      placeholder="https://example.com/your-image.jpg"
                      value={imageUrl}
                      onChange={(e) => {
                        const value = e.target.value;
                        setImageUrl(value);
                        setFileName("");
                        setSelectedFile(null);
                      }}
                      disabled={status === "generating"}
                    />
                    <p className="text-xs text-muted-foreground">
                      Paste a direct link to an image file
                    </p>
                  </TabsContent>
                </Tabs>
              </div>

              {/* Conditional Prompt Input */}
              {hasPromptInput && (
                <div className="space-y-2">
                  <Label htmlFor="prompt">
                    {"promptLabel" in currentModel
                      ? currentModel.promptLabel
                      : "Prompt"}
                  </Label>
                  <Textarea
                    id="prompt"
                    placeholder={
                      "promptPlaceholder" in currentModel
                        ? currentModel.promptPlaceholder
                        : "Enter your prompt..."
                    }
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    disabled={status === "generating"}
                    rows={3}
                  />
                </div>
              )}
              {data && (
                <div className="text-sm text-muted-foreground">
                  Balance: {data?.balance}x
                </div>
              )}

              {hasBalance && (
                <Button
                  onClick={handleGenerate}
                  disabled={isPending || !hasBalance}
                  className="w-full"
                  size="lg"
                >
                  {status === "generating" ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <ImageIcon className="h-4 w-4 mr-2" />
                      Generate Enhanced Image
                    </>
                  )}
                </Button>
              )}
              {!hasBalance && data?.isFree === false && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    claimFreeCredits.mutate();
                  }}
                  disabled={claimFreeCredits.isPending}
                >
                  Claim Free Credits
                </Button>
              )}
              {!hasBalance && data?.isFree === true && (
                <Button variant="outline" className="w-full" asChild>
                  <Link href="/pricing">Buy Credits</Link>
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Side - Gallery */}
        <ImageGallery />
      </div>
    </div>
  );
}
