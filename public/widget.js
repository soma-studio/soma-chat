(function () {
  // Prevent double init
  if (document.querySelector("[data-soma-chat-mounted]")) return;

  // Read config from script tag
  var script = document.currentScript;
  if (!script) return;

  var siteId = script.getAttribute("data-site-id");
  if (!siteId) {
    console.error("SOMA Chat: data-site-id attribute is required");
    return;
  }

  var accentColor = script.getAttribute("data-color") || "#3b82f6";
  var apiBase = new URL(script.src).origin;

  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function isSafeUrl(url) {
    try {
      var parsed = new URL(url, window.location.href);
      return ['http:', 'https:', 'mailto:'].indexOf(parsed.protocol) !== -1;
    } catch (e) {
      return false;
    }
  }

  // --- Styles ---
  var css = `
    :host {
      all: initial;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      line-height: 1.5;
      color: #f0f0f3;
    }

    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    .soma-btn {
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: ${accentColor};
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 24px rgba(0,0,0,0.4);
      transition: transform 0.2s, box-shadow 0.2s;
      z-index: 2147483646;
    }
    .soma-btn:hover {
      transform: scale(1.08);
      box-shadow: 0 6px 32px rgba(0,0,0,0.5);
    }
    .soma-btn svg {
      width: 26px;
      height: 26px;
      fill: #fff;
    }

    .soma-panel {
      position: fixed;
      bottom: 96px;
      right: 24px;
      width: 380px;
      height: 520px;
      background: #0a0a0f;
      border: 1px solid #1f1f28;
      border-radius: 16px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      box-shadow: 0 8px 48px rgba(0,0,0,0.6);
      z-index: 2147483647;
      opacity: 0;
      transform: translateY(16px) scale(0.96);
      pointer-events: none;
      transition: opacity 0.2s ease, transform 0.2s ease;
    }
    .soma-panel.open {
      opacity: 1;
      transform: translateY(0) scale(1);
      pointer-events: auto;
    }

    @media (max-width: 440px) {
      .soma-panel {
        width: calc(100vw - 16px);
        height: calc(100vh - 120px);
        right: 8px;
        bottom: 88px;
        border-radius: 12px;
      }
    }

    .soma-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 16px;
      background: #111118;
      border-bottom: 1px solid #1f1f28;
    }
    .soma-header-left {
      display: flex;
      align-items: center;
      gap: 2px;
    }
    .soma-header-right {
      display: flex;
      align-items: center;
      gap: 2px;
    }
    .soma-header-title {
      font-weight: 600;
      font-size: 15px;
      color: #f0f0f3;
    }
    .soma-online-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #22c55e;
      display: inline-block;
      margin-left: 6px;
      vertical-align: middle;
    }
    .soma-close {
      background: none;
      border: none;
      cursor: pointer;
      color: #8b8b9e;
      padding: 4px;
      border-radius: 6px;
      display: flex;
      align-items: center;
    }
    .soma-close:hover { color: #f0f0f3; background: #1a1a24; }
    .soma-close svg { width: 18px; height: 18px; }
    .soma-reset {
      background: none;
      border: none;
      cursor: pointer;
      color: #55556a;
      padding: 4px;
      border-radius: 6px;
      display: flex;
      align-items: center;
    }
    .soma-reset:hover { color: #8b8b9e; background: #1a1a24; }

    .soma-messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .soma-messages::-webkit-scrollbar { width: 4px; }
    .soma-messages::-webkit-scrollbar-track { background: transparent; }
    .soma-messages::-webkit-scrollbar-thumb { background: #2a2a34; border-radius: 2px; }

    .soma-msg {
      max-width: 85%;
      padding: 10px 14px;
      border-radius: 12px;
      font-size: 14px;
      line-height: 1.55;
      word-wrap: break-word;
    }
    .soma-msg-user {
      align-self: flex-end;
      background: ${accentColor};
      color: #fff;
      border-bottom-right-radius: 4px;
    }
    .soma-msg-assistant {
      align-self: flex-start;
      background: #1a1a24;
      color: #e8e8ed;
      border-bottom-left-radius: 4px;
    }
    .soma-msg-assistant a {
      color: ${accentColor};
      text-decoration: underline;
    }
    .soma-msg-assistant strong { font-weight: 600; }
    .soma-msg-assistant em { font-style: italic; }
    .soma-msg-assistant ul, .soma-msg-assistant ol {
      margin: 6px 0;
      padding-left: 18px;
    }
    .soma-msg-assistant ol {
      padding-left: 22px;
      list-style: decimal;
    }
    .soma-msg-assistant li { margin-bottom: 2px; }
    .soma-heading {
      font-weight: 600;
      font-size: 14px;
      color: #f0f0f3;
      margin: 8px 0 4px;
    }
    .soma-hr {
      border: none;
      border-top: 1px solid #2a2a34;
      margin: 8px 0;
    }
    .soma-code {
      background: #0d0d14;
      padding: 1px 5px;
      border-radius: 4px;
      font-family: 'SF Mono', 'Fira Code', monospace;
      font-size: 12px;
      color: #e8e8ed;
    }

    .soma-sources {
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px solid #2a2a34;
    }
    .soma-sources-title {
      font-size: 11px;
      color: #8b8b9e;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }
    .soma-source-link {
      display: block;
      font-size: 12px;
      color: ${accentColor};
      text-decoration: none;
      padding: 2px 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .soma-source-link:hover { text-decoration: underline; }

    .soma-typing {
      align-self: flex-start;
      display: flex;
      gap: 4px;
      padding: 12px 16px;
      background: #1a1a24;
      border-radius: 12px;
      border-bottom-left-radius: 4px;
    }
    .soma-typing-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #8b8b9e;
      animation: somaBounce 1.2s infinite;
    }
    .soma-typing-dot:nth-child(2) { animation-delay: 0.2s; }
    .soma-typing-dot:nth-child(3) { animation-delay: 0.4s; }
    @keyframes somaBounce {
      0%, 60%, 100% { transform: translateY(0); }
      30% { transform: translateY(-6px); }
    }

    .soma-input-bar {
      display: flex;
      gap: 8px;
      padding: 12px 16px;
      background: #111118;
      border-top: 1px solid #1f1f28;
    }
    .soma-input {
      flex: 1;
      background: #0d0d14;
      border: 1px solid #2a2a34;
      border-radius: 8px;
      padding: 8px 12px;
      color: #f0f0f3;
      font-size: 14px;
      font-family: inherit;
      outline: none;
      resize: none;
    }
    .soma-input:focus { border-color: ${accentColor}; }
    .soma-input::placeholder { color: #55556a; }
    .soma-input:disabled { opacity: 0.5; }

    .soma-send {
      background: ${accentColor};
      border: none;
      border-radius: 8px;
      width: 36px;
      height: 36px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: opacity 0.15s;
    }
    .soma-send:disabled { opacity: 0.5; cursor: default; }
    .soma-send svg { width: 16px; height: 16px; fill: #fff; }

    .soma-footer {
      text-align: center;
      padding: 8px 16px 12px;
      background: #111118;
    }
    .soma-footer a {
      font-size: 11px;
      color: #8b8b9e;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .soma-footer a:hover { color: #f0f0f3; }
    .soma-footer a strong {
      font-weight: 800;
      color: #f0f0f3;
      letter-spacing: 0.02em;
    }
    .soma-footer a:hover strong { color: #fff; }

    .soma-welcome {
      text-align: center;
      padding: 32px 16px 16px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    }
    .soma-welcome-icon {
      width: 40px;
      height: 40px;
      border-radius: 12px;
      background: ${accentColor}26;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .soma-welcome-icon svg { width: 22px; height: 22px; fill: ${accentColor}; }
    .soma-welcome-title {
      font-weight: 600;
      font-size: 16px;
      color: #f0f0f3;
    }
    .soma-welcome-text {
      color: #8b8b9e;
      font-size: 13px;
      max-width: 280px;
    }

    .soma-suggestions {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      justify-content: center;
      padding: 8px 16px 16px;
    }
    .soma-suggestion {
      background: #111118;
      border: 1px solid #2a2a34;
      border-radius: 20px;
      padding: 6px 12px;
      color: #8b8b9e;
      font-size: 12px;
      cursor: pointer;
      transition: all 0.15s;
      font-family: inherit;
    }
    .soma-suggestion:hover {
      background: #1a1a24;
      border-color: ${accentColor};
      color: #f0f0f3;
    }
  `;

  // --- SVG Icons ---
  var chatIcon =
    '<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.2L4 17.2V4h16v12z"/></svg>';
  var closeIcon =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>';
  var sendIcon =
    '<svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>';

  // --- Create Shadow DOM ---
  var host = document.createElement("div");
  host.setAttribute("data-soma-chat-mounted", "true");
  var shadow = host.attachShadow({ mode: "closed" });

  // Inject styles
  var styleEl = document.createElement("style");
  styleEl.textContent = css;
  shadow.appendChild(styleEl);

  // --- Build UI ---
  // Floating button
  var btn = document.createElement("button");
  btn.className = "soma-btn";
  btn.innerHTML = chatIcon;
  btn.setAttribute("aria-label", "Open chat");
  shadow.appendChild(btn);

  // Panel
  var panel = document.createElement("div");
  panel.className = "soma-panel";

  // Header
  var header = document.createElement("div");
  header.className = "soma-header";

  var headerLeft = document.createElement("div");
  headerLeft.className = "soma-header-left";
  var headerTitle = document.createElement("span");
  headerTitle.className = "soma-header-title";
  headerTitle.textContent = "Assistant";
  var onlineDot = document.createElement("span");
  onlineDot.className = "soma-online-dot";
  headerLeft.appendChild(headerTitle);
  headerLeft.appendChild(onlineDot);

  var headerRight = document.createElement("div");
  headerRight.className = "soma-header-right";

  // Reset button
  var resetBtn = document.createElement("button");
  resetBtn.className = "soma-reset";
  resetBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>';
  resetBtn.setAttribute("aria-label", "New conversation");
  resetBtn.style.display = "none";

  var closeBtn = document.createElement("button");
  closeBtn.className = "soma-close";
  closeBtn.innerHTML = closeIcon;
  closeBtn.setAttribute("aria-label", "Close chat");

  headerRight.appendChild(resetBtn);
  headerRight.appendChild(closeBtn);

  header.appendChild(headerLeft);
  header.appendChild(headerRight);
  panel.appendChild(header);

  // Messages
  var messages = document.createElement("div");
  messages.className = "soma-messages";
  panel.appendChild(messages);

  // Input bar
  var inputBar = document.createElement("div");
  inputBar.className = "soma-input-bar";
  var input = document.createElement("input");
  input.className = "soma-input";
  input.type = "text";
  input.placeholder = "Votre question...";
  input.setAttribute("aria-label", "Message");
  var sendBtn = document.createElement("button");
  sendBtn.className = "soma-send";
  sendBtn.innerHTML = sendIcon;
  sendBtn.setAttribute("aria-label", "Send message");
  inputBar.appendChild(input);
  inputBar.appendChild(sendBtn);
  panel.appendChild(inputBar);

  // Footer
  var footer = document.createElement("div");
  footer.className = "soma-footer";
  var footerLink = document.createElement("a");
  footerLink.href = "https://somastudio.xyz";
  footerLink.target = "_blank";
  footerLink.rel = "noopener noreferrer";
  footerLink.innerHTML = 'Powered by <strong>SOMA Studio</strong> \u2197';
  footer.appendChild(footerLink);
  panel.appendChild(footer);

  shadow.appendChild(panel);
  document.body.appendChild(host);

  // --- State ---
  var isOpen = false;
  var isLoading = false;
  var suggestedQuestions = [];
  var siteNameText = "Assistant";
  var welcomeText = "Posez-moi une question sur notre site !";

  // --- Fetch site config ---
  fetch(apiBase + "/api/site/" + siteId)
    .then(function (res) {
      if (!res.ok) return;
      return res.json();
    })
    .then(function (data) {
      if (!data) return;
      if (data.siteName) {
        siteNameText = data.siteName;
        headerTitle.textContent = siteNameText;
      }
      if (data.welcomeMessage) welcomeText = data.welcomeMessage;
      if (data.suggestedQuestions) suggestedQuestions = data.suggestedQuestions;
      // Update welcome if already displayed
      var wTitle = messages.querySelector(".soma-welcome-title");
      if (wTitle) wTitle.textContent = siteNameText;
      var wText = messages.querySelector(".soma-welcome-text");
      if (wText) wText.textContent = welcomeText;
      // Render suggestions if welcome is visible and suggestions arrived
      if (suggestedQuestions.length > 0 && messages.querySelector(".soma-welcome") && !messages.querySelector(".soma-suggestions")) {
        renderSuggestions();
      }
    })
    .catch(function (err) {
      console.warn("SOMA Chat: failed to load site config", err);
    });

  // --- Toggle ---
  function toggle() {
    if (window.SOMA_CHAT_AUTO_OPEN) return; // No toggling in embedded mode
    isOpen = !isOpen;
    panel.classList.toggle("open", isOpen);
    btn.innerHTML = isOpen ? closeIcon : chatIcon;
    if (isOpen) {
      input.focus();
      if (messages.children.length === 0) {
        showWelcome();
      }
    }
  }

  btn.addEventListener("click", toggle);
  closeBtn.addEventListener("click", toggle);

  // --- Escape key to close ---
  document.addEventListener("keydown", function (e) {
    if (window.SOMA_CHAT_AUTO_OPEN) return;
    if (e.key === "Escape" && isOpen) {
      toggle();
    }
  });

  // --- Welcome ---
  function showWelcome() {
    var w = document.createElement("div");
    w.className = "soma-welcome";

    var iconWrap = document.createElement("div");
    iconWrap.className = "soma-welcome-icon";
    iconWrap.innerHTML = '<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.2L4 17.2V4h16v12z"/></svg>';

    var title = document.createElement("div");
    title.className = "soma-welcome-title";
    title.textContent = siteNameText;

    var text = document.createElement("div");
    text.className = "soma-welcome-text";
    text.textContent = welcomeText;

    w.appendChild(iconWrap);
    w.appendChild(title);
    w.appendChild(text);
    messages.appendChild(w);

    if (suggestedQuestions.length > 0) {
      renderSuggestions();
    }
  }

  // --- Suggestions ---
  function renderSuggestions() {
    var container = document.createElement("div");
    container.className = "soma-suggestions";
    suggestedQuestions.forEach(function (q) {
      var pill = document.createElement("button");
      pill.className = "soma-suggestion";
      pill.textContent = q;
      pill.addEventListener("click", function () {
        sendQuestion(q);
      });
      container.appendChild(pill);
    });
    messages.appendChild(container);
  }

  function sendQuestion(text) {
    // Remove welcome + suggestions
    var welcome = messages.querySelector(".soma-welcome");
    if (welcome) welcome.remove();
    var sugg = messages.querySelector(".soma-suggestions");
    if (sugg) sugg.remove();

    input.value = text;
    send();
  }

  // --- Reset conversation ---
  resetBtn.addEventListener("click", function () {
    messages.innerHTML = "";
    resetBtn.style.display = "none";
    showWelcome();
    input.focus();
  });

  // --- Markdown rendering ---
  function applyInlineFormatting(line) {
    return line
      // Inline code: `code`
      .replace(/`([^`]+)`/g, '<code class="soma-code">$1</code>')
      // Bold (double underscore): __text__
      .replace(/__(.+?)__/g, "<strong>$1</strong>")
      // Bold (asterisks): **text**
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      // Italic: *text* (single asterisk, not preceded by another *)
      .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, "<em>$1</em>")
      // Links: [text](url)
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, function(_, text, url) {
        if (!isSafeUrl(url)) return escapeHtml(text);
        return '<a href="' + escapeHtml(url) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(text) + '</a>';
      });
  }

  function renderMarkdown(text) {
    var lines = text.split("\n");
    var result = [];
    var listBuffer = [];
    var listType = null; // 'ul' or 'ol'

    function flushList() {
      if (listBuffer.length === 0) return;
      result.push("<" + listType + ">" + listBuffer.join("") + "</" + listType + ">");
      listBuffer = [];
      listType = null;
    }

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];

      // Headings: #, ##, ###
      var headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
      if (headingMatch) {
        flushList();
        result.push('<div class="soma-heading">' + applyInlineFormatting(escapeHtml(headingMatch[2])) + "</div>");
        continue;
      }

      // Horizontal rule: ---
      if (/^-{3,}$/.test(line.trim())) {
        flushList();
        result.push('<hr class="soma-hr">');
        continue;
      }

      // Ordered list: 1. item
      var olMatch = line.match(/^\d+\.\s+(.+)$/);
      if (olMatch) {
        if (listType && listType !== "ol") flushList();
        listType = "ol";
        listBuffer.push("<li>" + applyInlineFormatting(escapeHtml(olMatch[1])) + "</li>");
        continue;
      }

      // Unordered list: - item or * item
      var ulMatch = line.match(/^[-*]\s+(.+)$/);
      if (ulMatch) {
        if (listType && listType !== "ul") flushList();
        listType = "ul";
        listBuffer.push("<li>" + applyInlineFormatting(escapeHtml(ulMatch[1])) + "</li>");
        continue;
      }

      // Not a list item — flush any pending list
      flushList();

      // Empty line
      if (line.trim() === "") {
        result.push("<br>");
        continue;
      }

      // Regular text
      result.push(applyInlineFormatting(escapeHtml(line)));
    }

    flushList();
    return result.join("\n");
  }

  // --- Add message ---
  function addMessage(role, content, sources) {
    // Remove welcome + suggestions if present
    var welcome = messages.querySelector(".soma-welcome");
    if (welcome) welcome.remove();
    var sugg = messages.querySelector(".soma-suggestions");
    if (sugg) sugg.remove();

    // Show reset button
    resetBtn.style.display = "flex";

    var msg = document.createElement("div");
    msg.className = "soma-msg soma-msg-" + role;

    if (role === "assistant") {
      msg.innerHTML = renderMarkdown(content);

      // Sources
      if (sources && sources.length > 0) {
        var srcDiv = document.createElement("div");
        srcDiv.className = "soma-sources";
        var srcTitle = document.createElement("div");
        srcTitle.className = "soma-sources-title";
        srcTitle.textContent = "Sources";
        srcDiv.appendChild(srcTitle);
        sources.forEach(function (s) {
          var a = document.createElement("a");
          a.className = "soma-source-link";
          a.href = s.url;
          a.target = "_blank";
          a.rel = "noopener noreferrer";
          a.textContent = s.title;
          srcDiv.appendChild(a);
        });
        msg.appendChild(srcDiv);
      }
    } else {
      msg.textContent = content;
    }

    messages.appendChild(msg);
    messages.scrollTop = messages.scrollHeight;
  }

  // --- Typing indicator ---
  function showTyping() {
    var t = document.createElement("div");
    t.className = "soma-typing";
    t.setAttribute("data-typing", "true");
    for (var i = 0; i < 3; i++) {
      var dot = document.createElement("div");
      dot.className = "soma-typing-dot";
      t.appendChild(dot);
    }
    messages.appendChild(t);
    messages.scrollTop = messages.scrollHeight;
  }

  function hideTyping() {
    var t = messages.querySelector("[data-typing]");
    if (t) t.remove();
  }

  // --- Send message ---
  async function send() {
    var text = input.value.trim();
    if (!text || isLoading) return;

    input.value = "";
    addMessage("user", text);
    isLoading = true;
    sendBtn.disabled = true;
    input.disabled = true;
    showTyping();

    try {
      var res = await fetch(apiBase + "/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId: siteId, message: text }),
      });

      hideTyping();

      if (!res.ok) {
        var errData = await res.json().catch(function () {
          return {};
        });
        addMessage(
          "assistant",
          errData.error || "Une erreur est survenue. Veuillez r\u00e9essayer."
        );
      } else {
        var data = await res.json();
        addMessage("assistant", data.answer, data.sources);
      }
    } catch (err) {
      hideTyping();
      addMessage("assistant", "Impossible de contacter le serveur. Veuillez r\u00e9essayer.");
    }

    isLoading = false;
    sendBtn.disabled = false;
    input.disabled = false;
    input.focus();
  }

  sendBtn.addEventListener("click", send);
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  });

  // Embedded mode: fill container, hide floating button, auto-open
  if (window.SOMA_CHAT_AUTO_OPEN) {
    btn.style.display = "none";
    panel.style.position = "static";
    panel.style.width = "100%";
    panel.style.height = "100%";
    panel.style.borderRadius = "0";
    panel.style.border = "none";
    panel.style.boxShadow = "none";
    panel.classList.add("open");
    isOpen = true;
    if (messages.children.length === 0) {
      showWelcome();
    }
  }
})();
