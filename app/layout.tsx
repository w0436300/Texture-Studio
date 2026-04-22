import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Texture Studio — 材质字效生成器",
  description:
    "将普通文字一键生成具有高级材质与堆叠感的 3D 视觉海报。",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
