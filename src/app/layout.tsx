import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "ShopCraft UA — підготовка платформи",
  description: "Українська платформа для створення fashion-магазинів",
  robots: { index: false, follow: false },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="uk"><body>{children}</body></html>;
}
