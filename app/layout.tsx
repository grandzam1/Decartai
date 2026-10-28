import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Decart Live Studio — Realtime AI Camera",
  description: "Realtime AI camera transformation studio powered by Decart, featuring live models, prompt editing, and reference presets.",
  applicationName: "Decart Live Studio",
  openGraph: {
    title: "Decart Live Studio — Realtime AI Camera",
    description: "Realtime AI camera transformation studio powered by Decart, featuring live models, prompt editing, and reference presets.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Decart Live Studio — Realtime AI Camera",
    description: "Realtime AI camera transformation studio powered by Decart, featuring live models, prompt editing, and reference presets.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body>{children}</body>
    </html>
  );
}
