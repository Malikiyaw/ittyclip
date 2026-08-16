"use client";

import { useCallback, useEffect, useState } from "react";
import { getAiKey, setAiKey, clearAiKey, getAiBaseUrl, setAiBaseUrl, clearAiBaseUrl } from "@/lib/ai/settings";

export function AiSettingsPanel() {
  const [key, setKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [saved, setSaved] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [envConfigured, setEnvConfigured] = useState(false);
  const [checked, setChecked] = useState(false);

  const refreshStatus = useCallback(() => {
    setKey(getAiKey());
    setBaseUrl(getAiBaseUrl());
    fetch("/api/ai/status", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { configured?: boolean } | null) => {
        setEnvConfigured(Boolean(data?.configured));
        setChecked(true);
      })
      .catch(() => {
        setEnvConfigured(false);
        setChecked(true);
      });
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  const ready = Boolean(key) || envConfigured;

  const save = () => {
    setAiKey(key);
    setAiBaseUrl(baseUrl);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  const clear = () => {
    clearAiKey();
    clearAiBaseUrl();
    setKey("");
    setBaseUrl("");
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="s-label">AI engine</p>
          <p className="mt-1 text-[10px] text-white/40">Free NVIDIA key · works on any deployment</p>
        </div>
        {checked ? (
          <span
            className={`rounded-full px-2.5 py-1 font-mono text-[9px] font-semibold ${
              ready ? "bg-emerald-300/15 text-emerald-200" : "bg-amber-300/15 text-amber-200"
            }`}
          >
            {ready ? "● READY" : "● NOT CONFIGURED"}
          </span>
        ) : (
          <span className="rounded-full bg-white/10 px-2.5 py-1 font-mono text-[9px] text-white/50">CHECKING…</span>
        )}
      </div>

      <div className="mt-3 flex flex-col gap-2">
        <input
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="Paste your NVIDIA API key (nvapi-…)"
          spellCheck={false}
          autoComplete="off"
          className="w-full rounded-xl border border-white/15 bg-black/25 px-3 py-2 font-mono text-[10px] text-white placeholder-white/30 outline-none focus:border-white/50"
        />
        <div className="flex items-center gap-2">
          <button
            onClick={save}
            className="flex-1 rounded-xl bg-white px-3 py-2 text-[10px] font-semibold text-black transition-colors hover:bg-white/85"
          >
            {saved ? "Saved to this device" : "Save key"}
          </button>
          {(key || baseUrl) && (
            <button
              onClick={clear}
              className="rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2 text-[10px] text-white/70 transition-colors hover:border-white/40"
            >
              Clear
            </button>
          )}
        </div>
        <p className="text-[9px] leading-relaxed text-white/40">
          No key? Get a free one at{" "}
          <a
            href="https://build.nvidia.com"
            target="_blank"
            rel="noreferrer"
            className="text-cyan-300/90 underline decoration-cyan-300/40 underline-offset-2 hover:text-cyan-200"
          >
            build.nvidia.com
          </a>
          . It is stored only in this browser and sent to your own /api/ai routes — never to the repo.
        </p>
        {envConfigured && (
          <p className="rounded-lg border border-emerald-300/15 bg-emerald-300/5 px-2 py-1.5 text-[9px] text-emerald-200/80">
            This deployment has NVIDIA_API_KEY set in its environment — no key needed here.
          </p>
        )}
        <button
          onClick={() => setShowAdvanced((v) => !v)}
          className="self-start font-mono text-[9px] text-white/35 underline decoration-white/20 underline-offset-2 hover:text-white/60"
        >
          {showAdvanced ? "−" : "+"} advanced: custom endpoint
        </button>
        {showAdvanced && (
          <input
            type="text"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="OpenAI-compatible base URL (default: NVIDIA)"
            spellCheck={false}
            autoComplete="off"
            className="w-full rounded-xl border border-white/15 bg-black/25 px-3 py-2 font-mono text-[10px] text-white placeholder-white/30 outline-none focus:border-white/50"
          />
        )}
      </div>
    </div>
  );
}
