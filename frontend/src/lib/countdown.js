// Countdown helper for prediction deadlines.
// Rules:
//  - if >3 days remain → return null (UI just shows the timestamp)
//  - if 1h+ remain → "Stänger om Hh Mmin" (e.g. "Stänger om 52 h 15 min")
//  - if <1h remain → "Stänger om 45 min"
//  - if past → "Tippning stängd"

import { useEffect, useState } from "react";

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;

export function formatCountdown(targetIso, { closedLabel = "Tippning stängd" } = {}) {
  if (!targetIso) return null;
  const target = new Date(targetIso).getTime();
  const now = Date.now();
  const diff = target - now;
  if (diff <= 0) return closedLabel;
  if (diff > THREE_DAYS_MS) return null;
  if (diff < ONE_HOUR_MS) {
    const mins = Math.max(1, Math.ceil(diff / 60000));
    return `Stänger om ${mins} min`;
  }
  const totalMin = Math.floor(diff / 60000);
  const hours = Math.floor(totalMin / 60);
  const minutes = totalMin % 60;
  return `Stänger om ${hours} h ${minutes} min`;
}

export function useCountdown(targetIso, { closedLabel = "Tippning stängd", tickMs = 30000 } = {}) {
  const [label, setLabel] = useState(() => formatCountdown(targetIso, { closedLabel }));
  useEffect(() => {
    setLabel(formatCountdown(targetIso, { closedLabel }));
    if (!targetIso) return undefined;
    const id = setInterval(() => {
      setLabel(formatCountdown(targetIso, { closedLabel }));
    }, tickMs);
    return () => clearInterval(id);
  }, [targetIso, closedLabel, tickMs]);
  return label;
}

export function isPast(iso) {
  if (!iso) return false;
  return new Date(iso).getTime() <= Date.now();
}
