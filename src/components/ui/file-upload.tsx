"use client";

import { cn } from "@/lib/utils";
import { Image as ImageIcon, Upload, X } from "lucide-react";
import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "./button";
import { Card, CardContent } from "./card";

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  onUrlChange: (url: string) => void;
  accept?: Record<string, string[]>;
  maxSize?: number;
  disabled?: boolean;
  currentUrl?: string;
}

export function FileUpload({
  onFileSelect,
  onUrlChange,
  accept = { "image/*": [".png", ".jpg", ".jpeg", ".gif", ".webp"] },
  maxSize = 10 * 1024 * 1024, // 10MB
  disabled = false,
  currentUrl = "",
}: FileUploadProps) {
  const [preview, setPreview] = useState<string>(currentUrl);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (file) {
        setIsUploading(true);
        // Create local preview immediately
        const localUrl = URL.createObjectURL(file);
        setPreview(localUrl);
        onFileSelect(file);

        try {
          // Convert file to base64
          const reader = new FileReader();
          reader.onload = () => {
            const base64String = reader.result as string;
            onUrlChange(base64String);
            setIsUploading(false);
          };
          reader.onerror = () => {
            console.error("Failed to convert file to base64");
            // Fallback to local URL if conversion fails
            onUrlChange(localUrl);
            setIsUploading(false);
          };
          reader.readAsDataURL(file);
        } catch (error) {
          console.error("File processing failed:", error);
          // Fallback to local URL if processing fails
          onUrlChange(localUrl);
          setIsUploading(false);
        }
      }
      setIsDragActive(false);
    },
    [onFileSelect, onUrlChange],
  );

  const { getRootProps, getInputProps, isDragReject } = useDropzone({
    onDrop,
    accept,
    maxSize,
    multiple: false,
    disabled: disabled || isUploading,
    onDragEnter: () => setIsDragActive(true),
    onDragLeave: () => setIsDragActive(false),
  });

  const clearPreview = () => {
    setPreview("");
    onUrlChange("");
    if (preview?.startsWith("blob:")) {
      URL.revokeObjectURL(preview);
    }
  };

  return (
    <div className="space-y-4">
      {preview ? (
        <Card className="relative">
          <CardContent className="p-4">
            <div className="relative aspect-video rounded-lg overflow-hidden bg-muted">
              <img
                src={preview}
                alt="Preview"
                className="object-cover w-full h-full"
              />
              <Button
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2 h-8 w-8"
                onClick={clearPreview}
                disabled={disabled || isUploading}
              >
                <X className="h-4 w-4" />
              </Button>
              {isUploading && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg">
                  <div className="bg-white rounded-lg p-3 flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
                    <span className="text-sm font-medium">Processing...</span>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card
          {...getRootProps()}
          className={cn(
            "border-2 border-dashed cursor-pointer transition-colors",
            isDragActive && "border-primary bg-primary/5",
            isDragReject && "border-destructive bg-destructive/5",
            disabled && "cursor-not-allowed opacity-50",
          )}
        >
          <CardContent className="p-8 text-center">
            <input {...getInputProps()} />
            <div className="space-y-4">
              <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                {isDragActive ? (
                  <Upload className="h-6 w-6 text-primary" />
                ) : (
                  <ImageIcon className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
              <div className="space-y-2">
                <h3 className="font-medium">
                  {isDragActive ? "Drop your image here" : "Upload an image"}
                </h3>
                <p className="text-sm text-muted-foreground">
                  Drag and drop an image, or click to browse
                </p>
                <p className="text-xs text-muted-foreground">
                  Supports PNG, JPG, JPEG, GIF, WebP (max{" "}
                  {Math.round(maxSize / 1024 / 1024)}MB)
                </p>
              </div>
              <Button variant="outline" disabled={disabled || isUploading}>
                {isUploading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
                    Processing...
                  </>
                ) : (
                  "Choose File"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
