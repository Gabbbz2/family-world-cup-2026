import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { formatError } from "../lib/api";
import { SoccerBall } from "@phosphor-icons/react";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      await register(name.trim(), email.trim(), password);
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
        className="absolute inset-0 opacity-25"
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
            <div className="w-10 h-10 grid place-items-center bg-[#39FF14] text-black">
              <SoccerBall size={24} weight="fill" />
            </div>
            <div className="label-eyebrow">Endast inbjudna kan registrera sig</div>
          </div>
          <h1 className="font-display font-black text-4xl sm:text-5xl tracking-tighter leading-[0.9]">
            Gå med i<br /><span className="text-[#39FF14]">familjen.</span>
          </h1>
          <p className="text-zinc-400 mt-3 text-sm">
            Din e-post måste finnas på inbjudningslistan.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4 surface p-6">
          <div>
            <label className="label-eyebrow block mb-2">Fullständigt namn</label>
            <input
              data-testid="register-name-input"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[#0A0A0A] border border-white/10 px-3 py-2 focus:border-[#00F0FF] outline-none"
              placeholder="Maria Bengtsson"
            />
          </div>
          <div>
            <label className="label-eyebrow block mb-2">E-post</label>
            <input
              data-testid="register-email-input"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#0A0A0A] border border-white/10 px-3 py-2 focus:border-[#00F0FF] outline-none"
              placeholder="du@exempel.se"
            />
          </div>
          <div>
            <label className="label-eyebrow block mb-2">Lösenord</label>
            <input
              data-testid="register-password-input"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#0A0A0A] border border-white/10 px-3 py-2 focus:border-[#00F0FF] outline-none"
              placeholder="Minst 6 tecken"
            />
          </div>
          {err && <div data-testid="register-error" className="text-[#FF3B30] text-sm">{err}</div>}
          <button
            data-testid="register-submit-button"
            type="submit"
            disabled={loading}
            className="w-full bg-[#39FF14] text-black font-bold uppercase tracking-widest py-3 hover:bg-white transition-all disabled:opacity-50"
          >
            {loading ? "Skapar…" : "Skapa konto"}
          </button>
          <div className="text-sm text-zinc-400 text-center pt-2">
            Har du redan ett konto?{" "}
            <Link to="/login" data-testid="goto-login" className="text-[#00F0FF] hover:underline">Logga in</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
