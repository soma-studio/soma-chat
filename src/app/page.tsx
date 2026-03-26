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

type PipelineEvent =
  | { type: "start"; siteId: string; url: string }
  | { type: "page"; title?: string; url: string; chars: number; current: number; maxPages: number }
  | { type: "limit"; pagesScraped: number; totalPagesFound: number; message: string }
  | { type: "analyzing" }
  | { type: "chunking"; documents: number; totalChunks: number }
  | { type: "indexing"; indexed: number; total: number; percent: number }
  | { type: "complete"; siteId: string; pagesIndexed: number; chunksIndexed: number; elapsedMs: number }
  | { type: "error"; message: string };

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

  function htmlEncode(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

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
        let errorMessage = res.statusText;
        try {
          const err = await res.json();
          errorMessage = err.error || errorMessage;
        } catch {
          // Response body is not valid JSON (e.g. 502 HTML page)
        }
        addLine(`Erreur: ${errorMessage}`, "#f85149");
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

  const handleEvent = (event: PipelineEvent) => {
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
    ? `<script src="${siteUrl}/widget.js" data-site-id="${completeData.siteId.replace(/[^a-zA-Z0-9-_]/g, '')}"><\/script>`
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
    <div className="flex min-h-screen flex-col">
      {/* Section 1: Hero */}
      <section className="pt-[60px] pb-[var(--spacing-section)] max-[991px]:pt-6 max-[991px]:pb-[var(--spacing-section-mobile)]">
        <div className="mx-auto max-w-[var(--container-max)] px-[var(--spacing-container)]">
          <h1 className="text-[56px] font-semibold text-[#000] max-[767px]:text-[38px]">
            Chatbot IA gratuit
          </h1>
          <p className="mt-4 max-w-[600px] text-[17px] text-[#717171]">
            Un assistant IA pour votre site web, entra&icirc;n&eacute; sur votre contenu
            public. Pr&ecirc;t en 5 minutes.
          </p>
        </div>
      </section>

      {/* Section 2: Features + Price sidebar */}
      <section className="pb-[var(--spacing-section)] max-[991px]:pb-[var(--spacing-section-mobile)]">
        <div className="mx-auto max-w-[var(--container-max)] px-[var(--spacing-container)]">
          <div className="grid grid-cols-1 gap-12 min-[992px]:grid-cols-[1fr_280px]">
            {/* Features */}
            <div>
              <h2 className="text-[24px] font-medium text-[#000]">Fonctionnalit&eacute;s</h2>
              <ul className="mt-6 space-y-3">
                {features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-3 text-[17px] text-[#333]"
                  >
                    <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[#C8E6FF]" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>

            {/* Price sidebar */}
            <div className="self-start rounded-[4px] border border-[#d9d9d9] bg-white p-8 text-center">
              <p className="text-[13px] font-medium uppercase tracking-wider text-[#717171]">
                Tarif
              </p>
              <p className="mt-2 text-[24px] font-semibold text-[#22c55e]">
                Gratuit
              </p>
              <p className="mt-1 text-[13px] text-[#717171]">
                10 pages &middot; Open source
              </p>
              <a
                href="#sandbox"
                className="mt-6 inline-block w-full rounded-[100px] bg-[#0e1527] px-5 py-2.5 text-[13px] font-normal text-white transition-all duration-300 hover:bg-[#19284c]"
              >
                Cr&eacute;er mon chatbot
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Section 3: How it works */}
      <section className="border-t border-[#d9d9d9] py-[var(--spacing-section)] max-[991px]:py-[var(--spacing-section-mobile)]">
        <div className="mx-auto max-w-[var(--container-max)] px-[var(--spacing-container)]">
          <h2 className="mb-10 text-[24px] font-medium text-[#000]">
            Comment &ccedil;a marche
          </h2>
          <div className="grid grid-cols-1 gap-8 min-[992px]:grid-cols-3">
            {steps.map((step, i) => (
              <div key={i}>
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-[#C8E6FF] text-[15px] font-bold text-[#0e1527]">
                  {String(i + 1).padStart(2, "0")}
                </div>
                <h3 className="mb-2 font-medium text-[#000]">
                  {step.title}
                </h3>
                <p className="text-[15px] leading-relaxed text-[#717171]">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Section 4: Sandbox */}
      <section id="sandbox" className="border-t border-[#d9d9d9] py-[var(--spacing-section)] max-[991px]:py-[var(--spacing-section-mobile)]">
        <div className="mx-auto max-w-[var(--container-max)] px-[var(--spacing-container)]">
          <h2 className="mb-6 text-[24px] font-medium text-[#000]">
            Essayer maintenant
          </h2>

          {/* URL Form — light theme */}
          <form onSubmit={handleSubmit} className="flex w-full max-w-lg gap-3">
            <input
              type="text"
              aria-label="URL de votre site web"
              placeholder="https://votre-site.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={state === "running"}
              className="flex-1 rounded-[4px] border border-[#d9d9d9] bg-white px-4 py-3 text-[15px] text-[#333] placeholder-[#999] outline-none transition-colors focus:border-[#0e1527] disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={state === "running" || !url.trim()}
              className="rounded-[4px] bg-[#0e1527] px-5 py-3 text-[13px] font-medium text-white transition-colors hover:bg-[#19284c] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {state === "running" ? "En cours..." : "Cr\u00e9er"}
            </button>
          </form>
          <p className="mt-2 text-[13px] text-[#717171]">
            10 pages max (free tier) &mdash; Aucune carte requise.
          </p>

          {/* Terminal + Preview + Snippet — dark island */}
          {(state === "running" || state === "complete") && (
            <div className="mt-8 overflow-hidden rounded-[4px] border border-[#1f1f28] bg-[#0a0a0f]">
              {/* Terminal window */}
              <div>
                {/* VSCode-style tab bar */}
                <div className="flex items-center justify-between border-b border-[#1f1f28] bg-[#0d0d14] px-3 py-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-wider text-[#8b8b9e]">
                      Terminal
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-[#8b8b9e]">
                    <span>soma-chat</span>
                    <span className="text-[#2a2a34]">|</span>
                    <span>node</span>
                  </div>
                </div>
                {/* Terminal content */}
                <div
                  ref={terminalRef}
                  aria-live="polite"
                  aria-label="Progression du pipeline"
                  className="max-h-72 overflow-y-auto p-4 font-mono text-xs leading-5"
                >
                  {lines.map((line, i) => (
                    <div key={i} style={{ color: line.color || "#f0f0f3" }}>
                      {line.text || "\u00A0"}
                    </div>
                  ))}
                  {state === "running" && (
                    <span className="inline-block h-3.5 w-[2px] animate-pulse bg-[#a0a0b0]" />
                  )}
                </div>
              </div>

              {/* Live Preview */}
              {state === "complete" && completeData && (
                <div className="border-t border-[#1f1f28] p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-xs uppercase tracking-wider text-[#8b8b9e]">
                      Aper&ccedil;u
                    </p>
                    <p className="text-[10px] text-[#3f3f4a]">
                      Les donn&eacute;es de votre site sont utilis&eacute;es en temps r&eacute;el
                    </p>
                  </div>
                  <div
                    className="overflow-hidden rounded-[4px] border border-[#1f1f28] bg-[#0a0a0f]"
                    style={{ height: "480px" }}
                  >
                    <iframe
                      className="h-full w-full border-0"
                      srcDoc={`<!DOCTYPE html>
<html>
<head>
<style>
  body { margin: 0; background: #0a0a0f; height: 100vh; overflow: hidden; }
</style>
</head>
<body>
<script>window.SOMA_CHAT_AUTO_OPEN = true;<\/script>
<script src="${siteUrl}/widget.js" data-site-id="${htmlEncode(completeData.siteId)}"><\/script>
</body>
</html>`}
                      title="Aperçu du chatbot"
                    />
                  </div>
                </div>
              )}

              {/* Stripe-style snippet card */}
              {state === "complete" && completeData && (
                <div className="border-t border-[#1f1f28]">
                  {/* Header bar */}
                  <div className="flex items-center justify-between border-b border-[#1f1f28] bg-[#0d0d14] px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <span className="inline-block h-2 w-2 rounded-full bg-[#3fb950]" />
                      <span className="text-sm font-medium text-[#f0f0f3]">
                        Votre chatbot est pr&ecirc;t
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
                  <div className="border-b border-[#1f1f28] px-5 py-4">
                    <p className="text-sm text-[#8b8b9e]">
                      Collez ce snippet dans votre HTML, juste avant{" "}
                      <code className="rounded bg-[#1a1a24] px-1.5 py-0.5 text-xs text-[#f0f0f3]">
                        &lt;/body&gt;
                      </code>
                    </p>
                  </div>

                  {/* Code block */}
                  <div className="relative">
                    {/* Tab bar */}
                    <div className="flex items-center border-b border-[#1f1f28] bg-[#0d0d14] px-4 py-1.5">
                      <span className="border-b border-blue-500 pb-1.5 text-[10px] uppercase tracking-wider text-[#8b8b9e]">
                        HTML
                      </span>
                    </div>

                    {/* Code with line numbers */}
                    <div className="flex overflow-x-auto bg-[#0a0a0f] p-4">
                      {/* Line numbers */}
                      <div className="flex w-8 shrink-0 select-none flex-col pr-4 text-right font-mono text-xs leading-5 text-[#3f3f4a]">
                        <span>1</span>
                        <span>2</span>
                        <span>3</span>
                      </div>

                      {/* Syntax-highlighted code */}
                      <pre className="whitespace-pre font-mono text-xs leading-5">
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
                      className="absolute right-3 top-10 rounded-md border border-[#2a2a34] bg-[#1a1a24] px-3 py-1.5 text-xs text-[#8b8b9e] transition-colors hover:text-[#f0f0f3]"
                    >
                      {copied ? "Copié !" : "Copier"}
                    </button>
                  </div>

                  {/* Bottom bar */}
                  <div className="flex items-center justify-between border-t border-[#1f1f28] bg-[#0d0d14] px-5 py-3">
                    <button
                      onClick={handleReset}
                      className="text-xs text-[#8b8b9e] transition-colors hover:text-[#f0f0f3]"
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
                <div className="border-t border-[#1f1f28] p-4 space-y-3">
                  {completeData.chunksIndexed < 20 && (
                    <div className="rounded-[4px] border border-amber-500/20 bg-amber-500/5 px-5 py-4">
                      <p className="text-sm leading-relaxed text-[#a0a0b0]">
                        <span className="font-medium text-amber-400">R&eacute;sultats limit&eacute;s ?</span>{" "}
                        Si votre chatbot manque d&apos;informations, c&apos;est probablement que votre site
                        n&apos;est pas optimis&eacute; pour la lecture par les bots IA — ce qui signifie
                        qu&apos;il ne ressort pas non plus dans les r&eacute;sultats de ChatGPT, Gemini ou
                        Perplexity.{" "}
                        <a
                          href="https://somastudio.xyz/nos-services/site-ia-ready"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 underline hover:text-blue-300"
                        >
                          Optimiser mon SEO &amp; AEO &rarr;
                        </a>
                      </p>
                    </div>
                  )}
                  <div className="rounded-[4px] border border-[#1f1f28] bg-[#0d0d14] px-5 py-4">
                    <p className="text-sm leading-relaxed text-[#8b8b9e]">
                      Vous souhaitez personnaliser le ton, connecter vos documents internes, ou
                      &eacute;tendre les capacit&eacute;s de votre chatbot ?{" "}
                      <a
                        href="https://somastudio.xyz/nos-services/assistant-ia-rag"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 underline hover:text-blue-300"
                      >
                        D&eacute;couvrir notre offre sur mesure &rarr;
                      </a>
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Section 5: Bottom CTA */}
      <section className="border-t border-[#d9d9d9] py-[var(--spacing-section)] max-[991px]:py-[var(--spacing-section-mobile)]">
        <div className="mx-auto max-w-[var(--container-max)] px-[var(--spacing-container)] text-center">
          <h2 className="text-[24px] font-medium text-[#000]">
            Besoin de plus de 10 pages ?
          </h2>
          <p className="mt-3 text-[17px] text-[#717171]">
            Nous construisons des assistants IA sur mesure, connect&eacute;s &agrave; vos
            documents internes.
          </p>
          <a
            href="https://somastudio.xyz/contact"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-block rounded-[100px] border border-[#d9d9d9] bg-white px-5 py-2.5 text-[13px] font-normal text-[#000] transition-all duration-300 hover:bg-[#0e1527] hover:text-white"
          >
            Discuter de votre projet
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-[#d9d9d9] px-[var(--spacing-container)] py-8">
        <div className="mx-auto flex max-w-[var(--container-max)] items-center justify-between text-[13px] text-[#717171]">
          <span>Open source (MIT)</span>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com/soma-studio/soma-chat"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-[#333]"
            >
              GitHub
            </a>
            <a
              href="https://somastudio.xyz"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-[#333]"
            >
              SOMA Studio
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
