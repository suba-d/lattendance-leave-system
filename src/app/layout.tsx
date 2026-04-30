import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "出勤與請假系統",
  description: "公司內部打卡與請假管理",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-TW">
      <body>{children}</body>
    </html>
  );
}
