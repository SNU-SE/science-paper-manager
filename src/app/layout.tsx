import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { ErrorProvider } from "@/components/error/ErrorProvider";
import { QueryProvider } from "@/providers/QueryProvider";
import { PerformanceProvider } from "@/components/performance/PerformanceProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Science Paper Manager",
  description: "AI-powered research paper management system with multi-model analysis and semantic search",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <PerformanceProvider
          enableWebVitals={true}
          enableMemoryMonitoring={true}
          enableAnalytics={true}
        >
          <QueryProvider>
            <ErrorProvider
              enableGlobalErrorHandling={true}
              enableErrorBoundary={true}
              enableAsyncErrorBoundary={true}
            >
              <AuthProvider>
                {children}
              </AuthProvider>
              <Toaster />
            </ErrorProvider>
          </QueryProvider>
        </PerformanceProvider>
      </body>
    </html>
  );
}
