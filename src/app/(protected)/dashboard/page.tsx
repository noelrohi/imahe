"use client";

import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { falClient } from "@/lib/fal";
import { models } from "@/lib/models";
import { useTRPC } from "@/lib/trpc";
import type { RouterOutput } from "@/server/api/root";
import type { Images } from "@/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, Download, Image as ImageIcon, Sparkles } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

type Generation = RouterOutput["generation"]["getAllByUser"][number];

interface ImageDetailDialogProps {
  generation: Generation;
}

function ImageDetailDialog({ generation }: ImageDetailDialogProps) {
  const handleDownload = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
      toast.success("Image downloaded successfully!");
    } catch (error) {
      toast.error("Failed to download image");
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Card className="group overflow-hidden p-0 cursor-pointer hover:ring-2 hover:ring-primary transition-all">
          <CardContent className="p-2">
            <AspectRatio
              ratio={1}
              className="bg-muted rounded-lg overflow-hidden"
            >
              <img
                src={generation.url ?? ""}
                alt={generation.prompt ?? ""}
                className="object-cover w-full h-full transition-transform group-hover:scale-105"
              />
            </AspectRatio>
          </CardContent>
        </Card>
      </DialogTrigger>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Image Details</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <AspectRatio
            ratio={16 / 9}
            className="bg-muted rounded-lg overflow-hidden"
          >
            <img
              src={generation.url ?? ""}
              alt={generation.prompt ?? undefined}
              className="object-contain w-full h-full"
            />
          </AspectRatio>
          <div className="space-y-2">
            <div>
              <Label className="text-sm font-medium">Prompt</Label>
              <p className="text-sm text-muted-foreground mt-1">
                {generation.prompt || "No prompt provided"}
              </p>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {new Date(generation.createdAt ?? "").toLocaleDateString()}
              </div>
              <div>ID: {generation.requestId}</div>
            </div>
            <Button
              onClick={() =>
                handleDownload(
                  generation.url ?? "",
                  `enhanced-${generation.id}.jpg`,
                )
              }
              className="w-full"
            >
              <Download className="h-4 w-4 mr-2" />
              Download Image
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Dashboard() {
  const [imageUrl, setImageUrl] = useState("");
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

  const { data: generations } = useQuery(
    trpc.generation.getAllByUser.queryOptions(),
  );

  const createRequest = useMutation(
    trpc.generation.createRequest.mutationOptions({
      onSuccess: () => {
        toast.success("Image generated successfully!");
        setPrompt("");
        setImageUrl("");
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

      await falClient.subscribe(currentModel.model, {
        input,
        logs: true,
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

              {/* Image Upload */}
              <div className="space-y-2">
                <Label>Upload Image</Label>
                <FileUpload
                  onFileSelect={setSelectedFile}
                  onUrlChange={setImageUrl}
                  disabled={status === "generating"}
                  currentUrl={imageUrl}
                />
              </div>

              {/* Image URL Alternative */}
              <div className="space-y-2">
                <Label htmlFor="imageUrl">Or paste image URL</Label>
                <Input
                  id="imageUrl"
                  type="url"
                  placeholder="https://example.com/your-image.jpg"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  disabled={status === "generating"}
                />
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

              <Button
                onClick={handleGenerate}
                disabled={status === "generating" || !imageUrl.trim()}
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
            </CardContent>
          </Card>
        </div>

        {/* Right Side - Gallery */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold tracking-tight">
              Generated Images
            </h2>
            <Badge variant="secondary" className="text-sm">
              {generations?.length || 0} images
            </Badge>
          </div>

          {!generations ? (
            <div className="grid grid-cols-2 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: loading skeleton
                <Card key={i}>
                  <CardContent className="p-2">
                    <Skeleton className="aspect-square w-full rounded-lg" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : generations.length === 0 ? (
            <Card className="text-center py-12">
              <CardContent>
                <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">
                  No images generated yet
                </h3>
                <p className="text-muted-foreground">
                  Generate your first enhanced image using the form
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-2 gap-4 max-h-[600px] overflow-y-auto p-2">
              {generations.map((generation) => (
                <ImageDetailDialog
                  key={generation.id}
                  generation={generation}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
