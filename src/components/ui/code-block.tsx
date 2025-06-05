"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils"; // Assuming you have a utility for class names
import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import type { HTMLAttributes } from "react"; // Use type import

interface CodeBlockProps extends HTMLAttributes<HTMLElement> {
  code: string;
  language?: string;
}

export function CodeBlock({
  code,
  language,
  className,
  ...props
}: CodeBlockProps) {
  const langClass = language ? `language-${language}` : "";
  const [isCopied, setIsCopied] = useState(false);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setIsCopied(true);
    } catch (err) {
      console.error("Failed to copy text: ", err);
      // Optionally, add user feedback for error
    }
  };

  // Reset copied state after a short delay
  useEffect(() => {
    if (isCopied) {
      const timer = setTimeout(() => {
        setIsCopied(false);
      }, 2000); // Reset after 2 seconds
      return () => clearTimeout(timer);
    }
  }, [isCopied]);

  return (
    <div className="relative">
      <pre
        className={cn(
          "mb-4 mt-6 overflow-x-auto rounded-lg border bg-muted p-4 pr-12 font-mono text-sm", // Added pr-12 for button space
          className,
        )}
        {...props}
      >
        <code
          className={cn(
            "relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-semibold",
            langClass,
          )}
        >
          {code}
        </code>
      </pre>
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-2 top-2 h-7 w-7 text-muted-foreground hover:bg-muted-foreground/10 hover:text-muted-foreground"
        onClick={copyToClipboard}
        aria-label={isCopied ? "Copied!" : "Copy code"}
      >
        {isCopied ? (
          <Check className="h-4 w-4 text-emerald-500" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}
