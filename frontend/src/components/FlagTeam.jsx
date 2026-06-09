import React from "react";
import ReactCountryFlag from "react-country-flag";

// Map non-ISO codes (GB-ENG, GB-SCT, GB-WLS) to GB for fallback flag rendering
function normalizeCode(code) {
  if (!code) return null;
  const upper = code.toUpperCase();
  if (upper === "GB-ENG" || upper === "GB-SCT" || upper === "GB-WLS") return "GB";
  return upper;
}

export function Flag({ code, size = 22, className = "" }) {
  const norm = normalizeCode(code);
  if (!norm) return <span className={`inline-block ${className}`} style={{ width: size, height: size * 0.75 }} />;
  return (
    <ReactCountryFlag
      countryCode={norm}
      svg
      style={{ width: size, height: size * 0.75, borderRadius: 2 }}
      className={className}
      aria-label={code}
    />
  );
}

export function FlagTeam({ team, size = 22, className = "", reverse = false, placeholder = null, dim = false }) {
  if (!team && placeholder) {
    return (
      <span
        className={`inline-flex items-center gap-2 ${reverse ? "flex-row-reverse" : ""} ${className}`}
        data-testid={`placeholder-${placeholder}`}
      >
        <span className="inline-block w-[22px] h-[16px] border border-dashed border-zinc-600 rounded-sm" style={{ width: size, height: size * 0.75 }} />
        <span className={`font-mono text-xs uppercase tracking-widest ${dim ? "text-zinc-600" : "text-zinc-400"}`}>{placeholder}</span>
      </span>
    );
  }
  if (!team) return <span className="text-zinc-500">—</span>;
  return (
    <span
      className={`inline-flex items-center gap-2 ${reverse ? "flex-row-reverse" : ""} ${className}`}
      data-testid={`team-${team.id || team.team_name}`}
    >
      <Flag code={team.country_code} size={size} />
      <span className={`font-semibold truncate ${dim ? "text-zinc-500 line-through" : "text-white"}`}>{team.team_name}</span>
      {team.disqualified && <span className="text-[9px] uppercase tracking-widest bg-[#FF3B30] text-white px-1 ml-1">DQ</span>}
    </span>
  );
}
