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
      display: none;
      flex-direction: column;
      overflow: hidden;
      box-shadow: 0 8px 48px rgba(0,0,0,0.6);
      z-index: 2147483647;
    }
    .soma-panel.open { display: flex; }

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
    .soma-header-title {
      font-weight: 600;
      font-size: 15px;
      color: #f0f0f3;
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
    .soma-msg-assistant li { margin-bottom: 2px; }

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
      padding: 6px 16px 10px;
      background: #111118;
    }
    .soma-footer a {
      font-size: 11px;
      color: #55556a;
      text-decoration: none;
    }
    .soma-footer a:hover { color: #8b8b9e; }

    .soma-welcome {
      text-align: center;
      color: #8b8b9e;
      font-size: 13px;
      padding: 24px 16px;
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
  var headerTitle = document.createElement("span");
  headerTitle.className = "soma-header-title";
  headerTitle.textContent = "Assistant";
  var closeBtn = document.createElement("button");
  closeBtn.className = "soma-close";
  closeBtn.innerHTML = closeIcon;
  closeBtn.setAttribute("aria-label", "Close chat");
  header.appendChild(headerTitle);
  header.appendChild(closeBtn);
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
  footerLink.textContent = "Powered by SOMA Studio";
  footer.appendChild(footerLink);
  panel.appendChild(footer);

  shadow.appendChild(panel);
  document.body.appendChild(host);

  // --- State ---
  var isOpen = false;
  var isLoading = false;

  // --- Fetch site config ---
  var welcomeText = "Posez-moi une question sur notre site !";
  fetch(apiBase + "/api/site/" + siteId)
    .then(function (res) {
      if (!res.ok) return;
      return res.json();
    })
    .then(function (data) {
      if (!data) return;
      if (data.siteName) headerTitle.textContent = data.siteName;
      if (data.welcomeMessage) welcomeText = data.welcomeMessage;
      // Update welcome message if already displayed
      var w = messages.querySelector(".soma-welcome");
      if (w) w.textContent = welcomeText;
    })
    .catch(function () {});

  // --- Toggle ---
  function toggle() {
    isOpen = !isOpen;
    panel.classList.toggle("open", isOpen);
    if (isOpen) {
      input.focus();
      if (messages.children.length === 0) {
        showWelcome();
      }
    }
  }

  btn.addEventListener("click", toggle);
  closeBtn.addEventListener("click", toggle);

  // --- Welcome ---
  function showWelcome() {
    var w = document.createElement("div");
    w.className = "soma-welcome";
    w.textContent = welcomeText;
    messages.appendChild(w);
  }

  // --- Markdown rendering ---
  function renderMarkdown(text) {
    return text
      // Bold: **text**
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      // Italic: *text*
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      // Links: [text](url)
      .replace(
        /\[([^\]]+)\]\(([^)]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
      )
      // Unordered list items: - item
      .replace(/^- (.+)$/gm, "<li>$1</li>")
      // Wrap consecutive <li> in <ul>
      .replace(/((?:<li>.+<\/li>\n?)+)/g, "<ul>$1</ul>")
      // Line breaks
      .replace(/\n/g, "<br>");
  }

  // --- Add message ---
  function addMessage(role, content, sources) {
    // Remove welcome message if present
    var welcome = messages.querySelector(".soma-welcome");
    if (welcome) welcome.remove();

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
          errData.error || "Une erreur est survenue. Veuillez réessayer."
        );
      } else {
        var data = await res.json();
        addMessage("assistant", data.answer, data.sources);
      }
    } catch (err) {
      hideTyping();
      addMessage("assistant", "Impossible de contacter le serveur. Veuillez réessayer.");
    }

    isLoading = false;
    sendBtn.disabled = false;
    input.focus();
  }

  sendBtn.addEventListener("click", send);
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  });
})();
