import type { Metadata } from "next";
import "./tokens.css";
import "./app.css";

export const metadata: Metadata = {
  title: "productScope · Lidl Product Scouting",
  description:
    "Spot trending products and the suppliers who can make them — demand momentum meets the supply chain, for Lidl's buying team.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
