import type { Metadata } from "next";
import { Inter, Noto_Sans_SC, Geist_Mono } from "next/font/google";
import { I18nProvider } from "@/lib/i18n";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "vietnamese"],
});

const notoSansSC = Noto_Sans_SC({
  variable: "--font-noto-sc",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Pancake SLA Monitor",
  description: "Internal dashboard theo dõi hiệu suất phản hồi tin nhắn trên các trang Pancake",
  openGraph: {
    title: "Pancake SLA Monitor",
    description: "Internal dashboard theo dõi hiệu suất phản hồi tin nhắn trên các trang Pancake",
    type: "website",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Pancake SLA Monitor",
    description: "Internal dashboard theo dõi hiệu suất phản hồi tin nhắn trên các trang Pancake",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${notoSansSC.variable} ${geistMono.variable} h-full antialiased light`}
    >
      <body className="h-full flex flex-col bg-white text-zinc-900">
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
