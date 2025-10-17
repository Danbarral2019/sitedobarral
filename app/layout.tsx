import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ToastProviderWrapper } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { ScrollToTop } from "@/components/ui/scroll-to-top";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Prof. Daniel Barral - Especialista em Licitações e Contratos",
  description: "Repositório especializado de materiais jurídicos em Direito Administrativo. Cursos, materiais e conteúdo exclusivo sobre licitações e contratos administrativos.",
  keywords: "licitações, contratos administrativos, direito administrativo, nova lei de licitações, 14.133/2021, TCU, AGU",
  authors: [{ name: "Prof. Daniel Barral" }],
  openGraph: {
    title: "Prof. Daniel Barral - Especialista em Licitações e Contratos",
    description: "Repositório especializado de materiais jurídicos em Direito Administrativo",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${inter.variable} font-sans antialiased bg-white text-gray-900`}>
        <ToastProviderWrapper>
          <div className="min-h-screen flex flex-col">
            <Header />
            <div className="flex-1">
              {children}
            </div>
            <Footer />
          </div>
          <Toaster />
          <ScrollToTop />
        </ToastProviderWrapper>
      </body>
    </html>
  );
}
