"use client";

import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useTRPC } from "@/lib/trpc";
import type { RouterOutput } from "@/server/api/root";
import { useQuery } from "@tanstack/react-query";
import { Clock, Download, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";

type Generation = RouterOutput["generation"]["getAllByUser"][number];

interface ImageDetailDialogProps {
  generation: Generation;
}

function ImageDetailDialog({ generation }: ImageDetailDialogProps) {
  const handleDownload = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
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

export function ImageGallery() {
  const trpc = useTRPC();
  const { data: generations, isLoading } = useQuery(
    trpc.generation.getAllByUser.queryOptions(),
  );
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold tracking-tight">
          Generated Images
        </h2>
        <Badge variant="secondary" className="text-sm">
          {generations?.length || 0} images
        </Badge>
      </div>

      {isLoading || !generations ? (
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
            <ImageDetailDialog key={generation.id} generation={generation} />
          ))}
        </div>
      )}
    </div>
  );
}
