import React, { useEffect, useState } from "react";

const VERSION_STORAGE_KEY = "vm2026_app_version";

export default function UpdateNotice() {
  const [hasUpdate, setHasUpdate] = useState(false);

  useEffect(() => {
    const checkVersion = async () => {
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`, {
          cache: "no-store",
        });

        const data = await res.json();
        if (!data.version) return;

        const savedVersion = localStorage.getItem(VERSION_STORAGE_KEY);

        if (!savedVersion) {
          localStorage.setItem(VERSION_STORAGE_KEY, data.version);
          return;
        }

        if (savedVersion !== data.version) {
          setHasUpdate(true);
        }
      } catch (err) {
        console.warn("Could not check app version", err);
      }
    };

    checkVersion();
    const interval = setInterval(checkVersion, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  const updatePage = async () => {
    try {
      const res = await fetch(`/version.json?t=${Date.now()}`, {
        cache: "no-store",
      });
      const data = await res.json();

      if (data.version) {
        localStorage.setItem(VERSION_STORAGE_KEY, data.version);
      }
    } catch (err) {
      console.warn("Could not update stored version", err);
    }

    window.location.reload();
  };

  if (!hasUpdate) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: "72px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9999,
        background: "#00e5ff",
        color: "#000",
        padding: "12px 18px",
        borderRadius: "8px",
        fontWeight: "bold",
        boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
        maxWidth: "90vw",
        textAlign: "center",
      }}
    >
      Ny version finns.
      <button
        onClick={updatePage}
        style={{
          marginLeft: "12px",
          background: "#000",
          color: "#fff",
          border: "none",
          padding: "6px 10px",
          cursor: "pointer",
          borderRadius: "4px",
        }}
      >
        Uppdatera
      </button>
    </div>
  );
}