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

export function SearchIcon({ size = 16 }: { size?: number }) {
  return (
    <svg {...ICON_PROPS} width={size} height={size}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4.3-4.3" />
    </svg>
  );
}

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

export function SettingsIcon({ size = 16 }: { size?: number }) {
  return (
    <svg {...ICON_PROPS} width={size} height={size}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19.4 13.5c.08-.49.08-.99 0-1.48l1.63-1.27a.5.5 0 0 0 .12-.64l-1.55-2.68a.5.5 0 0 0-.6-.22l-1.9.76a7.3 7.3 0 0 0-1.28-.74l-.29-2.02a.5.5 0 0 0-.5-.42h-3.1a.5.5 0 0 0-.5.42l-.29 2.02c-.46.19-.89.44-1.28.74l-1.9-.76a.5.5 0 0 0-.6.22L5.25 10.1a.5.5 0 0 0 .12.64l1.63 1.27c-.08.49-.08.99 0 1.48l-1.63 1.27a.5.5 0 0 0-.12.64l1.55 2.68a.5.5 0 0 0 .6.22l1.9-.76c.39.3.82.55 1.28.74l.29 2.02a.5.5 0 0 0 .5.42h3.1a.5.5 0 0 0 .5-.42l.29-2.02c.46-.19.89-.44 1.28-.74l1.9.76a.5.5 0 0 0 .6-.22l1.55-2.68a.5.5 0 0 0-.12-.64Z" />
    </svg>
  );
}

export function HelpIcon({ size = 16 }: { size?: number }) {
  return (
    <svg {...ICON_PROPS} width={size} height={size}>
      <circle cx="12" cy="12" r="9.5" />
      <path d="M9.5 9.3a2.5 2.5 0 1 1 3.9 2.07c-.6.42-1.4.98-1.4 1.93" />
      <path d="M12 17v.1" />
    </svg>
  );
}

export function LogOutIcon({ size = 16 }: { size?: number }) {
  return (
    <svg {...ICON_PROPS} width={size} height={size}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}

export function ChevronDownIcon({ size = 14 }: { size?: number }) {
  return (
    <svg {...ICON_PROPS} width={size} height={size}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function RestoreIcon({ size = 16 }: { size?: number }) {
  return (
    <svg {...ICON_PROPS} width={size} height={size}>
      <path d="M3 11a9 9 0 1 1 2.6 6.4" />
      <path d="M3 5v6h6" />
    </svg>
  );
}

export function TrashIcon({ size = 16 }: { size?: number }) {
  return (
    <svg {...ICON_PROPS} width={size} height={size}>
      <path d="M5 7h14" />
      <path d="M10 3.5h4a1 1 0 0 1 1 1V7H9V4.5a1 1 0 0 1 1-1Z" />
      <path d="M7 7l1 12.5a1.5 1.5 0 0 0 1.5 1.5h5a1.5 1.5 0 0 0 1.5-1.5L17 7" />
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

export function SunIcon({ size = 20 }: { size?: number }) {
  return (
    <svg {...ICON_PROPS} width={size} height={size}>
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.5v3M12 18.5v3M4.5 4.5l2.1 2.1M17.4 17.4l2.1 2.1M2.5 12h3M18.5 12h3M4.5 19.5l2.1-2.1M17.4 6.6l2.1-2.1" />
    </svg>
  );
}

export function MoonIcon({ size = 20 }: { size?: number }) {
  return (
    <svg {...ICON_PROPS} width={size} height={size}>
      <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z" />
    </svg>
  );
}
