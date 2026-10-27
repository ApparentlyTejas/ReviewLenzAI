const ICON_PROPS = {
  width: 26,
  height: 26,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function ConnectIcon() {
  return (
    <svg {...ICON_PROPS}>
      <circle cx="7" cy="12" r="3.2" />
      <circle cx="17" cy="12" r="3.2" />
      <line x1="10.2" y1="12" x2="13.8" y2="12" />
    </svg>
  );
}

export function LockIcon() {
  return (
    <svg {...ICON_PROPS}>
      <rect x="5.5" y="11" width="13" height="9" rx="2.2" />
      <path d="M8 11V7.5a4 4 0 0 1 8 0V11" />
    </svg>
  );
}

export function UserIcon() {
  return (
    <svg {...ICON_PROPS}>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M4.5 20c0-4.1 3.4-7 7.5-7s7.5 2.9 7.5 7" />
    </svg>
  );
}

export function FolderIcon({ size = 20 }: { size?: number }) {
  return (
    <svg {...ICON_PROPS} width={size} height={size}>
      <path d="M4 7a2 2 0 0 1 2-2h3.5l2 2H18a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7Z" />
    </svg>
  );
}

export function ReviewCheckIcon({ size = 20 }: { size?: number }) {
  return (
    <svg {...ICON_PROPS} width={size} height={size}>
      <rect x="5" y="3.5" width="14" height="17" rx="2.2" />
      <path d="M9 3.5V3a1.6 1.6 0 0 1 1.6-1.6h2.8A1.6 1.6 0 0 1 15 3v.5" />
      <path d="m9 12.5 2 2 4-4.2" />
    </svg>
  );
}

export function FlagIcon({ size = 20 }: { size?: number }) {
  return (
    <svg {...ICON_PROPS} width={size} height={size}>
      <path d="M5 3v18" />
      <path d="M5 4h11l-2 4 2 4H5" />
    </svg>
  );
}

export function RepoIcon({ size = 18 }: { size?: number }) {
  return (
    <svg {...ICON_PROPS} width={size} height={size}>
      <path d="M6.5 4A2.5 2.5 0 0 0 4 6.5v11A2.5 2.5 0 0 0 6.5 20H19V4H6.5Z" />
      <path d="M4 17.5A2.5 2.5 0 0 1 6.5 15H19" />
    </svg>
  );
}

export function ChevronRightIcon({ size = 18 }: { size?: number }) {
  return (
    <svg {...ICON_PROPS} width={size} height={size}>
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

export function ChevronLeftIcon({ size = 16 }: { size?: number }) {
  return (
    <svg {...ICON_PROPS} width={size} height={size}>
      <path d="m15 6-6 6 6 6" />
    </svg>
  );
}

export function SendIcon({ size = 16 }: { size?: number }) {
  return (
    <svg {...ICON_PROPS} width={size} height={size}>
      <path d="M12 19V5" />
      <path d="m6 11 6-6 6 6" />
    </svg>
  );
}

export function PlusIcon({ size = 16 }: { size?: number }) {
  return (
    <svg {...ICON_PROPS} width={size} height={size}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

export function SparkleIcon({ size = 16 }: { size?: number }) {
  return (
    <svg {...ICON_PROPS} width={size} height={size}>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
      <path d="M12 8.5 13.3 11l2.5 1.3-2.5 1.3L12 16l-1.3-2.4L8.2 12.3l2.5-1.3L12 8.5Z" />
    </svg>
  );
}

export function CheckCircleIcon({ size = 40 }: { size?: number }) {
  return (
    <svg {...ICON_PROPS} width={size} height={size}>
      <circle cx="12" cy="12" r="9.5" />
      <path d="m8 12.5 2.5 2.5L16 9.5" />
    </svg>
  );
}

export function AlertCircleIcon({ size = 40 }: { size?: number }) {
  return (
    <svg {...ICON_PROPS} width={size} height={size}>
      <circle cx="12" cy="12" r="9.5" />
      <path d="M12 7.5v6" />
      <path d="M12 16.8v.1" />
    </svg>
  );
}
