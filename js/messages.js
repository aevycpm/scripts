/* Aevy messages page: inbox + chat (end-to-end encrypted, live, read receipts, typing, online status). */
(function () {
  'use strict';
  var A = window.RowanAuth, C = window.RowanCore, S = window.RowanSocial, esc = C.esc;
  function $(s, r) { return (r || document).querySelector(s); }
  function me() { return A.current(); }
  var cur = null, tab = 'all';
  function hm(t) { try { return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(t)); } catch (e) { return ''; } }
  function clock(t) {
    var d = new Date(t), n = new Date();
    try {
      if (d.toDateString() === n.toDateString()) return hm(t);
      if (n - d < 6 * 864e5) return new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(d);
      return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(d);
    } catch (e) { return ''; }
  }
  function dayLabel(t) {
    var d = new Date(t), n = new Date(), y = new Date(n.getTime() - 864e5);
    if (d.toDateString() === n.toDateString()) return 'Today';
    if (d.toDateString() === y.toDateString()) return 'Yesterday';
    return C.fmtDate(t);
  }
  function rich(s) { return esc(s).replace(/(https?:\/\/[^\s<]*[^\s<.,;:!?)\]'"])/g, function (u) { return '<a href="' + u + '" target="_blank" rel="noopener noreferrer nofollow">' + u + '</a>'; }); }

  /* ---------- message envelope (inside the encrypted text): reply marker + file marker + caption ---------- */
  var CFG = window.ROWAN_CONFIG || {}, MAXF = 12 * 1024 * 1024, REACTS = ['❤️', '😂', '😮', '😢', '👍', '🔥'];
  var EMOJI = '😀 😁 😂 🤣 😊 😍 🥰 😘 😎 🤩 😏 😢 😭 😡 🤔 😴 😮 😱 🙏 👍 👎 👏 🙌 💪 🔥 ❤️ 💔 💜 ✨ 🎉 🚗 🏎️ 💰 🎮 🚀 👀 💯 ✅'.split(' ');
  function b64u(str) { var b = new TextEncoder().encode(str), s2 = ''; for (var i = 0; i < b.length; i++) s2 += String.fromCharCode(b[i]); return btoa(s2).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function unb64u(t) { var s2 = atob(t.replace(/-/g, '+').replace(/_/g, '/')), u = new Uint8Array(s2.length); for (var i = 0; i < s2.length; i++) u[i] = s2.charCodeAt(i); return new TextDecoder().decode(u); }
  var parsed = {};
  function parse(body) {
    body = String(body || ''); if (parsed[body]) return parsed[body];
    var o = { reply: '', file: null, text: body }, m = /^⟦r:([0-9a-f-]{36})⟧\n?/.exec(o.text);
    if (m) { o.reply = m[1]; o.text = o.text.slice(m[0].length); }
    m = /^⟦f:([A-Za-z0-9_=-]+)⟧\n?/.exec(o.text);
    if (m) {
      try { var f = JSON.parse(unb64u(m[1])); if (f && typeof f.u === 'string' && f.u.indexOf((CFG.url || '') + '/storage/v1/object/public/chat/') === 0 && f.k && f.i) { o.file = f; o.text = o.text.slice(m[0].length); } } catch (e) {}
    }
    if (Object.keys(parsed).length > 800) parsed = {};
    return (parsed[body] = o);
  }
  function isImg(f) { return /^image\/(png|jpeg|gif|webp)$/.test(f.t || ''); }
  function snippet(m) {
    if (m.locked) return 'Encrypted message';
    var o = parse(m.body); if (o.file) return (isImg(o.file) ? '📷 Photo' : '📎 ' + (o.file.n || 'File')) + (o.text ? ' ' + o.text : '');
    return o.text;
  }
  /* ---------- encrypted attachments (AES-GCM in the browser; key stays inside the encrypted message) ---------- */
  function toB64(buf) { var u = new Uint8Array(buf), s2 = ''; for (var i = 0; i < u.length; i++) s2 += String.fromCharCode(u[i]); return btoa(s2); }
  function fromB64(t) { var s2 = atob(t), u = new Uint8Array(s2.length); for (var i = 0; i < s2.length; i++) u[i] = s2.charCodeAt(i); return u; }
  function encryptFile(file, rid) {
    var sb = window.RowanSB.client, iv = crypto.getRandomValues(new Uint8Array(12)), key, path = me().id + '/' + (crypto.randomUUID ? crypto.randomUUID() : Date.now() + '' + Math.random().toString(16).slice(2)) + '.bin';
    return Promise.all([crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt']), file.arrayBuffer()]).then(function (r) {
      key = r[0]; return crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, r[1]);
    }).then(function (ct) {
      return sb.storage.from('chat').upload(path, new Blob([ct], { type: 'application/octet-stream' }), { contentType: 'application/octet-stream', upsert: false });
    }).then(function (u) {
      if (u.error) throw new Error(/bucket not found/i.test(u.error.message || '') ? 'File sharing is not set up. Run the latest supabase/schema.sql' : (u.error.message || 'Upload failed'));
      return crypto.subtle.exportKey('raw', key);
    }).then(function (raw) {
      return { u: sb.storage.from('chat').getPublicUrl(path).data.publicUrl, k: toB64(raw), i: toB64(iv), n: file.name.slice(0, 120), t: file.type || '', z: file.size, p: path };
    });
  }
  var blobs = {}, inflight = {};
  function fileURL(f) {
    if (blobs[f.u]) return Promise.resolve(blobs[f.u]);
    if (inflight[f.u]) return inflight[f.u];
    return (inflight[f.u] = fetch(f.u).then(function (r) { if (!r.ok) throw new Error('missing'); return r.arrayBuffer(); }).then(function (ab) {
      return crypto.subtle.importKey('raw', fromB64(f.k), 'AES-GCM', false, ['decrypt']).then(function (k) { return crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(f.i) }, k, ab); });
    }).then(function (pt) { var url = URL.createObjectURL(new Blob([pt], { type: isImg(f) ? f.t : 'application/octet-stream' })); blobs[f.u] = url; delete inflight[f.u]; return url; }, function (e) { delete inflight[f.u]; throw e; }));
  }
  function hydrate() {
    Array.prototype.forEach.call(document.querySelectorAll('#m-thread [data-fu]'), function (el) {
      var m = S.pair(cur).filter(function (x) { return x.id === el.dataset.fm; })[0], o = m && parse(m.body); if (!o || !o.file) return;
      fileURL(o.file).then(function (url) {
        if (!document.body.contains(el)) return;
        if (el.tagName === 'IMG') { el.src = url; el.classList.add('ok'); } else { el.href = url; el.setAttribute('download', (o.file.n || 'file').replace(/[^\w.\- ]/g, '_')); el.classList.remove('wait'); }
      }, function () { el.outerHTML = '<span class="im-gone">File unavailable</span>'; });
    });
  }

  /* ---------- conversation list ---------- */
  function drawList() {
    var q = ($('#m-search').value || '').toLowerCase().trim(), box = $('#m-convos'), cs = S.convos();
    var html = '';
    if (q) {
      var found = A.all().filter(function (u) { return me() && u.id !== me().id && (u.name + ' ' + u.username).toLowerCase().indexOf(q) > -1; }).slice(0, 12);
      html = found.map(function (u) { return '<button class="rc-conv" data-chat="' + esc(u.id) + '">' + C.avatar(u, 48) + '<span class="rc-grow"><b>' + esc(u.name) + '</b><div class="snip">@' + esc(u.username) + '</div></span></button>'; }).join('') || '<p class="rc-empty">No one found.</p>';
    } else {
      if (tab === 'unread') cs = cs.filter(function (c) { return c.n; });
      html = cs.map(function (c) {
        var u = A.byId(c.id), on = S.isOnline(c.id);
        return '<button class="rc-conv' + (cur === c.id ? ' active' : '') + (c.n ? ' im-unread' : '') + '" data-chat="' + esc(c.id) + '">' + C.avatar(u, 52).replace('class="rc-av"', 'class="rc-av' + (on ? ' on' : '') + '"') +
          '<span class="rc-grow"><span class="t"><b>' + esc(u.name) + '</b></span><div class="snip">' + (c.last.s === me().id ? 'You: ' : '') + esc(snippet(c.last)) + ' · ' + clock(c.last.t) + '</div></span>' +
          (c.n ? '<span class="unread">' + c.n + '</span>' : '') + '</button>';
      }).join('') || '<p class="rc-empty">No conversations yet.<br>Search a name above to start one.</p>';
    }
    box.innerHTML = html;
  }
  function drawHead() {
    var u = A.byId(cur); if (!u) return;
    var on = S.isOnline(cur), st = on ? 'Active now' : S.lastSeen(cur);
    $('#m-head').innerHTML = '<button class="im-iconbtn rc-back" data-back aria-label="Back">←</button><a class="rc-who" href="user.html?u=' + encodeURIComponent(u.username) + '">' + C.avatar(u, 44).replace('class="rc-av"', 'class="rc-av' + (on ? ' on' : '') + '"') +
      '<span><b>' + esc(u.name) + C.badge(u) + '</b><small>' + esc(st || '@' + u.username) + '</small></span></a><span class="rc-grow"></span><a class="btn btn-secondary btn-sm" href="user.html?u=' + encodeURIComponent(u.username) + '">View profile</a>';
  }

  /* ---------- thread ---------- */
  var replyTo = null, selId = '', attach = null, uploading = false;
  function reactHTML(m) {
    var r = S.reactionsOf(m.id), ids = Object.keys(r); if (!ids.length) return '';
    var by = {}; ids.forEach(function (u) { by[r[u]] = (by[r[u]] || 0) + (u === me().id ? 0.001 : 1); });
    var mine = r[me().id];
    return '<div class="im-reacts">' + Object.keys(by).map(function (e) { var n = Math.round(by[e]); return '<button type="button" class="im-chip' + (mine === e ? ' mine' : '') + '" data-react="' + esc(m.id) + '" data-e="' + esc(e) + '">' + esc(e) + (n > 1 ? ' ' + n : '') + '</button>'; }).join('') + '</div>';
  }
  function bodyHTML(m) {
    if (m.locked) return 'Locked message. Unlock your messages to read it.';
    var o = parse(m.body), h = '';
    if (o.file) {
      if (isImg(o.file)) h += '<a class="im-img" data-fm="' + esc(m.id) + '" data-fu="1" href="#" target="_blank"><img data-fm="' + esc(m.id) + '" data-fu="1" ' + (blobs[o.file.u] ? 'src="' + blobs[o.file.u] + '" class="ok"' : '') + ' alt="Photo"></a>';
      else h += '<a class="im-doc wait" data-fm="' + esc(m.id) + '" data-fu="1" href="#"><span class="im-doc__i">📎</span><span><b>' + esc(o.file.n || 'File') + '</b><small>' + fmtSize(o.file.z) + '</small></span></a>';
    }
    if (o.text) h += '<span class="im-txt' + (!o.file && /^(\p{Extended_Pictographic}|️|‍|\s){1,6}$/u.test(o.text) ? ' im-big' : '') + '">' + rich(o.text) + '</span>';
    return h;
  }
  function fmtSize(n) { return n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round((n || 0) / 1024)) + ' KB'; }
  function drawThread(stick) {
    if (!cur) return;
    var box = $('#m-thread'), atEnd = box.scrollHeight - box.scrollTop - box.clientHeight < 90, list = S.pair(cur), html = '', last = '', mid = me().id, other = A.byId(cur);
    var lastMine = -1; list.forEach(function (m, i) { if (m.s === mid && !m.pending) lastMine = i; });
    var byId = {}; list.forEach(function (m) { byId[m.id] = m; });
    list.forEach(function (m, i) {
      var d = dayLabel(m.t); if (d !== last) { html += '<div class="rc-day">' + d + ' · ' + hm(m.t) + '</div>'; last = d; }
      var mine = m.s === mid, prev = list[i - 1], next = list[i + 1];
      var first = !prev || prev.s !== m.s || m.t - prev.t > 5 * 60000 || dayLabel(prev.t) !== d, end = !next || next.s !== m.s || next.t - m.t > 5 * 60000 || dayLabel(next.t) !== d;
      var o = m.locked ? { reply: '' } : parse(m.body), q = o.reply && byId[o.reply], qh = '';
      if (o.reply) qh = '<div class="im-quote" data-jump="' + esc(o.reply) + '"><small>' + (q ? (q.s === mid ? 'You' : esc(other.name)) : 'Message') + '</small><span>' + (q ? esc(snippet(q)).slice(0, 90) : 'Original message unavailable') + '</span></div>';
      var acts = m.pending ? '' : '<div class="im-acts"><button type="button" data-pop="' + esc(m.id) + '" title="React">😊</button><button type="button" data-reply="' + esc(m.id) + '" title="Reply">↩</button>' + (mine ? '<button type="button" data-unsend="' + esc(m.id) + '" title="Unsend">🗑</button>' : '') + '</div>';
      var cls = 'im-row ' + (mine ? 'me' : 'them') + (first ? ' first' : '') + (end ? ' end' : '') + (selId === m.id ? ' sel' : '');
      html += '<div class="' + cls + '" data-mid="' + esc(m.id) + '">' + (!mine ? (end ? C.avatar(other, 28) : '<span class="im-sp"></span>') : '') +
        '<div class="im-col">' + qh + '<div class="im-bub' + (m.pending ? ' pending' : '') + (m.locked ? ' lost' : '') + (o.file && !o.text ? ' media' : '') + '">' + bodyHTML(m) + '</div>' + reactHTML(m) + '</div>' + acts + '</div>';
      if (mine && i === lastMine) html += '<div class="im-status">' + (m.read ? 'Seen' : 'Sent') + ' · ' + hm(m.t) + '</div>';
    });
    box.innerHTML = html || '<div class="im-hello">' + C.avatar(other, 84) + '<b>' + esc(other.name) + '</b><span class="rc-muted">@' + esc(other.username) + '</span><span class="rc-muted">Say hello 👋</span></div>';
    if (stick || atEnd) box.scrollTop = box.scrollHeight;
    typingUI(); hydrate();
  }
  function typingUI() { $('#m-typing').innerHTML = cur && S.isTyping(cur) ? '<span class="im-dots"><i></i><i></i><i></i></span> ' + esc(A.byId(cur).name) + ' is typing' : ''; }
  function bar() { var e = window.RowanE2E; $('#m-e2e').innerHTML = e ? e.banner() : ''; }

  /* ---------- composer ---------- */
  function syncSend() {
    var has = !!($('#m-input').value.trim() || attach), b = $('#m-send');
    b.classList.toggle('heart', !has); b.innerHTML = has ? '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M2 21l21-9L2 3v7l15 2-15 2z"/></svg>' : '❤️'; b.setAttribute('aria-label', has ? 'Send' : 'Send a heart');
    b.disabled = uploading;
  }
  function drawReplyBar() {
    var el = $('#m-replybar'); if (!replyTo) { el.hidden = true; return; }
    var m = S.pair(cur).filter(function (x) { return x.id === replyTo; })[0]; if (!m) { replyTo = null; el.hidden = true; return; }
    el.hidden = false; el.innerHTML = '<div><small>Replying to ' + (m.s === me().id ? 'yourself' : esc(A.byId(m.s).name)) + '</small><span>' + esc(snippet(m)).slice(0, 100) + '</span></div><button type="button" class="im-iconbtn" data-cancel-reply aria-label="Cancel reply">×</button>';
  }
  function drawAttach() {
    var el = $('#m-attach'); if (!attach) { el.hidden = true; el.innerHTML = ''; return; }
    el.hidden = false;
    el.innerHTML = '<span class="im-chipf">' + (/^image\//.test(attach.type) ? '🖼 ' : '📎 ') + esc(attach.name) + ' (' + fmtSize(attach.size) + ')<button type="button" data-cancel-attach aria-label="Remove">×</button></span>';
  }
  function open(id) {
    var u = A.byId(id); if (!u || !me()) return;
    if (cur !== id) { replyTo = null; attach = null; selId = ''; }
    cur = id; $('#m-empty').hidden = true; $('#m-chat').hidden = false; $('#m-box').classList.add('open');
    drawHead(); drawThread(true); drawList(); bar(); drawReplyBar(); drawAttach(); syncSend();
    S.pollOnline([id]);
    S.loadPair(id).then(function () { drawThread(true); S.loadReactions(id); if (S.unreadFrom(id)) S.markRead(id); });
    if (S.unreadFrom(id)) S.markRead(id);
    history.replaceState(null, '', 'messages.html?to=' + encodeURIComponent(u.username));
    if (window.innerWidth > 760) $('#m-input').focus();
  }
  function fail(e) {
    uploading = false; syncSend();
    C.toast((e && e.message) || 'Could not send', 'error');
    if (e && e.code === 'locked' && window.RowanE2E) RowanE2E.prompt(true);
  }
  function send() {
    if (uploading) return;
    var inp = $('#m-input'), text = inp.value.trim(), f = attach;
    if (!cur) return;
    if (!text && !f) text = '❤️';
    if (text.length > 1500) return C.toast('Messages are limited to 1500 characters', 'error');
    var to = cur, rp = replyTo, go = function (env) {
      var body = (rp ? '⟦r:' + rp + '⟧\n' : '') + (env ? '⟦f:' + b64u(JSON.stringify(env)) + '⟧\n' : '') + text;
      inp.value = ''; inp.style.height = ''; replyTo = null; attach = null; drawReplyBar(); drawAttach(); uploading = false; syncSend();
      var p = S.send(to, body); drawThread(true);
      p.then(function () { drawThread(true); drawList(); }, function (e) { inp.value = text; syncSend(); fail(e); });
    };
    if (!f) return go(null);
    uploading = true; syncSend(); $('#m-attach').innerHTML = '<span class="im-chipf">Uploading ' + esc(f.name) + '…</span>';
    encryptFile(f.file, to).then(go, fail);
  }
  function pickFile(file) {
    if (!file) return;
    if (file.size > MAXF) return C.toast('Files are limited to 12 MB', 'error');
    attach = { file: file, name: file.name, size: file.size, type: file.type || '' }; drawAttach(); syncSend();
    if (window.innerWidth > 760) $('#m-input').focus();
  }
  /* ---------- reaction pop-up ---------- */
  function pop(btn, mid) {
    var el = $('#im-pop'), r = btn.getBoundingClientRect(), mine = S.reactionsOf(mid)[me().id];
    el.innerHTML = REACTS.map(function (e) { return '<button type="button" data-react="' + esc(mid) + '" data-e="' + esc(e) + '"' + (mine === e ? ' class="on"' : '') + '>' + e + '</button>'; }).join('');
    el.hidden = false; var w = el.offsetWidth;
    el.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2)) + 'px'; el.style.top = Math.max(8, r.top - 54) + 'px';
  }
  function closePop() { var el = $('#im-pop'); if (el) el.hidden = true; }
  function doReact(mid, e) { closePop(); S.react(mid, e).then(null, function (x) { C.toast((x && x.message) || 'Could not react', 'error'); }); }
  function gate() {
    var on = !!me();
    $('#m-wrap').hidden = !on; $('#m-login').hidden = on;
  }
  var wired = false;
  function init() {
    gate(); if (!me()) return;
    var e2e = window.RowanE2E;
    S.start().then(function () {
      drawList(); bar(); if (e2e) e2e.prompt();
      var to = new URLSearchParams(location.search).get('to'), u = to && A.byName(to);
      if (u && u.id !== me().id) open(u.id);
    });
    if (wired) return; wired = true;
    window.addEventListener('rowan:msgs', function () { drawList(); if (cur) { drawThread(false); if (S.unreadFrom(cur) && !document.hidden) S.markRead(cur); } });
    window.addEventListener('rowan:typing', typingUI);
    window.addEventListener('rowan:presence', function () { drawHead(); drawList(); });
    window.addEventListener('rowan:e2e', function () { bar(); S.loadMsgs().then(function () { if (cur) { drawThread(false); S.loadReactions(cur); } }); });
    window.addEventListener('rowan:incoming', function (ev) { var m = ev.detail; if (m && m.s !== cur && document.hidden === false) C.toast('New message from ' + ((A.byId(m.s) || {}).name || 'someone')); });
    $('#m-search').addEventListener('input', drawList);
    document.querySelectorAll('[data-mtab]').forEach(function (b) { b.addEventListener('click', function () { tab = b.dataset.mtab; document.querySelectorAll('[data-mtab]').forEach(function (x) { x.classList.toggle('on', x === b); }); drawList(); }); });
    $('#m-send').addEventListener('click', send);
    $('#m-input').addEventListener('keydown', function (ev) { if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); send(); } else if (ev.key === 'Escape') { replyTo = null; drawReplyBar(); } });
    $('#m-input').addEventListener('input', function () { this.style.height = 'auto'; this.style.height = Math.min(120, this.scrollHeight) + 'px'; syncSend(); if (cur && this.value) S.typingTo(cur); });
    $('#m-input').addEventListener('paste', function (ev) { var it = ev.clipboardData && ev.clipboardData.files && ev.clipboardData.files[0]; if (it) { ev.preventDefault(); pickFile(it); } });
    $('#m-clip').addEventListener('click', function () { $('#m-file').click(); });
    $('#m-file').addEventListener('change', function () { pickFile(this.files[0]); this.value = ''; });
    var chat = $('#m-chat');
    chat.addEventListener('dragover', function (ev) { ev.preventDefault(); chat.classList.add('drop'); });
    chat.addEventListener('dragleave', function () { chat.classList.remove('drop'); });
    chat.addEventListener('drop', function (ev) { ev.preventDefault(); chat.classList.remove('drop'); if (ev.dataTransfer.files[0]) pickFile(ev.dataTransfer.files[0]); });
    /* emoji picker */
    var ep = $('#m-emojis'); ep.innerHTML = EMOJI.map(function (e) { return '<button type="button" data-emoji="' + e + '">' + e + '</button>'; }).join('');
    $('#m-emoji').addEventListener('click', function (ev) { ev.stopPropagation(); ep.hidden = !ep.hidden; });
    ep.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-emoji]'); if (!b) return; var inp = $('#m-input'), p = inp.selectionStart || inp.value.length;
      inp.value = inp.value.slice(0, p) + b.dataset.emoji + inp.value.slice(inp.selectionEnd || p); inp.focus(); inp.setSelectionRange(p + b.dataset.emoji.length, p + b.dataset.emoji.length); syncSend();
    });
    $('#m-thread').addEventListener('dblclick', function (ev) { var r = ev.target.closest('.im-row'); if (r && ev.target.closest('.im-bub') && !r.querySelector('.pending')) doReact(r.dataset.mid, '\u2764\uFE0F'); });
    document.addEventListener('click', function (ev) {
      var t;
      if (!ev.target.closest('#m-emojis,#m-emoji')) $('#m-emojis').hidden = true;
      if (!ev.target.closest('#im-pop,[data-pop]')) closePop();
      if ((t = ev.target.closest('[data-chat]'))) { $('#m-search').value = ''; open(t.dataset.chat); return; }
      if (ev.target.closest('[data-back]')) { $('#m-box').classList.remove('open'); cur = null; drawList(); return; }
      if ((t = ev.target.closest('[data-react]'))) { doReact(t.dataset.react, t.dataset.e); return; }
      if ((t = ev.target.closest('[data-pop]'))) { ev.stopPropagation(); pop(t, t.dataset.pop); return; }
      if ((t = ev.target.closest('[data-reply]'))) { replyTo = t.dataset.reply; drawReplyBar(); $('#m-input').focus(); return; }
      if (ev.target.closest('[data-cancel-reply]')) { replyTo = null; drawReplyBar(); return; }
      if (ev.target.closest('[data-cancel-attach]')) { attach = null; drawAttach(); syncSend(); return; }
      if ((t = ev.target.closest('[data-jump]'))) { var el = $('#m-thread [data-mid="' + t.dataset.jump + '"]'); if (el) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); el.classList.add('flash'); setTimeout(function () { el.classList.remove('flash'); }, 1400); } return; }
      if ((t = ev.target.closest('[data-unsend]'))) {
        var id = t.dataset.unsend, m = S.pair(cur).filter(function (x) { return x.id === id; })[0], o = m && !m.locked && parse(m.body);
        if (!confirm('Unsend this message for everyone?')) return;
        S.unsend(id).then(function () {
          if (o && o.file && o.file.p) window.RowanSB.client.storage.from('chat').remove([o.file.p]).then(function () {}, function () {});
          drawThread(false); drawList();
        }, function (e) { C.toast(e.message, 'error'); });
        return;
      }
      /* tap a bubble (touch screens): show / hide its actions */
      if ((t = ev.target.closest('.im-bub')) && !ev.target.closest('a')) { var row = t.closest('.im-row'); selId = selId === row.dataset.mid ? '' : row.dataset.mid; $('#m-thread').querySelectorAll('.im-row.sel').forEach(function (x) { x.classList.remove('sel'); }); if (selId) row.classList.add('sel'); }
    });
    document.addEventListener('visibilitychange', function () { if (!document.hidden && cur && S.unreadFrom(cur)) S.markRead(cur); });
  }
  A.ready.then(init);
  window.addEventListener('rowan:auth', function () { gate(); if (me()) init(); });
})();
