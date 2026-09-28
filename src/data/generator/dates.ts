// Dates are handled as integer day numbers (days since 1970-01-01, UTC) and
// only turned into ISO strings on output.

const MS_PER_DAY = 86_400_000;

export type Day = number;

export function day(iso: string): Day {
  return Math.round(Date.parse(iso + 'T00:00:00Z') / MS_PER_DAY);
}

export function iso(d: Day): string {
  return new Date(d * MS_PER_DAY).toISOString().slice(0, 10);
}

export function isoTimestamp(d: Day, minutesIntoDay: number): string {
  return new Date(d * MS_PER_DAY + minutesIntoDay * 60_000).toISOString().slice(0, 19).replace('T', ' ');
}

export function monthOf(d: Day): number {
  return new Date(d * MS_PER_DAY).getUTCMonth() + 1;
}

export function yearOf(d: Day): number {
  return new Date(d * MS_PER_DAY).getUTCFullYear();
}

export function dayOfWeek(d: Day): number {
  return new Date(d * MS_PER_DAY).getUTCDay();
}

export function addYears(d: Day, years: number): Day {
  const dt = new Date(d * MS_PER_DAY);
  dt.setUTCFullYear(dt.getUTCFullYear() + years);
  return Math.round(dt.getTime() / MS_PER_DAY);
}
