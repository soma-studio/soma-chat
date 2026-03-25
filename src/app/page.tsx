"use client";

import { useState, useRef, useCallback } from "react";

type AppState = "idle" | "running" | "complete";

interface TerminalLine {
  text: string;
  color?: string;
}

interface CompleteData {
  siteId: string;
  pagesIndexed: number;
  chunksIndexed: number;
  elapsedMs: number;
}

export default function Home() {
  const [state, setState] = useState<AppState>("idle");
  const [url, setUrl] = useState("");
  const [lines, setLines] = useState<TerminalLine[]>([]);
  const [completeData, setCompleteData] = useState<CompleteData | null>(null);
  const [copied, setCopied] = useState(false);
  const terminalRef = useRef<HTMLDivElement>(null);

  const addLine = useCallback((text: string, color?: string) => {
    setLines((prev) => [...prev, { text, color }]);
    // Auto-scroll
    setTimeout(() => {
      if (terminalRef.current) {
        terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
      }
    }, 10);
  }, []);

  const updateLastLine = useCallback((text: string, color?: string) => {
    setLines((prev) => {
      if (prev.length === 0) return [{ text, color }];
      const updated = [...prev];
      updated[updated.length - 1] = { text, color };
      return updated;
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || state === "running") return;

    setState("running");
    setLines([]);
    setCompleteData(null);
    addLine(`$ soma-chat pipeline --url ${url}`, "#8b8b9e");
    addLine("");

    try {
      const res = await fetch("/api/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });

      if (!res.ok) {
        const err = await res.json();
        addLine(`Erreur: ${err.error || res.statusText}`, "#ef4444");
        setState("idle");
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        addLine("Erreur: pas de stream", "#ef4444");
        setState("idle");
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";

        for (const part of parts) {
          const line = part.replace(/^data: /, "").trim();
          if (!line) continue;

          try {
            const event = JSON.parse(line);
            handleEvent(event);
          } catch {
            // skip malformed
          }
        }
      }
    } catch (err) {
      addLine(`Erreur: ${err instanceof Error ? err.message : String(err)}`, "#ef4444");
      setState("idle");
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleEvent = (event: any) => {
    switch (event.type) {
      case "start":
        addLine(`Scraping ${event.url}...`, "#3b82f6");
        addLine("");
        break;

      case "page":
        addLine(
          `  [${event.current}/${event.maxPages}] ${event.title?.substring(0, 50) || "Sans titre"} (${event.chars} chars)`,
          "#f0f0f3"
        );
        break;

      case "limit":
        addLine("");
        addLine(`  ${event.message}`, "#f59e0b");
        break;

      case "chunking":
        addLine("");
        addLine(
          `Chunking: ${event.documents} documents -> ${event.totalChunks} chunks`,
          "#3b82f6"
        );
        break;

      case "indexing":
        if (event.percent <= 5) {
          addLine(`Indexing: ${event.percent}% (${event.indexed}/${event.total})`, "#3b82f6");
        } else {
          updateLastLine(
            `Indexing: ${event.percent}% (${event.indexed}/${event.total})`,
            "#3b82f6"
          );
        }
        break;

      case "complete":
        addLine("");
        addLine(
          `Pipeline terminé en ${(event.elapsedMs / 1000).toFixed(1)}s`,
          "#10b981"
        );
        addLine(
          `  ${event.pagesIndexed} pages, ${event.chunksIndexed} chunks indexés`,
          "#10b981"
        );
        setCompleteData({
          siteId: event.siteId,
          pagesIndexed: event.pagesIndexed,
          chunksIndexed: event.chunksIndexed,
          elapsedMs: event.elapsedMs,
        });
        setState("complete");
        break;

      case "error":
        addLine(`Erreur: ${event.message}`, "#ef4444");
        setState("idle");
        break;
    }
  };

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const snippet = completeData
    ? `<script src="${siteUrl}/widget.js" data-site-id="${completeData.siteId}"><\/script>`
    : "";

  const handleCopy = () => {
    navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 py-24 text-center">
        <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">
          SOMA{" "}
          <span className="bg-gradient-to-r from-blue-500 to-indigo-500 bg-clip-text text-transparent">
            Chat
          </span>
        </h1>
        <p className="mt-4 max-w-lg text-lg text-[#8b8b9e]">
          Un assistant IA pour votre site, en 5 minutes.
        </p>

        {/* URL Form */}
        <form onSubmit={handleSubmit} className="mt-10 flex w-full max-w-md gap-3">
          <input
            type="url"
            placeholder="https://votre-site.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={state === "running"}
            className="flex-1 rounded-lg border border-[#2a2a34] bg-[#111118] px-4 py-3 text-sm text-[#f0f0f3] placeholder-[#55556a] outline-none focus:border-blue-500 transition-colors disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={state === "running" || !url.trim()}
            className="rounded-lg bg-blue-600 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {state === "running" ? "En cours..." : "Créer"}
          </button>
        </form>

        {state === "idle" && !completeData && (
          <p className="mt-3 text-xs text-[#55556a]">
            10 pages max (free tier) &mdash; Aucune carte requise.
          </p>
        )}
      </section>

      {/* Terminal */}
      {(state === "running" || state === "complete") && (
        <section className="px-6 pb-12">
          <div className="mx-auto max-w-2xl">
            {/* Terminal window */}
            <div className="rounded-xl border border-[#1f1f28] bg-[#0a0a0f] overflow-hidden">
              {/* Title bar */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-[#1f1f28]">
                <div className="w-3 h-3 rounded-full bg-[#ef4444]" />
                <div className="w-3 h-3 rounded-full bg-[#f59e0b]" />
                <div className="w-3 h-3 rounded-full bg-[#10b981]" />
                <span className="ml-2 text-xs text-[#55556a]">soma-chat pipeline</span>
              </div>
              {/* Terminal content */}
              <div
                ref={terminalRef}
                className="p-4 font-mono text-sm leading-6 max-h-80 overflow-y-auto"
              >
                {lines.map((line, i) => (
                  <div key={i} style={{ color: line.color || "#f0f0f3" }}>
                    {line.text || "\u00A0"}
                  </div>
                ))}
                {state === "running" && (
                  <span className="inline-block w-2 h-4 bg-blue-500 animate-pulse" />
                )}
              </div>
            </div>

            {/* Success card */}
            {state === "complete" && completeData && (
              <div className="mt-6 rounded-xl border border-[#1f1f28] bg-[#111118] p-6">
                <h3 className="text-lg font-semibold text-[#10b981] mb-3">
                  Votre chatbot est prêt !
                </h3>
                <p className="text-sm text-[#8b8b9e] mb-4">
                  Collez ce snippet dans votre HTML, juste avant{" "}
                  <code className="text-[#f0f0f3] bg-[#1a1a24] px-1.5 py-0.5 rounded text-xs">
                    &lt;/body&gt;
                  </code>
                </p>

                {/* Snippet */}
                <div className="relative">
                  <pre className="rounded-lg bg-[#0a0a0f] border border-[#1f1f28] p-4 text-sm text-[#f0f0f3] font-mono overflow-x-auto">
                    {snippet}
                  </pre>
                  <button
                    onClick={handleCopy}
                    className="absolute top-2 right-2 rounded-md bg-[#1a1a24] border border-[#2a2a34] px-3 py-1.5 text-xs text-[#8b8b9e] hover:text-[#f0f0f3] transition-colors"
                  >
                    {copied ? "Copié !" : "Copier"}
                  </button>
                </div>

                {/* Stats */}
                <div className="mt-4 flex gap-6 text-xs text-[#55556a]">
                  <span>{completeData.pagesIndexed} pages</span>
                  <span>{completeData.chunksIndexed} chunks</span>
                  <span>{(completeData.elapsedMs / 1000).toFixed(1)}s</span>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* How it works */}
      {state === "idle" && !completeData && (
        <section className="border-t border-[#1f1f28] px-6 py-20">
          <h2 className="text-center text-2xl font-semibold mb-12">
            Comment ça marche
          </h2>
          <div className="mx-auto grid max-w-3xl gap-8 sm:grid-cols-3">
            {[
              {
                step: "1",
                title: "Entrez votre URL",
                desc: "On prend l\u2019URL de votre site et on crawle toutes les pages publiques.",
              },
              {
                step: "2",
                title: "On indexe votre contenu",
                desc: "Le contenu est découpé en chunks, transformé en vecteurs et stocké dans Qdrant.",
              },
              {
                step: "3",
                title: "Collez le script",
                desc: "Un simple <script> à ajouter dans votre HTML. Le chatbot apparaît en bas à droite.",
              },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-blue-600/20 text-blue-400 font-bold text-lg">
                  {item.step}
                </div>
                <h3 className="font-medium mb-2">{item.title}</h3>
                <p className="text-sm text-[#8b8b9e]">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="border-t border-[#1f1f28] px-6 py-8 text-center text-sm text-[#55556a]">
        Open source &middot; SOMA Studio &middot;{" "}
        <a
          href="https://somastudio.xyz"
          className="text-[#8b8b9e] hover:text-[#f0f0f3] transition-colors"
          target="_blank"
          rel="noopener noreferrer"
        >
          somastudio.xyz
        </a>
      </footer>
    </div>
  );
}
