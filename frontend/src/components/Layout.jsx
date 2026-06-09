import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  House,
  SoccerBall,
  Trophy,
  Strategy,
  GearSix,
  SignOut,
} from "@phosphor-icons/react";

const NavItem = ({ to, icon: Icon, label, testid }) => (
  <NavLink
    to={to}
    data-testid={testid}
    className={({ isActive }) =>
      `flex flex-col items-center justify-center gap-1 px-2 py-2 text-[10px] tracking-wider uppercase font-bold transition-all ${
        isActive
          ? "text-[#00F0FF]"
          : "text-zinc-500 hover:text-white"
      }`
    }
  >
    {({ isActive }) => (
      <>
        <Icon size={22} weight={isActive ? "fill" : "regular"} />
        <span>{label}</span>
      </>
    )}
  </NavLink>
);

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white pb-20">
      {/* Top bar */}
      <header className="sticky top-0 z-30 bg-[#0A0A0A]/90 backdrop-blur border-b border-white/10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <NavLink to="/" className="flex items-center gap-2" data-testid="brand-link">
            <div className="w-8 h-8 grid place-items-center bg-[#00F0FF] text-black rounded-sm">
              <SoccerBall size={20} weight="fill" />
            </div>
            <div>
              <div className="label-eyebrow">FAMILY • FIFA</div>
              <div className="font-display font-black text-base leading-none">World Cup 2026</div>
            </div>
          </NavLink>
          <div className="flex items-center gap-3">
            {user && user.role === "admin" && (
              <span className="text-[10px] uppercase tracking-widest font-bold bg-[#39FF14] text-black px-2 py-1 rounded-sm">Admin</span>
            )}
            <button
              data-testid="logout-button"
              onClick={async () => { await logout(); navigate("/login"); }}
              className="text-zinc-400 hover:text-white"
              title="Logout"
            >
              <SignOut size={22} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">{children}</main>

      {/* Bottom nav (mobile-first) */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-[#0A0A0A]/95 backdrop-blur border-t border-white/10">
        <div className="max-w-5xl mx-auto grid grid-cols-5">
          <NavItem to="/dashboard" icon={House} label="Home" testid="nav-dashboard" />
          <NavItem to="/matches" icon={SoccerBall} label="Matches" testid="nav-matches" />
          <NavItem to="/leaderboard" icon={Trophy} label="Board" testid="nav-leaderboard" />
          <NavItem to="/tournament" icon={Strategy} label="Predict" testid="nav-tournament" />
          {user && user.role === "admin" ? (
            <NavItem to="/admin" icon={GearSix} label="Admin" testid="nav-admin" />
          ) : (
            <div className="flex flex-col items-center justify-center text-zinc-700 text-[10px] font-bold uppercase">—</div>
          )}
        </div>
      </nav>
    </div>
  );
}
