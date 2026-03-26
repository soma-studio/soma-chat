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

const features = [
  "Scraping automatique de votre site (pages publiques)",
  "Découpage intelligent du contenu en chunks",
  "Indexation vectorielle via Mistral AI embeddings",
  "Chatbot RAG avec réponses sourcées",
  "Widget embeddable en une ligne de code (Shadow DOM)",
  "Questions suggérées auto-générées",
  "Aucune clé API requise — tout est hébergé",
  "Open source (MIT) — self-host possible",
];

const steps = [
  {
    title: "Entrez votre URL",
    desc: "On prend l\u2019URL de votre site et on crawle toutes les pages publiques.",
  },
  {
    title: "On indexe votre contenu",
    desc: "Le contenu est découpé en chunks, transformé en vecteurs et stocké dans Qdrant.",
  },
  {
    title: "Collez le script",
    desc: "Un simple <script> à ajouter dans votre HTML. Le chatbot apparaît en bas à droite.",
  },
];

export default function Home() {
  const [state, setState] = useState<AppState>("idle");
  const [url, setUrl] = useState("");
  const [lines, setLines] = useState<TerminalLine[]>([]);
  const [completeData, setCompleteData] = useState<CompleteData | null>(null);
  const [copied, setCopied] = useState(false);
  const terminalRef = useRef<HTMLDivElement>(null);

  const addLine = useCallback((text: string, color?: string) => {
    setLines((prev) => [...prev, { text, color }]);
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

    let normalizedUrl = url.trim();
    if (!normalizedUrl.startsWith("http://") && !normalizedUrl.startsWith("https://")) {
      normalizedUrl = "https://" + normalizedUrl;
    }

    setState("running");
    setLines([]);
    setCompleteData(null);
    addLine(`\u276F npx pipeline --url ${normalizedUrl}`, "#8b8b9e");
    addLine("");

    try {
      const res = await fetch("/api/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: normalizedUrl }),
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

      case "analyzing":
        addLine("");
        addLine("Analyse du site en cours...", "#a78bfa");
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
      {/* Section 1: Hero */}
      <section className="pt-24 pb-12 max-[767px]:pt-16 max-[767px]:pb-8">
        <div className="mx-auto max-w-[940px] px-6">
          <h1 className="text-5xl font-semibold tracking-tight max-[767px]:text-3xl">
            SOMA{" "}
            <span className="bg-gradient-to-r from-blue-500 to-indigo-500 bg-clip-text text-transparent">
              Chat
            </span>
          </h1>
          <p className="mt-4 max-w-[600px] text-lg text-[#8b8b9e]">
            Un assistant IA pour votre site web, entraîné sur votre contenu
            public. Gratuit, open source, prêt en 5 minutes.
          </p>
        </div>
      </section>

      {/* Section 2: Features + Price sidebar */}
      <section className="pb-16">
        <div className="mx-auto max-w-[940px] px-6">
          <div className="grid grid-cols-1 gap-12 min-[768px]:grid-cols-[1fr_280px]">
            {/* Features */}
            <div>
              <h2 className="text-2xl font-medium">Fonctionnalités</h2>
              <ul className="mt-6 space-y-3">
                {features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-3 text-[15px] text-[#a0a0b0]"
                  >
                    <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>

            {/* Price sidebar */}
            <div className="self-start rounded-xl border border-[#1f1f28] bg-[#111118] p-8 text-center">
              <p className="text-xs font-medium uppercase tracking-wider text-[#8b8b9e]">
                Tarif
              </p>
              <p className="mt-2 text-3xl font-semibold text-[#3fb950]">
                Gratuit
              </p>
              <p className="mt-1 text-xs text-[#55556a]">
                10 pages &middot; Open source
              </p>
              <a
                href="#sandbox"
                className="mt-6 inline-block w-full rounded-full bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-500 transition-colors"
              >
                Créer mon chatbot
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Section 3: How it works */}
      <section className="pb-16 border-t border-[#1f1f28] pt-16">
        <div className="mx-auto max-w-[940px] px-6">
          <h2 className="text-2xl font-medium mb-10">Comment ça marche</h2>
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
            {steps.map((step, i) => (
              <div key={i}>
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-blue-600/20 text-blue-400 font-bold text-lg">
                  {i + 1}
                </div>
                <h3 className="font-medium mb-2 text-[#f0f0f3]">
                  {step.title}
                </h3>
                <p className="text-sm text-[#8b8b9e] leading-relaxed">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Section 4: Sandbox */}
      <section id="sandbox" className="pb-16 border-t border-[#1f1f28] pt-16">
        <div className="mx-auto max-w-[940px] px-6">
          <h2 className="text-2xl font-medium mb-6">Essayer maintenant</h2>

          {/* URL Form — always visible */}
          <form onSubmit={handleSubmit} className="flex w-full max-w-lg gap-3">
            <input
              type="text"
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
          <p className="mt-2 text-xs text-[#55556a]">
            10 pages max (free tier) &mdash; Aucune carte requise.
          </p>

          {/* Terminal + Preview + Snippet — only when running or complete */}
          {(state === "running" || state === "complete") && (
            <div className="mt-8">
              {/* Terminal window */}
              <div className="rounded-lg border border-[#1f1f28] bg-[#0a0a0f] overflow-hidden">
                {/* VSCode-style tab bar */}
                <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#1f1f28] bg-[#0d0d14]">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-wider text-[#55556a]">
                      Terminal
                    </span>
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
                      <span className="text-sm font-medium text-[#f0f0f3]">
                        Votre chatbot est prêt
                      </span>
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
                        <span style={{ color: "#a5d6ff" }}>
                          &quot;{siteUrl}/widget.js&quot;
                        </span>
                        {" "}
                        <span style={{ color: "#d2a8ff" }}>data-site-id</span>
                        <span style={{ color: "#f0f0f3" }}>=</span>
                        <span style={{ color: "#a5d6ff" }}>
                          &quot;{completeData.siteId}&quot;
                        </span>
                        {"\n"}
                        <span style={{ color: "#f85149" }}>
                          &gt;&lt;/script&gt;
                        </span>
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

              {/* Conversion banners */}
              {state === "complete" && completeData && (
                <>
                  {completeData.chunksIndexed < 20 && (
                    <div className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/5 px-5 py-4">
                      <p className="text-sm text-[#a0a0b0] leading-relaxed">
                        <span className="text-amber-400 font-medium">Résultats limités ?</span>{" "}
                        Si votre chatbot manque d&apos;informations, c&apos;est probablement que votre site
                        n&apos;est pas optimisé pour la lecture par les bots IA — ce qui signifie
                        qu&apos;il ne ressort pas non plus dans les résultats de ChatGPT, Gemini ou
                        Perplexity.{" "}
                        <a
                          href="https://somastudio.xyz/nos-services/site-ia-ready"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:text-blue-300 underline"
                        >
                          Optimiser mon SEO &amp; AEO →
                        </a>
                      </p>
                    </div>
                  )}
                  <div className="mt-3 rounded-lg border border-[#1f1f28] bg-[#0d0d14] px-5 py-4">
                    <p className="text-sm text-[#8b8b9e] leading-relaxed">
                      Vous souhaitez personnaliser le ton, connecter vos documents internes, ou
                      étendre les capacités de votre chatbot ?{" "}
                      <a
                        href="https://somastudio.xyz/nos-services/assistant-ia-rag"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 underline"
                      >
                        Découvrir notre offre sur mesure →
                      </a>
                    </p>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Section 5: Bottom CTA */}
      <section className="pb-16 border-t border-[#1f1f28] pt-16">
        <div className="mx-auto max-w-[940px] px-6 text-center">
          <h2 className="text-2xl font-medium">
            Besoin de plus de 10 pages ?
          </h2>
          <p className="mt-3 text-[#8b8b9e]">
            Nous construisons des assistants IA sur mesure, connectés à vos
            documents internes.
          </p>
          <a
            href="https://somastudio.xyz/contact"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-block rounded-full border border-[#2a2a34] bg-[#111118] px-6 py-2.5 text-sm font-medium text-[#f0f0f3] hover:bg-[#1a1a24] transition-colors"
          >
            Discuter de votre projet
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-[#1f1f28] px-6 py-8">
        <div className="mx-auto max-w-[940px] flex items-center justify-between text-sm text-[#55556a]">
          <span>Open source (MIT)</span>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com/soma-studio/soma-chat"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#8b8b9e] transition-colors"
            >
              GitHub
            </a>
            <a
              href="https://somastudio.xyz"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#8b8b9e] transition-colors"
            >
              SOMA Studio
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
