/* ==========================================================================
   Aevy — "Aevy" Chat Assistant
   ChatGPT-style floating assistant: streaming replies, markdown formatting,
   fuzzy + context-aware matching over a large local knowledge base, dynamic
   follow-up suggestions, and an optional pluggable live-AI backend hook.

   ---------------------------------------------------------------------
   ABOUT "ANSWER ANY QUESTION" MODE
   ---------------------------------------------------------------------
   A browser page can't safely call a paid AI API directly — any API key
   placed in this file would be visible to every visitor and could be
   stolen and abused. Real "ask me literally anything" behavior needs a
   small backend of yours that holds the API key server-side and forwards
   chat requests to a provider (Anthropic, OpenAI, etc).

   Once you have that backend, turn this widget into a full AI assistant
   in one step — set RCPM_AI_CONFIG.enabled = true and point `endpoint`
   at your server below. Until then, Rowan runs on the local knowledge
   base, which now covers far more ground and feels a lot more capable.

   Expected backend contract:
     POST {endpoint}
     body: { message: string, history: [{role:'user'|'bot', text:string}] }
     response JSON: { reply: string }
   ========================================================================== */
(function () {
  'use strict';

  const RCPM_AI_CONFIG = {
    enabled: false,        // flip to true once you have a backend deployed
    endpoint: '',          // e.g. 'https://your-server.example.com/api/chat'
    timeoutMs: 15000
  };
  window.RCPM_AI_CONFIG = window.RCPM_AI_CONFIG || RCPM_AI_CONFIG;

  const STORAGE_KEY = 'rcpm_chat_history_v2';
  const BOT_NAME = 'Aevy';
  const BOT_AVATAR = 'assets/chat-avatar.svg';

  /* ==========================================================================
     Knowledge base
     Each topic: id, keywords (phrases, weighted by word count when matched),
     reply (markdown-lite: **bold**, "- " bullets, `code`, blank-line paragraphs),
     chips (optional follow-up suggestions shown after this reply).
     ========================================================================== */
  const KB = [
    {
      id: 'greeting',
      keywords: ['hi', 'hello', 'hey', 'yo', 'sup', 'good morning', 'good evening'],
      reply: "Hey! I'm **Aevy** 👋 I can help with:\n- Car Parking Multiplayer, in general\n- Scripts, mod menus & the Games/Apps library here\n- Accounts, downloads, safety & support\n\nWhat do you need?",
      chips: ['What scripts are free?', 'Tell me about CPM', 'Is this site safe?']
    },
    {
      id: 'identity',
      keywords: ['who are you', 'are you human', 'are you real', 'are you a bot', 'are you ai', 'robot', 'your name'],
      reply: "I'm **Aevy**, Aevy's site assistant — not a real person, but built to actually help rather than just point you at a FAQ page. Ask away."
    },
    {
      id: 'about_cpm',
      keywords: ['what is cpm', 'what is car parking multiplayer', 'about the game', 'about cpm', 'tell me about cpm', 'game info', 'what is the game'],
      reply: "**Car Parking Multiplayer** is an open-world multiplayer game with:\n- Free walking, real gas stations, police mode & voice chat\n- Racing against real players online\n- 100+ cars with real interiors, 16 player skins\n- Full engine/tuning customization\n- 82 parking & driving challenges\n\nCurrent version listed here is **4.9.11** (~2 GB). Want the link?",
      chips: ['Take me to Games', 'Is there a MOD version?', 'What scripts are free?']
    },
    {
      id: 'version',
      keywords: ['version', 'update', 'latest version', 'cpm version', 'changelog', 'how often updated'],
      reply: "I don't track game versions anymore — everything on Aevy is uploaded by members, and each upload shows its own **version** and the exact date and time it was posted."
    },
    {
      id: 'mod_apk',
      keywords: ['mod apk', 'mod version', 'cpm mod', 'modded', 'unlimited money apk', 'hacked apk'],
      reply: "Members share APKs on the **Apps** page and on the Home feed. Search for the name, check the version and date, and read the comments before downloading."
    },
    {
      id: 'scripts_overview',
      keywords: ['script', 'scripts', 'lua script', 'what scripts'],
      reply: "The **Scripts** page lists scripts uploaded by members. Anyone with an account can upload their own — any file type up to 50 MB.",
      chips: ['How do I install a script?', 'What does the mod menu do?', 'Is scripting safe / bannable?']
    },
    {
      id: 'script_money',
      keywords: ['money script', 'cash script', 'infinite money', 'unlimited money', 'coins script'],
      reply: "Scripts are uploaded by members now. Search for it on the **Scripts** page or on the Home feed."
    },
    {
      id: 'script_drift',
      keywords: ['drift script', 'drifting script', 'better drift', 'drift physics'],
      reply: "Scripts are uploaded by members now. Search for it on the **Scripts** page or on the Home feed."
    },
    {
      id: 'script_unlock',
      keywords: ['car unlock script', 'unlock all cars', 'unlock cars', 'free cars script'],
      reply: "Scripts are uploaded by members now. Search for it on the **Scripts** page or on the Home feed."
    },
    {
      id: 'script_modmenu',
      keywords: ['mod menu', 'modmenu', 'what does the mod menu do', 'mod menu features'],
      reply: "Scripts are uploaded by members now. Search for it on the **Scripts** page or on the Home feed."
    },
    {
      id: 'install_script',
      keywords: ['how to install', 'install script', 'how do i install', 'how to use script', 'how to run a script', 'setup script', 'executor'],
      reply: "General flow:\n1. Open **Scripts** (or the Home feed) and download the file you want\n2. Open it with the matching executor or app\n3. Check the comments under the upload for tips"
    },
    {
      id: 'games_overview',
      keywords: ['game', 'games', 'car parking', 'download game', 'apk download'],
      reply: "The **Games** page lists games uploaded by members. You can upload one too after signing in."
    },
    {
      id: 'apps_overview',
      keywords: ['app', 'apps', 'dualspace', 'virtual mod', 'multi cloner', 'cloner', 'clone app', 'gameguardian', 'game guardian'],
      reply: "The **Apps** page lists APKs uploaded by members. Sign in to upload yours (max 50 MB).",
      chips: ['What is GameGuardian used for?', 'Is this site safe?']
    },
    {
      id: 'gameguardian',
      keywords: ['what is gameguardian', 'gameguardian used for', 'game guardian used for', 'gg app'],
      reply: "If someone uploaded it, you will find it on the **Apps** page — use the search box."
    },
    {
      id: 'pricing',
      keywords: ['free', 'price', 'cost', 'paid', 'payment', 'subscription', 'how much'],
      reply: "Everything on Aevy — every script, game and app — is **100% free**. No hidden payments, no subscriptions, no premium tier."
    },
    {
      id: 'safety',
      keywords: ['safe', 'safety', 'virus', 'secure', 'trust', 'malware', 'scam'],
      reply: "Fair question. Files here are checked before publishing and kept updated to stay compatible with the latest CPM version. Still, general good practice applies:\n- Use official pages when a direct link is given (e.g. GameGuardian's own site)\n- Be careful granting extra device permissions to anything\n- Only run scripts/executors you understand"
    },
    {
      id: 'legal',
      keywords: ['bannable', 'get banned', 'ban risk', 'is it legal', 'against tos', 'terms of service', 'risk of ban'],
      reply: "Using scripts, mod menus or modified game builds isn't something the original game developer supports, and it can go against a game's terms of service — so there's always some risk involved, even if it's rarely enforced heavily in a single-player-feeling sandbox like CPM. Use your own judgment, and consider playing on a secondary account if you're worried about your main progress."
    },
    {
      id: 'account',
      keywords: ['account', 'sign up', 'login', 'register', 'create account'],
      reply: "You don't need an account to browse or download — everything is open. Signing up (**signup.html**) just lets you save favorites and track what you've downloaded."
    },
    {
      id: 'password',
      keywords: ['forgot password', 'reset password', 'change password', "can't log in", 'cant log in', 'login issue'],
      reply: "On the **Login** page there's a \"forgot password\" option that'll walk you through resetting it. If you're still stuck, the Support page's contact form can get a human involved."
    },
    {
      id: 'bug_report',
      keywords: ['bug', 'report a bug', 'not working', 'broken', 'issue', 'problem', "doesn't work", 'stopped working'],
      reply: "Sorry about that! Best move:\n1. Go to **support.html**\n2. Pick **\"Bug Report\"**\n3. Include your device, the CPM version, and steps to reproduce\n\nIf a script broke after a game update, it's usually patched within 24–48 hours."
    },
    {
      id: 'request',
      keywords: ['request', 'suggest', 'feature request', 'add a script', 'can you add', 'suggestion'],
      reply: "Use the contact form on **support.html** and choose **\"Script / Game / App Request.\"** Popular requests get prioritized."
    },
    {
      id: 'contact',
      keywords: ['contact', 'support', 'help', 'discord', 'human support', 'talk to someone', 'reach the team'],
      reply: "You can reach the team through the contact form on **support.html**, or join the **Discord community** (20K+ members) linked right there too."
    },
    {
      id: 'device',
      keywords: ['device', 'compatible', 'requirements', 'android version', 'will it work on my phone', 'ios', 'iphone'],
      reply: "Everything here targets **Android**. Most scripts and apps need a reasonably recent Android version — if a specific download has extra requirements, they're listed on its page (scripts.html / games.html / apps.html). There's no iOS support at the moment."
    },
    {
      id: 'thanks',
      keywords: ['thanks', 'thank you', 'thx', 'appreciate it', 'cheers'],
      reply: "Anytime! Let me know if anything else comes up. 🙌"
    },
    {
      id: 'bye',
      keywords: ['bye', 'goodbye', 'see you', 'later', 'gtg'],
      reply: "See you around! I'll be right here in the corner if you need anything else. 👋"
    },
    {
      id: 'meta_capability',
      keywords: ['what can you do', 'what do you know', 'help me', 'can you help'],
      reply: "I know this site well — every script, game, app and support flow — and I can talk through general Car Parking Multiplayer questions too. Try asking something specific, like \"how do I install the mod menu script\" or \"is GameGuardian safe.\"",
      chips: ['What scripts are free?', 'Tell me about CPM', 'Contact support']
    }
  ];

  const FALLBACK_REPLIES = [
    "I don't have a confident answer for that one. I'm most useful for questions about **Car Parking Multiplayer** or what's here on Aevy (scripts, games, apps, account, support) — want to try rephrasing, or head to **support.html** for a human?",
    "Hmm, I'm not sure about that. Could you rephrase, or ask about a specific script, game, app, or account/support topic?",
    "Not totally following — I'm strongest on CPM and this site's downloads. If this is something else entirely, the Support page can loop in the team."
  ];

  const QUICK_CHIPS = [
    'What scripts are free?',
    'Tell me about CPM',
    'Is this site safe?',
    'Contact support'
  ];

  /* ---------------- Fuzzy, context-aware matching ---------------- */
  function levenshtein(a, b) {
    if (a === b) return 0;
    const al = a.length, bl = b.length;
    if (!al) return bl;
    if (!bl) return al;
    let prev = Array(bl + 1).fill(0).map((_, i) => i);
    for (let i = 1; i <= al; i++) {
      const row = [i];
      for (let j = 1; j <= bl; j++) {
        row[j] = a[i - 1] === b[j - 1]
          ? prev[j - 1]
          : 1 + Math.min(prev[j - 1], prev[j], row[j - 1]);
      }
      prev = row;
    }
    return prev[bl];
  }

  function tokenize(str) {
    return str.toLowerCase().replace(/[^a-z0-9\s']/g, ' ').split(/\s+/).filter(Boolean);
  }

  function scoreEntry(msgTokens, msgRaw, entry) {
    let score = 0;
    for (const kw of entry.keywords) {
      if (msgRaw.includes(kw)) {
        score += kw.split(' ').length * 2; // exact phrase match, weighted by length
        continue;
      }
      const kwTokens = kw.split(' ');
      let hits = 0;
      for (const kt of kwTokens) {
        for (const mt of msgTokens) {
          if (mt === kt) { hits++; break; }
          if (kt.length > 3 && mt.length > 3 && levenshtein(mt, kt) <= 1) { hits += 0.7; break; } // typo tolerance
        }
      }
      if (hits >= kwTokens.length * 0.6) score += hits;
    }
    return score;
  }

  function findTopic(userText) {
    const msgRaw = userText.toLowerCase();
    const msgTokens = tokenize(userText);
    let best = null, bestScore = 0;
    for (const entry of KB) {
      const s = scoreEntry(msgTokens, msgRaw, entry);
      if (s > bestScore) { bestScore = s; best = entry; }
    }
    return bestScore > 0 ? best : null;
  }

  // Short, ambiguous follow-ups ("how much?", "is it free?") get resolved
  // against whatever topic the conversation was just on.
  const FOLLOWUP_HINTS = ['it', 'that', 'this', 'those', 'them'];
  function isLikelyFollowUp(msgTokens) {
    return msgTokens.length <= 5 && msgTokens.some((t) => FOLLOWUP_HINTS.includes(t));
  }

  function getReply(userText, lastTopicId) {
    const direct = findTopic(userText);
    if (direct) return direct;
    const msgTokens = tokenize(userText);
    if (lastTopicId && isLikelyFollowUp(msgTokens)) {
      const prior = KB.find((k) => k.id === lastTopicId);
      if (prior) return prior;
    }
    return null;
  }

  async function getAiReply(userText, history) {
    const cfg = window.RCPM_AI_CONFIG;
    if (!cfg || !cfg.enabled || !cfg.endpoint) return null;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), cfg.timeoutMs || 15000);
    try {
      const res = await fetch(cfg.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userText, history }),
        signal: controller.signal
      });
      clearTimeout(timer);
      if (!res.ok) return null;
      const data = await res.json();
      return typeof data.reply === 'string' && data.reply.trim() ? data.reply.trim() : null;
    } catch (e) {
      clearTimeout(timer);
      return null;
    }
  }

  /* ==========================================================================
     Minimal markdown → safe HTML (bold, bullets, inline code, line breaks).
     ========================================================================== */
  function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function renderMarkdown(raw) {
    const lines = escapeHtml(raw).split('\n');
    let html = '';
    let inList = false;
    for (const line of lines) {
      const bullet = /^-\s+(.*)/.exec(line);
      const numbered = /^(\d+)\.\s+(.*)/.exec(line);
      if (bullet || numbered) {
        if (!inList) { html += '<ul>'; inList = true; }
        html += `<li>${inlineMd(bullet ? bullet[1] : numbered[2])}</li>`;
        continue;
      }
      if (inList) { html += '</ul>'; inList = false; }
      if (line.trim() === '') { html += '<br>'; continue; }
      html += `<p>${inlineMd(line)}</p>`;
    }
    if (inList) html += '</ul>';
    return html;
  }

  function inlineMd(text) {
    return text
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code>$1</code>');
  }

  /* ---------------- DOM construction ---------------- */
  function el(html) {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  function build() {
    const launcher = el(`
      <button class="rcpm-chat-launcher" aria-label="Open chat assistant" aria-expanded="false">
        <span class="rcpm-chat-launcher__dot"></span>
        <svg class="rcpm-chat-launcher__chat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
        <svg class="rcpm-chat-launcher__close-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
    `);

    const panel = el(`
      <div class="rcpm-chat-panel" role="dialog" aria-label="Chat with Aevy">
        <div class="rcpm-chat-head">
          <span class="rcpm-chat-head__avatar"><img src="${BOT_AVATAR}" alt="${BOT_NAME}"></span>
          <div class="rcpm-chat-head__info">
            <strong>${BOT_NAME} · Aevy Assistant</strong>
            <span class="rcpm-chat-head__status">Online now</span>
          </div>
          <button class="rcpm-chat-head__new" aria-label="New conversation" title="New conversation">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
          </button>
          <button class="rcpm-chat-head__close" aria-label="Close chat"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
        </div>
        <div class="rcpm-chat-body"></div>
        <div class="rcpm-chips"></div>
        <div class="rcpm-chat-input">
          <textarea rows="1" placeholder="Ask about CPM, scripts, games…" maxlength="500" aria-label="Type a message"></textarea>
          <button type="button" aria-label="Send message">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
          </button>
        </div>
      </div>
    `);

    document.body.appendChild(launcher);
    document.body.appendChild(panel);
    return { launcher, panel };
  }

  /* ---------------- History persistence ---------------- */
  function loadHistory() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  }
  function saveHistory(history) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(-40))); } catch (e) { /* ignore */ }
  }

  /* ---------------- Widget logic ---------------- */
  function init() {
    const { launcher, panel } = build();
    const body = panel.querySelector('.rcpm-chat-body');
    const chipsWrap = panel.querySelector('.rcpm-chips');
    const input = panel.querySelector('textarea');
    const sendBtn = panel.querySelector('.rcpm-chat-input button');
    const closeBtn = panel.querySelector('.rcpm-chat-head__close');
    const newBtn = panel.querySelector('.rcpm-chat-head__new');
    const dot = launcher.querySelector('.rcpm-chat-launcher__dot');

    let history = loadHistory();
    let isOpen = false;
    let hasGreeted = history.length > 0;
    let lastTopicId = null;

    function autosize() {
      input.style.height = 'auto';
      input.style.height = Math.min(110, input.scrollHeight) + 'px';
    }

    function renderMessage(role, text, persist) {
      const isBot = role === 'bot';
      const msgEl = el(`
        <div class="rcpm-msg rcpm-msg--${isBot ? 'bot' : 'user'}">
          ${isBot ? `<span class="rcpm-msg__avatar"><img src="${BOT_AVATAR}" alt=""></span>` : ''}
          <span class="rcpm-msg__bubble"></span>
        </div>
      `);
      const bubble = msgEl.querySelector('.rcpm-msg__bubble');
      if (isBot) {
        bubble.innerHTML = renderMarkdown(text);
        const copyBtn = el(`<button type="button" class="rcpm-msg__copy" aria-label="Copy message" title="Copy">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
        </button>`);
        copyBtn.addEventListener('click', () => {
          navigator.clipboard && navigator.clipboard.writeText(text).catch(() => {});
          copyBtn.classList.add('copied');
          setTimeout(() => copyBtn.classList.remove('copied'), 1200);
        });
        bubble.appendChild(copyBtn);
      } else {
        bubble.textContent = text;
      }
      body.appendChild(msgEl);
      body.scrollTop = body.scrollHeight;
      if (persist) {
        history.push({ role, text, t: Date.now() });
        saveHistory(history);
      }
      return bubble;
    }

    // Streams a bot reply into a fresh bubble word-by-word, ChatGPT-style.
    function streamReply(text, onDone) {
      const bubbleWrap = el(`
        <div class="rcpm-msg rcpm-msg--bot">
          <span class="rcpm-msg__avatar"><img src="${BOT_AVATAR}" alt=""></span>
          <span class="rcpm-msg__bubble"></span>
        </div>
      `);
      body.appendChild(bubbleWrap);
      const bubble = bubbleWrap.querySelector('.rcpm-msg__bubble');
      const words = text.split(/(\s+)/);
      let i = 0;
      let shown = '';
      const step = () => {
        shown += words[i] || '';
        bubble.innerHTML = renderMarkdown(shown) + '<span class="rcpm-caret"></span>';
        body.scrollTop = body.scrollHeight;
        i++;
        if (i < words.length) {
          setTimeout(step, 14 + Math.random() * 22);
        } else {
          bubble.innerHTML = renderMarkdown(text);
          onDone && onDone(bubble);
        }
      };
      step();
    }

    function renderChips(list) {
      chipsWrap.innerHTML = '';
      (list && list.length ? list : QUICK_CHIPS).forEach((label) => {
        const chip = el(`<button type="button" class="rcpm-chip">${escapeHtml(label)}</button>`);
        chip.addEventListener('click', () => sendUserMessage(label));
        chipsWrap.appendChild(chip);
      });
    }

    function showTyping() {
      const t = el(`
        <div class="rcpm-msg rcpm-msg--bot rcpm-msg--typing">
          <span class="rcpm-msg__avatar"><img src="${BOT_AVATAR}" alt=""></span>
          <span class="rcpm-msg__bubble"><span class="rcpm-typing"><span></span><span></span><span></span></span></span>
        </div>
      `);
      body.appendChild(t);
      body.scrollTop = body.scrollHeight;
      return t;
    }

    async function sendUserMessage(text) {
      const clean = text.trim();
      if (!clean) return;
      renderMessage('user', clean, true);
      input.value = '';
      autosize();
      sendBtn.disabled = true;
      chipsWrap.innerHTML = '';

      const typingEl = showTyping();
      const thinkStart = Date.now();

      // Prefer a live AI backend if configured; otherwise use the local KB.
      let replyText = await getAiReply(clean, history.slice(-10));
      let matchedTopic = null;
      if (!replyText) {
        matchedTopic = getReply(clean, lastTopicId);
        replyText = matchedTopic
          ? matchedTopic.reply
          : FALLBACK_REPLIES[Math.floor(Math.random() * FALLBACK_REPLIES.length)];
      }
      if (matchedTopic) lastTopicId = matchedTopic.id;

      const minDelay = 500;
      const elapsed = Date.now() - thinkStart;
      setTimeout(() => {
        typingEl.remove();
        streamReply(replyText, () => {
          history.push({ role: 'bot', text: replyText, t: Date.now() });
          saveHistory(history);
          sendBtn.disabled = false;
          input.focus();
          renderChips(matchedTopic && matchedTopic.chips ? matchedTopic.chips : QUICK_CHIPS);
        });
      }, Math.max(0, minDelay - elapsed));
    }

    function restoreHistory() {
      if (!history.length) return;
      history.forEach((m) => renderMessage(m.role, m.text, false));
    }

    function greet() {
      const typingEl = showTyping();
      setTimeout(() => {
        typingEl.remove();
        const greetText = `Hey there! I'm ${BOT_NAME} 👋 Ask me anything about Aevy — apps, scripts, games, your account or messages.`;
        streamReply(greetText, () => {
          history.push({ role: 'bot', text: greetText, t: Date.now() });
          saveHistory(history);
        });
      }, 500);
      hasGreeted = true;
    }

    function clearConversation() {
      history = [];
      lastTopicId = null;
      saveHistory(history);
      body.innerHTML = '';
      hasGreeted = false;
      greet();
      renderChips(QUICK_CHIPS);
    }

    function openPanel() {
      isOpen = true;
      panel.classList.add('open');
      launcher.classList.add('open');
      launcher.setAttribute('aria-expanded', 'true');
      dot.classList.add('hide');
      if (!hasGreeted) greet();
      setTimeout(() => input.focus(), 250);
    }
    function closePanel() {
      isOpen = false;
      panel.classList.remove('open');
      launcher.classList.remove('open');
      launcher.setAttribute('aria-expanded', 'false');
    }

    launcher.addEventListener('click', () => (isOpen ? closePanel() : openPanel()));
    closeBtn.addEventListener('click', closePanel);
    newBtn.addEventListener('click', clearConversation);
    sendBtn.addEventListener('click', () => sendUserMessage(input.value));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendUserMessage(input.value);
      }
    });
    input.addEventListener('input', () => {
      sendBtn.disabled = !input.value.trim();
      autosize();
    });
    sendBtn.disabled = true;

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isOpen) closePanel();
    });

    // Let any element on the page open the assistant via data-open-chat.
    document.querySelectorAll('[data-open-chat]').forEach((trigger) => {
      trigger.addEventListener('click', (e) => {
        e.preventDefault();
        openPanel();
      });
    });

    renderChips(QUICK_CHIPS);
    restoreHistory();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
