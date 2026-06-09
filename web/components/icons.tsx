import type { CSSProperties, ReactNode } from "react";

export interface IconProps {
  size?: number;
  sw?: number;
  fill?: string;
  style?: CSSProperties;
}

function Ico({
  d,
  size = 16,
  sw = 2,
  fill = "none",
  children,
  style,
}: IconProps & { d?: string; children?: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke="currentColor"
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
    >
      {d ? <path d={d} /> : children}
    </svg>
  );
}

export const Icons = {
  pulse: (p: IconProps) => <Ico {...p} d="M3 12h4l3 8 4-16 3 8h4" />,
  grid: (p: IconProps) => (
    <Ico {...p}>
      <path d="M3 5h7v7H3zM14 5h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z" />
    </Ico>
  ),
  trending: (p: IconProps) => (
    <Ico {...p}>
      <path d="M3 17l6-6 4 4 8-8" />
      <path d="M17 7h4v4" />
    </Ico>
  ),
  factory: (p: IconProps) => (
    <Ico {...p}>
      <path d="M3 21h18M4 21V9l6 4V9l6 4V5l4 2v14" />
    </Ico>
  ),
  bookmark: (p: IconProps) => (
    <Ico {...p}>
      <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z" />
    </Ico>
  ),
  globe: (p: IconProps) => (
    <Ico {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.7 2.5 15.3 0 18M12 3c-2.5 2.7-2.5 15.3 0 18" />
    </Ico>
  ),
  search: (p: IconProps) => (
    <Ico {...p}>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </Ico>
  ),
  arrowRight: (p: IconProps) => <Ico {...p} d="M5 12h14M13 6l6 6-6 6" />,
  arrowUpRight: (p: IconProps) => (
    <Ico {...p}>
      <path d="M7 17 17 7M8 7h9v9" />
    </Ico>
  ),
  spark: (p: IconProps) => <Ico {...p} d="M12 3l2.2 6.3L20 11l-5.8 1.7L12 19l-2.2-6.3L4 11l5.8-1.7z" />,
  check: (p: IconProps) => <Ico {...p} d="M5 12l5 5 9-9" />,
  shield: (p: IconProps) => (
    <Ico {...p}>
      <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
      <path d="M9 12l2 2 4-4" />
    </Ico>
  ),
  clock: (p: IconProps) => (
    <Ico {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v4l3 2" />
    </Ico>
  ),
  refresh: (p: IconProps) => (
    <Ico {...p}>
      <path d="M21 12a9 9 0 1 1-2.6-6.4L21 8" />
      <path d="M21 3v5h-5" />
    </Ico>
  ),
  box: (p: IconProps) => (
    <Ico {...p}>
      <path d="M21 8 12 3 3 8l9 5 9-5zM3 8v8l9 5 9-5V8M12 13v8" />
    </Ico>
  ),
  alert: (p: IconProps) => (
    <Ico {...p}>
      <path d="M12 9v4M12 17h0M10.3 3.9l-8.4 14a2 2 0 0 0 1.7 3h16.8a2 2 0 0 0 1.7-3l-8.4-14a2 2 0 0 0-3.4 0z" />
    </Ico>
  ),
  plus: (p: IconProps) => <Ico {...p} d="M12 5v14M5 12h14" />,
  x: (p: IconProps) => <Ico {...p} d="M6 6l12 12M18 6 6 18" />,
  bell: (p: IconProps) => (
    <Ico {...p}>
      <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" />
    </Ico>
  ),
  chevronLeft: (p: IconProps) => <Ico {...p} d="M15 18l-6-6 6-6" />,
  building: (p: IconProps) => (
    <Ico {...p}>
      <path d="M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16M15 9h4a1 1 0 0 1 1 1v11M8 8h2M8 12h2M8 16h2" />
    </Ico>
  ),
  send: (p: IconProps) => <Ico {...p} d="M22 2 11 13M22 2l-7 20-4-9-9-4z" />,
  mail: (p: IconProps) => (
    <Ico {...p}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </Ico>
  ),
  sun: (p: IconProps) => (
    <Ico {...p}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </Ico>
  ),
  moon: (p: IconProps) => <Ico {...p} d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />,
};

export type IconName = keyof typeof Icons;
