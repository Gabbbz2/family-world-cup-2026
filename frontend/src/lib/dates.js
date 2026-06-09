// Swedish date/time helpers — all UI display uses Europe/Stockholm + sv-SE locale.
// Storage / API stay in UTC ISO strings.

const STHLM_TZ = "Europe/Stockholm";
const SV = "sv-SE";

function cap(s) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// "Torsdag 11 juni" (no year)
export function fmtSwedishDateLong(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat(SV, {
    timeZone: STHLM_TZ, weekday: "long", day: "numeric", month: "long",
  }).formatToParts(d);
  const wd = cap(parts.find((p) => p.type === "weekday")?.value || "");
  const day = parts.find((p) => p.type === "day")?.value || "";
  const month = parts.find((p) => p.type === "month")?.value || "";
  return `${wd} ${day} ${month}`;
}

// "Torsdag 11 juni 2026"
export function fmtSwedishDateLongWithYear(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat(SV, {
    timeZone: STHLM_TZ, weekday: "long", day: "numeric", month: "long", year: "numeric",
  }).formatToParts(d);
  const wd = cap(parts.find((p) => p.type === "weekday")?.value || "");
  const day = parts.find((p) => p.type === "day")?.value || "";
  const month = parts.find((p) => p.type === "month")?.value || "";
  const year = parts.find((p) => p.type === "year")?.value || "";
  return `${wd} ${day} ${month} ${year}`;
}

// "21:00"
export function fmtSwedishTime(iso) {
  if (!iso) return "";
  return new Intl.DateTimeFormat(SV, {
    timeZone: STHLM_TZ, hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(new Date(iso));
}

// "Torsdag 11 juni · 21:00"
export function fmtSwedishKickoff(iso) {
  if (!iso) return "";
  return `${fmtSwedishDateLong(iso)} · ${fmtSwedishTime(iso)}`;
}

// "Tor 11 jun 21:00"
export function fmtSwedishShort(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat(SV, {
    timeZone: STHLM_TZ, weekday: "short", day: "numeric", month: "short",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(d);
  const wd = cap((parts.find((p) => p.type === "weekday")?.value || "").replace(".", ""));
  const day = parts.find((p) => p.type === "day")?.value || "";
  const month = (parts.find((p) => p.type === "month")?.value || "").replace(".", "");
  const hour = parts.find((p) => p.type === "hour")?.value || "";
  const minute = parts.find((p) => p.type === "minute")?.value || "";
  return `${wd} ${day} ${month} ${hour}:${minute}`;
}

// Convert UTC ISO -> "YYYY-MM-DDTHH:MM" string that displays as Swedish local
// for use inside <input type="datetime-local">.
export function utcIsoToSwedishLocalInput(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat(SV, {
    timeZone: STHLM_TZ, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(d).reduce((a, p) => ((a[p.type] = p.value), a), {});
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

// User typed Swedish local time in datetime-local input -> UTC ISO for backend.
export function swedishLocalInputToUtcIso(value) {
  if (!value) return null;
  // Treat the bare local string as if it were UTC, then ask Intl what
  // Europe/Stockholm would show for that instant; the difference is the offset.
  const fake = new Date(`${value}:00Z`);
  const partsArr = new Intl.DateTimeFormat(SV, {
    timeZone: STHLM_TZ, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(fake);
  const p = partsArr.reduce((a, x) => ((a[x.type] = x.value), a), {});
  const swedishView = new Date(
    `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`
  );
  const offsetMs = swedishView.getTime() - fake.getTime();
  return new Date(fake.getTime() - offsetMs).toISOString();
}

// "11/6 2026, 21:00" – compact Swedish format
export function fmtSwedishCompact(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return new Intl.DateTimeFormat(SV, {
    timeZone: STHLM_TZ, year: "numeric", month: "numeric", day: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(d);
}
