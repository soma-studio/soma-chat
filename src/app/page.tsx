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
    addLine(`\u276F npx pipeline --url ${url}`, "#8b8b9e");
    addLine("");

    try {
      const res = await fetch("/api/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });

      if (!res.ok) {
        const err = await res.json();
        addLine(`Erreur: ${err.error || res.statusText}`, "#f85149");
        setState("idle");
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        addLine("Erreur: pas de stream", "#f85149");
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
      addLine(`Erreur: ${err instanceof Error ? err.message : String(err)}`, "#f85149");
      setState("idle");
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleEvent = (event: any) => {
    switch (event.type) {
      case "start":
        addLine(`Scraping ${event.url}...`, "#a0a0b0");
        addLine("");
        break;

      case "page":
        addLine(
          `[${event.current}/${event.maxPages}] ${event.title?.substring(0, 50) || "Sans titre"} (${event.chars} chars)`,
          "#a0a0b0"
        );
        break;

      case "limit":
        addLine("");
        addLine(`${event.message}`, "#e5a820");
        break;

      case "chunking":
        addLine("");
        addLine(
          `Chunking: ${event.documents} documents -> ${event.totalChunks} chunks`,
          "#a0a0b0"
        );
        break;

      case "indexing":
        if (event.percent <= 5) {
          addLine(`Indexing: ${event.percent}% (${event.indexed}/${event.total})`, "#a0a0b0");
        } else {
          updateLastLine(
            `Indexing: ${event.percent}% (${event.indexed}/${event.total})`,
            "#a0a0b0"
          );
        }
        break;

      case "complete":
        addLine("");
        addLine(
          `Pipeline terminé en ${(event.elapsedMs / 1000).toFixed(1)}s`,
          "#3fb950"
        );
        addLine(
          `${event.pagesIndexed} pages, ${event.chunksIndexed} chunks indexés`,
          "#3fb950"
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
        addLine(`Erreur: ${event.message}`, "#f85149");
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

  const handleReset = () => {
    setState("idle");
    setLines([]);
    setCompleteData(null);
    setUrl("");
    setCopied(false);
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

      {/* Terminal + Preview + Snippet */}
      {(state === "running" || state === "complete") && (
        <section className="px-6 pb-12">
          <div className="mx-auto max-w-2xl">
            {/* Terminal window */}
            <div className="rounded-lg border border-[#1f1f28] bg-[#0a0a0f] overflow-hidden">
              {/* VSCode-style tab bar */}
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#1f1f28] bg-[#0d0d14]">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-wider text-[#55556a]">Terminal</span>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-[#55556a]">
                  <span>soma-chat</span>
                  <span className="text-[#2a2a34]">|</span>
                  <span>node</span>
                </div>
              </div>
              {/* Terminal content */}
              <div
                ref={terminalRef}
                className="p-4 font-mono text-xs leading-5 max-h-72 overflow-y-auto"
              >
                {lines.map((line, i) => (
                  <div key={i} style={{ color: line.color || "#f0f0f3" }}>
                    {line.text || "\u00A0"}
                  </div>
                ))}
                {state === "running" && (
                  <span className="inline-block w-[2px] h-3.5 bg-[#a0a0b0] animate-pulse" />
                )}
              </div>
            </div>

            {/* Live Preview */}
            {state === "complete" && completeData && (
              <div className="mt-6">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs uppercase tracking-wider text-[#55556a]">
                    Aperçu
                  </p>
                  <p className="text-[10px] text-[#3f3f4a]">
                    Les données de votre site sont utilisées en temps réel
                  </p>
                </div>
                <div
                  className="rounded-lg border border-[#1f1f28] bg-[#0a0a0f] overflow-hidden"
                  style={{ height: "480px" }}
                >
                  <iframe
                    className="w-full h-full border-0"
                    srcDoc={`<!DOCTYPE html>
<html>
<head>
<style>
  body { margin: 0; background: #0a0a0f; height: 100vh; overflow: hidden; }
</style>
</head>
<body>
<script>window.SOMA_CHAT_AUTO_OPEN = true;<\/script>
<script src="${siteUrl}/widget.js" data-site-id="${completeData.siteId}"><\/script>
</body>
</html>`}
                    title="Aperçu du chatbot"
                  />
                </div>
              </div>
            )}

            {/* Stripe-style snippet card */}
            {state === "complete" && completeData && (
              <div className="mt-6 rounded-xl border border-[#1f1f28] bg-[#111118] overflow-hidden">
                {/* Header bar */}
                <div className="flex items-center justify-between px-5 py-3 bg-[#0d0d14] border-b border-[#1f1f28]">
                  <div className="flex items-center gap-2.5">
                    <span className="inline-block w-2 h-2 rounded-full bg-[#3fb950]" />
                    <span className="text-sm font-medium text-[#f0f0f3]">Votre chatbot est prêt</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-[#1a1a24] px-2.5 py-0.5 text-[10px] text-[#8b8b9e]">
                      {completeData.pagesIndexed} pages
                    </span>
                    <span className="rounded-full bg-[#1a1a24] px-2.5 py-0.5 text-[10px] text-[#8b8b9e]">
                      {completeData.chunksIndexed} chunks
                    </span>
                    <span className="rounded-full bg-[#1a1a24] px-2.5 py-0.5 text-[10px] text-[#8b8b9e]">
                      {(completeData.elapsedMs / 1000).toFixed(1)}s
                    </span>
                  </div>
                </div>

                {/* Instruction */}
                <div className="px-5 py-4 border-b border-[#1f1f28]">
                  <p className="text-sm text-[#8b8b9e]">
                    Collez ce snippet dans votre HTML, juste avant{" "}
                    <code className="text-[#f0f0f3] bg-[#1a1a24] px-1.5 py-0.5 rounded text-xs">
                      &lt;/body&gt;
                    </code>
                  </p>
                </div>

                {/* Code block */}
                <div className="relative">
                  {/* Tab bar */}
                  <div className="flex items-center px-4 py-1.5 bg-[#0d0d14] border-b border-[#1f1f28]">
                    <span className="text-[10px] uppercase tracking-wider text-[#8b8b9e] border-b border-blue-500 pb-1.5">
                      HTML
                    </span>
                  </div>

                  {/* Code with line numbers */}
                  <div className="flex overflow-x-auto bg-[#0a0a0f] p-4">
                    {/* Line numbers */}
                    <div className="flex flex-col w-8 shrink-0 select-none text-right pr-4 font-mono text-xs leading-5 text-[#3f3f4a]">
                      <span>1</span>
                      <span>2</span>
                      <span>3</span>
                    </div>

                    {/* Syntax-highlighted code */}
                    <pre className="font-mono text-xs leading-5 whitespace-pre">
                      <span style={{ color: "#f85149" }}>&lt;script</span>
                      {"\n"}
                      <span>{"  "}</span>
                      <span style={{ color: "#d2a8ff" }}>src</span>
                      <span style={{ color: "#f0f0f3" }}>=</span>
                      <span style={{ color: "#a5d6ff" }}>&quot;{siteUrl}/widget.js&quot;</span>
                      {" "}
                      <span style={{ color: "#d2a8ff" }}>data-site-id</span>
                      <span style={{ color: "#f0f0f3" }}>=</span>
                      <span style={{ color: "#a5d6ff" }}>&quot;{completeData.siteId}&quot;</span>
                      {"\n"}
                      <span style={{ color: "#f85149" }}>&gt;&lt;/script&gt;</span>
                    </pre>
                  </div>

                  {/* Copy button */}
                  <button
                    onClick={handleCopy}
                    className="absolute top-10 right-3 rounded-md bg-[#1a1a24] border border-[#2a2a34] px-3 py-1.5 text-xs text-[#8b8b9e] hover:text-[#f0f0f3] transition-colors"
                  >
                    {copied ? "Copié !" : "Copier"}
                  </button>
                </div>

                {/* Bottom bar */}
                <div className="flex items-center justify-between px-5 py-3 border-t border-[#1f1f28] bg-[#0d0d14]">
                  <button
                    onClick={handleReset}
                    className="text-xs text-[#8b8b9e] hover:text-[#f0f0f3] transition-colors"
                  >
                    Recommencer
                  </button>
                  <span className="text-[10px] text-[#3f3f4a]">
                    Gratuit &middot; 10 pages &middot; Powered by SOMA Studio
                  </span>
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
