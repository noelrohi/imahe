import "@/styles/globals.css";

import { Toaster } from "@/components/ui/sonner";
import { APP_NAME } from "@/constants";
import { TrpcReactProvider } from "@/trpc/react";
import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import { NuqsAdapter } from "nuqs/adapters/next/app";

export const metadata: Metadata = {
  title: {
    default: APP_NAME,
    template: `%s | ${APP_NAME}`,
  },
  description: "Get testimonials from your customers for free",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <TrpcReactProvider>
            <NuqsAdapter>{children}</NuqsAdapter>
          </TrpcReactProvider>
        </ThemeProvider>
        <Toaster />
      </body>
    </html>
  );
}
