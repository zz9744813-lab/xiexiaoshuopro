import type { Metadata } from "next";
import "./globals.css";
import { TopNav } from "./_components/top-nav";

export const metadata: Metadata = {
  title: "多智能体小说模拟系统",
  description: "Multi-Agent Visual Novel Simulation System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-zinc-50 dark:bg-black">
        <TopNav />
        <div className="flex-1">{children}</div>
      </body>
    </html>
  );
}
