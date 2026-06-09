import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { formatError } from "../lib/api";
import { SoccerBall } from "@phosphor-icons/react";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      await login(email.trim(), password);
      navigate("/dashboard");
    } catch (e) {
      setErr(formatError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#0A0A0A] text-white relative">
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "url(https://images.pexels.com/photos/35898730/pexels-photo-35898730.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940)",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[#0A0A0A]/40 via-[#0A0A0A]/80 to-[#0A0A0A]" />

      <div className="relative z-10 flex-1 flex flex-col justify-center max-w-md mx-auto w-full px-6 py-10">
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-10 h-10 grid place-items-center bg-[#00F0FF] text-black">
              <SoccerBall size={24} weight="fill" />
            </div>
            <div className="label-eyebrow">Familjens VM-tipsspel</div>
          </div>
          <h1 className="font-display font-black text-4xl sm:text-5xl tracking-tighter leading-[0.9]">
            World Cup<br />
            <span className="text-[#00F0FF]">2026.</span>
          </h1>
          <p className="text-zinc-400 mt-3 text-sm">
            Privat tipsspel för familj och vänner.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4 surface p-6">
          <div>
            <label className="label-eyebrow block mb-2">E-post</label>
            <input
              data-testid="login-email-input"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#0A0A0A] border border-white/10 px-3 py-2 text-white focus:border-[#00F0FF] outline-none"
              placeholder="du@exempel.se"
            />
          </div>
          <div>
            <label className="label-eyebrow block mb-2">Lösenord</label>
            <input
              data-testid="login-password-input"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#0A0A0A] border border-white/10 px-3 py-2 text-white focus:border-[#00F0FF] outline-none"
              placeholder="••••••••"
            />
          </div>
          {err && (
            <div data-testid="login-error" className="text-[#FF3B30] text-sm">{err}</div>
          )}
          <button
            type="submit"
            data-testid="login-submit-button"
            disabled={loading}
            className="w-full bg-[#00F0FF] text-black font-bold uppercase tracking-widest py-3 hover:bg-white transition-all disabled:opacity-50"
          >
            {loading ? "Loggar in…" : "Kicka igång"}
          </button>
          <div className="text-sm text-zinc-400 text-center pt-2">
            Ny här?{" "}
            <Link to="/register" data-testid="goto-register" className="text-[#00F0FF] hover:underline">
              Skapa konto
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
