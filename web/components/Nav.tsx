"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Overview" },
  { href: "/map", label: "Map" },
  { href: "/signals", label: "About to trend" },
  { href: "/competitors", label: "Competitors" },
  { href: "/triggers", label: "Triggers" },
  { href: "/trends", label: "Trends" },
  { href: "/suppliers", label: "Suppliers" },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <header className="border-b border-edge bg-panel/60 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-3">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-lg font-semibold text-white">Retail Supply Intel</span>
          <span className="rounded bg-accent/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-accent">
            MVP
          </span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          {LINKS.map((l) => {
            const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-md px-3 py-1.5 transition ${
                  active ? "bg-edge text-white" : "text-gray-400 hover:text-white"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
