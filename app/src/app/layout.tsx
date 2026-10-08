import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Velo — Modern AI Workspace",
    template: "%s | Velo",
  },
  description:
    "Manage projects, sprints, and tasks with AI-powered insights. Kanban boards, smart task assignment, and deadline predictions.",
  keywords: ["project management", "kanban", "sprints", "AI", "team collaboration"],
  openGraph: {
    type: "website",
    locale: "en_US",
    title: "Velo — Modern AI Workspace",
    description: "Manage projects with AI-powered insights",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  );
}
