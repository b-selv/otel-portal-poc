import type { Metadata } from "next";
import "./globals.css";
import { AmplifyProvider } from "@/components/amplify-provider";

export const metadata: Metadata = {
  title: "API Developer Portal",
  description: "OpenTelemetry proof of concept"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <AmplifyProvider>{children}</AmplifyProvider>
      </body>
    </html>
  );
}
