export function parseDurationToSeconds(input: string | undefined | null, fallback: number): number {
  if (!input) return fallback;
  const match = /^(\d+)([smhd])?$/.exec(input.trim());
  if (!match) return fallback;
  const val = parseInt(match[1], 10);
  const unit = match[2] ?? 's';
  switch (unit) {
    case 's': return val;
    case 'm': return val * 60;
    case 'h': return val * 3600;
    case 'd': return val * 86400;
    default: return fallback;
  }
}
