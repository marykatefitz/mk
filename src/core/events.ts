// Seasonal events.

/** RV Show Weekend: the first Friday–Sunday of every month (real calendar). */
export function isRvShowWeekend(d: Date): boolean {
  const day = d.getDate();
  const dow = d.getDay(); // 0 Sun … 6 Sat
  if (![0, 5, 6].includes(dow)) return false;
  // find the first Friday of the month
  const first = new Date(d.getFullYear(), d.getMonth(), 1).getDay();
  const firstFriday = 1 + ((5 - first + 7) % 7);
  return day >= firstFriday && day <= firstFriday + 2;
}

export const RV_SHOW_COIN_MULTIPLIER = 2;
