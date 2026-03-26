"use client";

import { useState, useRef, useCallback } from "react";
import type { CMSFeature, CMSStep, CMSFaqItem } from "@/lib/cms-data";
import { FAQ } from "@/components/FAQ";

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

interface ChatbotPageProps {
  features: CMSFeature[];
  howItWorks: CMSStep[];
  faq: CMSFaqItem[];
}

export function ChatbotPage({ features, howItWorks, faq }: ChatbotPageProps) {
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

  const siteUrl = typeof window !== "undefined" ? window.location.origin : "";
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
    <article className="py-[var(--spacing-section)] max-[991px]:py-[var(--spacing-section-mobile)]">
      <div className="mx-auto max-w-[var(--container-max)] px-[var(--spacing-container)]">

        {/* Hero */}
        <h1 className="text-h1 font-semibold max-[767px]:text-h2">
          Chatbot IA gratuit
        </h1>
        <p className="mt-4 max-w-[600px] text-body text-gray">
          Un assistant IA pour votre site web, entra&icirc;n&eacute; sur votre contenu
          public. Pr&ecirc;t en 5 minutes.
        </p>

        {/* Features + Price sidebar */}
        <div className="mt-12 grid grid-cols-1 gap-12 min-[992px]:grid-cols-[1fr_auto]">
          <div>
            <h2 className="text-h3 font-medium">Fonctionnalit&eacute;s</h2>
            <ul className="mt-6 space-y-3">
              {features.map((f) => (
                <li
                  key={f.id || f.feature}
                  className="flex items-start gap-3 text-body text-body-text"
                >
                  <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[#C8E6FF]" />
                  {f.feature}
                </li>
              ))}
            </ul>
          </div>

          <div className="self-start rounded-[var(--radius-default)] border border-border bg-white p-8 text-center min-[992px]:w-[280px]">
            <p className="text-sm font-medium uppercase tracking-wider text-gray">
              Tarif
            </p>
            <p className="mt-2 text-h3 font-semibold">
              Gratuit
            </p>
            <p className="mt-1 text-sm text-gray">
              10 pages max. scrappées
            </p>
            <a
              href="#sandbox"
              className="mt-6 inline-block w-full rounded-[var(--radius-pill)] bg-dark px-5 py-2.5 text-sm font-normal text-white transition-all duration-300 hover:bg-button-hover"
            >
              Cr&eacute;er mon chatbot
            </a>
          </div>
        </div>

        {/* How it works */}
        <div className="mt-20">
          <h2 className="text-h3 font-medium">
            Comment &ccedil;a fonctionne
          </h2>
          <div className="mt-10 grid grid-cols-1 gap-8 min-[992px]:grid-cols-2">
            {howItWorks.map((step, i) => (
              <div key={step.id || i} className="flex items-start gap-5">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-dark"
                  style={{ backgroundColor: '#C8E6FF' }}
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div>
                  <h3 className="font-medium text-title-text">{step.stepTitle}</h3>
                  <p className="mt-2 text-body leading-relaxed text-gray">
                    {step.stepDescription}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sandbox */}
        <div id="sandbox" className="mt-20">
          <h2 className="text-h3 font-medium">
            Cr&eacute;er mon chatbot
          </h2>
          {/* URL Form */}
          <form onSubmit={handleSubmit} className="mt-10 flex w-full gap-3">
            <input
              type="text"
              aria-label="URL de votre site web"
              placeholder="https://votre-site.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={state === "running"}
              className="flex-1 rounded-[var(--radius-default)] border border-border bg-white px-4 py-3 text-md text-body-text placeholder-[#999] outline-none transition-colors focus:border-dark disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={state === "running" || !url.trim()}
              className="rounded-[var(--radius-default)] bg-dark px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-button-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {state === "running" ? "En cours..." : "Cr\u00e9er"}
            </button>
          </form>
          <p className="mt-2 text-sm text-gray">
            10 pages max. scrapp&eacute;es &mdash; Aucune carte requise.
          </p>

          {/* Terminal + Preview + Snippet — dark island */}
          {(state === "running" || state === "complete") && (
            <div className="mt-8 overflow-hidden rounded-[var(--radius-default)] border border-[#1f1f28] bg-[#0a0a0f]">
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

            </div>
          )}
        </div>

        {/* Upsell: Free vs Custom comparison */}
        <div className="mt-20">
          <h2 className="text-h3 font-medium text-title-text">
            Aller plus loin
          </h2>
          <p className="mt-3 text-body text-gray">
            Ce chatbot gratuit est id&eacute;al pour tester la technologie RAG sur votre site.
            Pour un assistant qui r&eacute;pond vraiment &agrave; vos enjeux m&eacute;tier, voici ce que nous proposons.
          </p>

          {/* Comparison grid */}
          <div className="mt-10 grid grid-cols-1 gap-6 min-[992px]:grid-cols-2">

            {/* Free tier card */}
            <div className="rounded-[var(--radius-default)] border border-border bg-white p-8">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#C8E6FF] text-sm font-semibold text-dark">
                  &#10003;
                </span>
                <h3 className="text-body font-semibold text-title-text">
                  Chatbot gratuit
                </h3>
              </div>
              <p className="mt-1 text-sm text-gray">Ce que vous avez maintenant</p>
              <ul className="mt-6 space-y-3">
                <li className="flex items-start gap-3 text-md text-body-text">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-border" />
                  10 pages index&eacute;es maximum
                </li>
                <li className="flex items-start gap-3 text-md text-body-text">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-border" />
                  Contenu public uniquement
                </li>
                <li className="flex items-start gap-3 text-md text-body-text">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-border" />
                  R&eacute;ponses dans la langue du site
                </li>
                <li className="flex items-start gap-3 text-md text-body-text">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-border" />
                  Widget standard avec branding SOMA
                </li>
                <li className="flex items-start gap-3 text-md text-body-text">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-border" />
                  Refresh manuel du contenu
                </li>
              </ul>
            </div>

            {/* Custom tier card */}
            <div className="rounded-[var(--radius-default)] border-2 border-dark bg-white p-8">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-dark text-sm font-semibold text-white">
                  &#9733;
                </span>
                <h3 className="text-body font-semibold text-title-text">
                  Chatbot sur mesure
                </h3>
              </div>
              <p className="mt-1 text-sm text-gray">&Agrave; partir de 1&nbsp;800&nbsp;&euro;</p>
              <ul className="mt-6 space-y-3">
                <li className="flex items-start gap-3 text-md text-body-text">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-dark" />
                  Pages illimit&eacute;es — tout votre site index&eacute;
                </li>
                <li className="flex items-start gap-3 text-md text-body-text">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-dark" />
                  Documents internes (PDF, Word, bases de connaissances)
                </li>
                <li className="flex items-start gap-3 text-md text-body-text">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-dark" />
                  Support multilingue — r&eacute;ponses dans la langue du visiteur
                </li>
                <li className="flex items-start gap-3 text-md text-body-text">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-dark" />
                  Personnalisation du ton, de la personnalit&eacute; et du p&eacute;rim&egrave;tre
                </li>
                <li className="flex items-start gap-3 text-md text-body-text">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-dark" />
                  Widget white-label sans branding
                </li>
                <li className="flex items-start gap-3 text-md text-body-text">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-dark" />
                  Refresh automatique du contenu (hebdomadaire)
                </li>
                <li className="flex items-start gap-3 text-md text-body-text">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-dark" />
                  D&eacute;ploiement on-premise possible
                </li>
                <li className="flex items-start gap-3 text-md text-body-text">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-dark" />
                  Analytics et suivi des conversations
                </li>
              </ul>
              <a
                href="https://somastudio.xyz/nos-services/assistant-ia-rag"
                className="mt-8 inline-block w-full rounded-[var(--radius-pill)] bg-dark px-5 py-2.5 text-center text-sm font-normal text-white transition-all duration-300 hover:bg-button-hover"
              >
                D&eacute;couvrir l&apos;offre sur mesure
              </a>
            </div>

          </div>
        </div>

        {/* Bottom CTA */}
        <div className="mt-16 text-center">
          <h2 className="text-h3 font-medium text-title-text">
            Une question sur nos offres ?
          </h2>
          <p className="mt-3 text-body text-gray">
            Premier &eacute;change sans engagement — on vous explique ce qui est possible pour votre cas.
          </p>
          <a
            href="https://calendly.com/hello-somastudio/30min"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-block rounded-[var(--radius-pill)] bg-dark px-5 py-2.5 text-sm font-normal text-white transition-all duration-300 hover:bg-button-hover"
          >
            R&eacute;server un cr&eacute;neau
          </a>
        </div>

      </div>

      {/* FAQ — outside inner container (FAQ has its own container) */}
      {faq.length > 0 && (
        <FAQ items={faq.map(f => ({ question: f.question, answer: f.answer }))} />
      )}

    </article>
  );
}
