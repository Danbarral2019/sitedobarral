import type { Metadata } from "next";
import { Cinzel, Poppins } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ToastProviderWrapper } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { ScrollToTop } from "@/components/ui/scroll-to-top";
import Analytics from "@/components/Analytics";
import WelcomeModal from "@/components/WelcomeModal";
import { SpeedInsights } from "@vercel/speed-insights/next";

const cinzel = Cinzel({
  subsets: ["latin"],
  variable: "--font-cinzel",
  display: "swap",
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    template: '%s | Prof. Daniel Barral',
    default: 'Prof. Daniel Barral - Especialista em Licitações e Contratos',
  },
  icons: {
    icon: '/brand/sublogo.png',
    shortcut: '/brand/sublogo.png',
    apple: '/brand/sublogo.png',
  },
  description: "Repositório especializado de materiais jurídicos em Direito Administrativo. Cursos sobre licitações, contratos administrativos, Nova Lei 14.133/2021 e mais.",
  keywords: [
    "licitações",
    "contratos administrativos",
    "direito administrativo",
    "nova lei de licitações",
    "lei 14.133/2021",
    "TCU",
    "AGU",
    "planejamento de contratações",
    "gestão de contratos",
    "processo administrativo sancionador",
    "Prof. Daniel Barral",
    "Procurador Federal",
    "cursos de licitações",
    "direito público",
  ],
  authors: [{ name: "Prof. Daniel Barral" }],
  creator: "Prof. Daniel Barral",
  publisher: "Prof. Daniel Barral",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    title: "Prof. Daniel Barral - Especialista em Licitações e Contratos",
    description: "Repositório especializado de materiais jurídicos em Direito Administrativo. Cursos sobre Nova Lei 14.133/2021, gestão de contratos e mais.",
    url: "https://profdanielbarral.com",
    siteName: "Prof. Daniel Barral",
    locale: "pt_BR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Prof. Daniel Barral - Especialista em Licitações e Contratos",
    description: "Repositório especializado de materiais jurídicos em Direito Administrativo",
    creator: "@profbarral",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    // google: 'seu-codigo-verificacao-google',
    // yandex: 'seu-codigo-verificacao-yandex',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${cinzel.variable} ${poppins.variable} font-sans antialiased bg-white text-gray-900`}>
        <Analytics />
        <SpeedInsights />
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
          <WelcomeModal />
        </ToastProviderWrapper>
      </body>
    </html>
  );
}
