const AVATAR_PALETTE = ["#7c3aed", "#db2777", "#2563eb", "#ea580c", "#0891b2", "#059669"];

export function avatarColor(seed: string): string {
  return AVATAR_PALETTE[seed.charCodeAt(0) % AVATAR_PALETTE.length];
}

export function avatarInitials(seed: string): string {
  return seed.slice(0, 2).toUpperCase();
}
