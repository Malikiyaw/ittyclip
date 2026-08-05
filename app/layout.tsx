import type { Metadata } from "next";
import "@fontsource/space-grotesk/400.css";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/700.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "./globals.css";
import { ScrollProvider } from "@/components/ScrollProvider";
import { Cursor } from "@/components/landing/Cursor";
import BackgroundShaderClient from "@/components/landing/BackgroundShaderClient";

export const metadata: Metadata = {
  title: "ittyclip — Every long video. Clipped into gold.",
  description:
    "ittyclip is the browser-native AI clipping studio. It hunts your best moments, captions them word-perfect, reframes them vertical, and ships viral shorts — 1000x faster than Opus.",
  keywords: ["ai video clipping", "short form", "opus clip alternative", "auto captions", "tiktok shorts editor"],
  openGraph: {
    title: "ittyclip — Every long video. Clipped into gold.",
    description:
      "The browser-native AI studio that turns long videos into viral shorts. Zero installs, zero uploads, zero waiting.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="bg-ink text-fg">
        <ScrollProvider>
          {children}
          <BackgroundShaderClient />
          <Cursor />
        </ScrollProvider>
      </body>
    </html>
  );
}
