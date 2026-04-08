import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Resume Lab",
  description: "An end-to-end local resume analysis and interview simulator built with Next.js and LangGraph.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
