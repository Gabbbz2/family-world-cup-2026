import React from "react";
import ReactCountryFlag from "react-country-flag";

export function Flag({ code, size = 22, className = "" }) {
  return (
    <ReactCountryFlag
      countryCode={code}
      svg
      style={{ width: size, height: size * 0.75, borderRadius: 2 }}
      className={className}
      aria-label={code}
    />
  );
}

export function FlagTeam({ team, size = 22, className = "", reverse = false }) {
  if (!team) return <span className="text-zinc-500">—</span>;
  return (
    <span
      className={`inline-flex items-center gap-2 ${reverse ? "flex-row-reverse" : ""} ${className}`}
      data-testid={`team-${team.id || team.team_name}`}
    >
      <Flag code={team.country_code} size={size} />
      <span className="font-semibold text-white truncate">{team.team_name}</span>
    </span>
  );
}
