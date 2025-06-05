import "@/styles/globals.css";

import { Toaster } from "@/components/ui/sonner";
import { TrpcReactProvider } from "@/trpc/react";
import type { Metadata } from "next";
import { Funnel_Display, Lexend_Deca } from "next/font/google";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { ThemeProvider } from "next-themes";
import { APP_NAME } from "@/constants";

export const metadata: Metadata = {
  title: {
    default: APP_NAME,
    template: `%s | ${APP_NAME}`,
  },
  description: "Get testimonials from your customers for free",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const funnel_display = Funnel_Display({
  subsets: ["latin"],
  weight: ["600"],
  variable: "--display-family",
});

const lexend_deca = Lexend_Deca({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--text-family",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${funnel_display.variable} ${lexend_deca.variable}`}>
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
