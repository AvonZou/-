import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "NextStep OS · 个人成长工作台",
  description: "本地优先的求职与成长工作台",
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
