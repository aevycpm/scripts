/* Aevy — X-style feed of everything members upload: posts, apps, scripts, games and any other file.
   Tables public.uploads / upload_likes / upload_comments + Storage bucket "uploads" (supabase/schema.sql, section v10).
   The date is added automatically by the database (created = now()). */
(function () {
  'use strict';
  var root = document.getElementById('feed-root');
  if (!root) return;
  var A = window.RowanAuth, SB = window.RowanSB, C = window.RowanCore;
  if (!A || !SB || !C) { root.innerHTML = '<p class="rc-empty">The feed is unavailable right now.</p>'; return; }
  var sb = SB.client, esc = C.esc, PAGE = 20, MAX = 50 * 1024 * 1024;
  var KINDS = { post: 'Post', app: 'App', script: 'Script', game: 'Game', file: 'File' };
  var fixed = root.dataset.kind || '';            /* page locked to one kind (apps.html etc.) */
  var ownerMode = root.dataset.owner === 'url', ownerId = '';
  var filter = fixed, term = '', rows = [], liked = {}, busy = false, end = false;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var me = function () { return A.current(); };
  var toast = C.toast;
  function num(n) { return (n || 0).toLocaleString(); }
  function fmtSize(n) { return n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }
  function when(t) { try { return new Date(t).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } }
  function ext(n) { var m = /\.([a-z0-9]{1,10})$/i.exec(n || ''); return m ? m[1].toLowerCase() : ''; }
  function rid() { return window.crypto && crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(16).slice(2); }
  function pub(path) { return sb.storage.from('uploads').getPublicUrl(path).data.publicUrl; }
  function linkify(t) { return esc(t).replace(/(https?:\/\/[^\s<]+)/g, '<a class="link-accent" href="$1" target="_blank" rel="noopener noreferrer nofollow">$1</a>'); }
  function fail(e) { toast((e && e.message) || 'Something went wrong', 'error'); }

  /* ---------------- layout ---------------- */
  var title = root.dataset.title || 'Share something';
  root.innerHTML =
    '<div class="card rc-card fd-compose" id="fd-compose"><p id="fd-login" class="rc-muted" hidden>Join in: <a class="link-accent" href="login.html">log in</a> or <a class="link-accent" href="signup.html">create an account</a> to post and upload.</p>' +
    '<form id="fd-form" hidden novalidate><div class="rc-row" style="align-items:flex-start"><span id="fd-av"></span><div class="rc-grow">' +
    '<div class="fd-meta" id="fd-meta"' + (fixed ? '' : ' hidden') + '>' +
    (fixed ? '' : '<select class="form-input" id="fd-kind" aria-label="Type"><option value="post">Post</option><option value="app">App (APK)</option><option value="script">Script</option><option value="game">Game</option><option value="file">Other file</option></select>') +
    '<input class="form-input" id="fd-title" maxlength="100" placeholder="Title (e.g. My CPM script)"><input class="form-input" id="fd-version" maxlength="30" placeholder="Version (1.0.0)"></div>' +
    '<textarea class="form-input" id="fd-body" maxlength="2000" rows="2" placeholder="' + esc(fixed ? 'Describe what you are sharing...' : "What's happening? Share an update, or upload an app, script or any file...") + '"></textarea>' +
    '<div class="fd-files" id="fd-files"></div>' +
    '<div class="fd-progress" id="fd-progress" hidden><div id="fd-bar"></div><span id="fd-pct">0%</span></div><p class="form-error" id="fd-err" role="alert"></p>' +
    '<div class="rc-row wrap fd-bar"><label class="rc-act" for="fd-file" title="Attach any file (max 50 MB)">📎 File</label><input type="file" id="fd-file" hidden>' +
    '<label class="rc-act" for="fd-img" title="Attach an image / icon">🖼 Image</label><input type="file" id="fd-img" accept="image/png,image/jpeg,image/webp,image/gif" hidden>' +
    '<span class="rc-muted" id="fd-count">0 / 2000</span><span class="rc-grow"></span><button class="btn btn-primary btn-sm" id="fd-submit" type="submit">' + esc(fixed ? 'Publish' : 'Post') + '</button></div>' +
    '</div></div></form></div>' +
    '<div class="fd-tools">' + (fixed ? '' : '<div class="fd-tabs" id="fd-tabs" role="tablist">' + ['', 'app', 'script', 'game', 'file', 'post'].map(function (k) {
      return '<button type="button" role="tab" data-k="' + k + '" class="' + (k === '' ? 'on' : '') + '">' + (k ? KINDS[k] + 's' : 'All') + '</button>'; }).join('') + '</div>') +
    '<input class="form-input" id="fd-search" type="search" placeholder="Search..." aria-label="Search"></div>' +
    '<div id="fd-list" aria-live="polite"><p class="rc-empty">Loading...</p></div><button class="btn btn-secondary btn-block" id="fd-more" hidden>Load more</button>';

  var form = $('#fd-form'), list = $('#fd-list');
  try { var q0 = new URLSearchParams(location.search).get('q'); if (q0) { term = q0.trim(); $('#fd-search').value = q0; } } catch (e) {}

  /* ---------------- cards ---------------- */
  function card(u) {
    var o = A.byId(u.owner), m = me(), isImg = /^(png|jpe?g|gif|webp)$/.test(ext(u.file_name));
    var media = u.image || (isImg && u.file_url) || '';
    var dl = u.file_url ? u.file_url + '?download=' + encodeURIComponent(u.file_name || 'file') : '';
    var canDel = m && (m.id === u.owner || A.isAdmin());
    return '<article class="card rc-card fd-card" data-id="' + esc(u.id) + '">' +
      '<div class="rc-row">' + (o ? '<a class="rc-who" href="user.html?u=' + encodeURIComponent(o.username) + '">' + C.avatar(o, 44) + '<span><b>' + esc(o.name) + C.badge(o) + '</b><small>@' + esc(o.username) + ' · <time datetime="' + new Date(u.created).toISOString() + '" title="' + esc(when(u.created)) + '">' + C.ago(Date.parse(u.created)) + '</time></small></span></a>'
        : '<span class="rc-who">' + C.avatar(null, 44) + '<span><b>Member</b></span></span>') +
      '<span class="rc-grow"></span><span class="fd-kind fd-kind--' + esc(u.kind) + '">' + esc(KINDS[u.kind] || 'Post') + '</span>' + (canDel ? '<button class="rc-act" data-del="' + esc(u.id) + '">Delete</button>' : '') + '</div>' +
      (u.title ? '<h3 class="fd-title">' + esc(u.title) + (u.version ? ' <span class="fd-ver">v' + esc(u.version.replace(/^v/i, '')) + '</span>' : '') + '</h3>' : (u.version ? '<span class="fd-ver">v' + esc(u.version.replace(/^v/i, '')) + '</span>' : '')) +
      (u.body ? '<div class="rc-body">' + linkify(u.body) + '</div>' : '') +
      (media ? '<a class="fd-media" href="' + esc(media) + '" target="_blank" rel="noopener"><img src="' + esc(media) + '" alt="" loading="lazy"></a>' : '') +
      (dl ? '<div class="fd-file"><span class="fd-file__ico" aria-hidden="true">' + esc((ext(u.file_name) || 'file').slice(0, 4).toUpperCase()) + '</span><div class="rc-grow"><b>' + esc(u.file_name || 'File') + '</b><small class="rc-muted">' + fmtSize(u.size) + ' · ' + num(u.downloads) + ' downloads</small></div><a class="btn btn-primary btn-sm" href="' + esc(dl) + '" data-dl="' + esc(u.id) + '" rel="noopener">Download</a></div>' : '') +
      '<div class="fd-stamp">' + esc(when(u.created)) + '</div>' +
      '<div class="rc-actions"><button class="rc-act' + (liked[u.id] ? ' on' : '') + '" data-like="' + esc(u.id) + '" aria-pressed="' + !!liked[u.id] + '">' + (liked[u.id] ? '♥' : '♡') + ' <span>' + num(u.likes) + '</span></button>' +
      '<button class="rc-act" data-cmt="' + esc(u.id) + '">💬 <span>' + num(u.comments) + '</span></button></div><div class="rc-cmts" hidden></div></article>';
  }
  function draw() {
    var t = term.toLowerCase(), shown = rows;
    list.innerHTML = shown.length ? shown.map(card).join('') : '<p class="rc-empty">' + (t ? 'Nothing matches your search.' : 'Nothing here yet. Be the first to share!') + '</p>';
    $('#fd-more').hidden = end || rows.length < PAGE;
  }

  /* ---------------- loading ---------------- */
  function load(more) {
    if (busy) return Promise.resolve(); busy = true;
    var q = sb.from('uploads').select('*').order('created', { ascending: false });
    if (filter) q = q.eq('kind', filter);
    if (ownerId) q = q.eq('owner', ownerId);
    var tt = term.replace(/[%,()*\\]/g, ' ').trim(); if (tt) q = q.or('title.ilike.%' + tt + '%,body.ilike.%' + tt + '%,file_name.ilike.%' + tt + '%');
    var from = more ? rows.length : 0;
    return q.range(from, from + PAGE - 1).then(function (r) {
      if (r.error) throw r.error;
      rows = more ? rows.concat(r.data) : r.data; end = r.data.length < PAGE;
      return loadLikes();
    }).then(draw, function (e) {
      list.innerHTML = '<p class="rc-empty">' + (/PGRST205|42P01/.test((e && e.code) || '') ? 'The feed is not set up yet. Run supabase/schema.sql in the Supabase SQL editor.' : 'Could not load the feed.') + '</p>';
    }).then(function () { busy = false; });
  }
  function loadLikes() {
    liked = {}; var m = me(); if (!m || !rows.length) return Promise.resolve();
    return sb.from('upload_likes').select('upload_id').eq('owner', m.id).in('upload_id', rows.map(function (r) { return r.id; })).then(function (r) { (r.data || []).forEach(function (x) { liked[x.upload_id] = 1; }); }, function () {});
  }
  var tabs = $('#fd-tabs');
  if (tabs) tabs.addEventListener('click', function (e) {
    var b = e.target.closest('button[data-k]'); if (!b) return;
    filter = b.dataset.k; Array.prototype.forEach.call(tabs.children, function (x) { x.classList.toggle('on', x === b); }); rows = []; end = false; list.innerHTML = '<p class="rc-empty">Loading...</p>'; load();
  });
  var st = 0; $('#fd-search').addEventListener('input', function (e) { term = e.target.value.trim(); clearTimeout(st); st = setTimeout(function () { var w = setInterval(function () { if (!busy) { clearInterval(w); end = false; load(); } }, 50); }, 300); });
  $('#fd-more').addEventListener('click', function () { load(true); });

  /* ---------------- actions: like, comment, download, delete ---------------- */
  function find(id) { return rows.filter(function (r) { return r.id === id; })[0]; }
  function bump(art, sel, d) { var el = $(sel + ' span', art); if (el) el.textContent = num(Math.max(0, (parseInt(String(el.textContent).replace(/\D/g, ''), 10) || 0) + d)); }
  function cmtHTML(c) {
    var o = A.byId(c.owner), m = me();
    return '<div class="rc-cmt" data-cid="' + esc(c.id) + '">' + C.avatar(o, 32) + '<div class="rc-grow"><b>' + (o ? esc(o.name) : 'Member') + '</b> <span class="rc-muted" title="' + esc(when(c.created)) + '">' + C.ago(Date.parse(c.created)) + '</span>' +
      (m && (m.id === c.owner || A.isAdmin()) ? ' <button class="rc-act" data-cdel="' + esc(c.id) + '">Delete</button>' : '') + '<p>' + linkify(c.body) + '</p></div></div>';
  }
  list.addEventListener('click', function (e) {
    var t, art = e.target.closest('article'), m = me(), u = art && find(art.dataset.id);
    if ((t = e.target.closest('[data-dl]'))) { sb.rpc('track_upload_download', { uid: t.dataset.dl }).then(function () {}, function () {}); if (u) { u.downloads++; bump(art, '.fd-file small', 0); var s = $('.fd-file small', art); if (s) s.textContent = fmtSize(u.size) + ' · ' + num(u.downloads) + ' downloads'; } return; }
    if ((t = e.target.closest('[data-like]'))) {
      if (!m) return toast('Log in to like', 'error');
      var on = !liked[u.id];
      (on ? sb.from('upload_likes').insert({ upload_id: u.id, owner: m.id }) : sb.from('upload_likes').delete().eq('upload_id', u.id).eq('owner', m.id)).then(function (r) {
        if (r.error) return fail(r.error);
        if (on) liked[u.id] = 1; else delete liked[u.id]; u.likes += on ? 1 : -1;
        t.classList.toggle('on', on); t.setAttribute('aria-pressed', on); t.firstChild.textContent = on ? '♥ ' : '♡ '; bump(art, '[data-like]', 0); $('span', t).textContent = num(u.likes);
      });
      return;
    }
    if ((t = e.target.closest('[data-cmt]'))) {
      var box = $('.rc-cmts', art); if (!box.hidden) { box.hidden = true; return; }
      box.hidden = false; box.innerHTML = '<p class="rc-muted">Loading...</p>';
      sb.from('upload_comments').select('*').eq('upload_id', u.id).order('created').limit(100).then(function (r) {
        if (r.error) return fail(r.error);
        box.innerHTML = '<div class="fd-cl">' + r.data.map(cmtHTML).join('') + '</div>' + (m ? '<form class="rc-cmt-form" data-cform><input class="form-input" maxlength="500" placeholder="Write a comment..." required><button class="btn btn-primary btn-sm">Send</button></form>' : '<p class="rc-muted">Log in to comment.</p>');
      });
      return;
    }
    if ((t = e.target.closest('[data-cdel]'))) { sb.from('upload_comments').delete().eq('id', t.dataset.cdel).then(function (r) { if (r.error) return fail(r.error); t.closest('.rc-cmt').remove(); u.comments = Math.max(0, u.comments - 1); $('[data-cmt] span', art).textContent = num(u.comments); }); return; }
    if ((t = e.target.closest('[data-del]'))) {
      if (!confirm('Delete this ' + (KINDS[u.kind] || 'post').toLowerCase() + '? This cannot be undone.')) return;
      sb.from('uploads').delete().eq('id', u.id).select('id').then(function (r) {
        if (r.error || !r.data || !r.data.length) return toast('Could not delete', 'error');
        var paths = [u.file_path, u.image_path].filter(Boolean); if (paths.length) sb.storage.from('uploads').remove(paths).then(function () {}, function () {});
        rows = rows.filter(function (x) { return x.id !== u.id; }); draw(); toast('Deleted');
      });
    }
  });
  list.addEventListener('submit', function (e) {
    var f = e.target.closest('[data-cform]'); if (!f) return; e.preventDefault();
    var art = f.closest('article'), u = find(art.dataset.id), inp = $('input', f), m = me(); if (!m) return;
    sb.from('upload_comments').insert({ upload_id: u.id, owner: m.id, body: inp.value.trim() }).select('*').single().then(function (r) {
      if (r.error) return fail(r.error);
      inp.value = ''; $('.fd-cl', art).insertAdjacentHTML('beforeend', cmtHTML(r.data)); u.comments++; $('[data-cmt] span', art).textContent = num(u.comments);
    });
  });

  /* ---------------- X-style hover card on the author ---------------- */
  var hc = document.createElement('div'), hcT = 0, hcFor = '';
  hc.className = 'fd-hover card'; hc.hidden = true; document.body.appendChild(hc);
  function hideHC() { clearTimeout(hcT); hcT = setTimeout(function () { hc.hidden = true; hcFor = ''; }, 200); }
  function showHC(a) {
    var un = decodeURIComponent((a.getAttribute('href') || '').split('u=')[1] || ''), o = A.byName(un); if (!o) return;
    clearTimeout(hcT);
    hcT = setTimeout(function () {
      hcFor = o.id; var r = a.getBoundingClientRect(), S = window.RowanSocial, own = me() && me().id === o.id;
      hc.innerHTML = '<div class="rc-row" style="align-items:flex-start">' + C.avatar(o, 56) + '<span class="rc-grow"></span>' +
        (own || !S ? '' : '<button class="btn btn-secondary btn-sm" data-hfollow="' + esc(o.id) + '">' + (S.isFollowing && S.isFollowing(o.id) ? 'Following' : 'Follow') + '</button>') + '</div>' +
        '<a class="fd-hname" href="user.html?u=' + encodeURIComponent(o.username) + '"><b>' + esc(o.name) + '</b>' + C.badge(o) + '</a><div class="rc-muted">@' + esc(o.username) + '</div>' +
        (o.bio ? '<p class="fd-hbio">' + esc(o.bio.slice(0, 160)) + '</p>' : '') +
        '<div class="rc-stats rc-muted"><span><b id="fd-hf">-</b> followers</span><span><b id="fd-hg">-</b> following</span></div>';
      hc.hidden = false;
      var w = hc.offsetWidth, left = Math.min(Math.max(8, r.left + window.scrollX), window.scrollX + document.documentElement.clientWidth - w - 8);
      hc.style.left = left + 'px'; hc.style.top = (r.bottom + window.scrollY + 6) + 'px';
      if (S && S.counts) S.counts(o.id).then(function (c) { if (hcFor === o.id) { var f = document.getElementById('fd-hf'), g = document.getElementById('fd-hg'); if (f) f.textContent = num(c[0]); if (g) g.textContent = num(c[1]); } }, function () {});
    }, 350);
  }
  list.addEventListener('mouseover', function (e) { var a = e.target.closest('a.rc-who'); if (a && !a.contains(e.relatedTarget)) showHC(a); });
  list.addEventListener('mouseout', function (e) { var a = e.target.closest('a.rc-who'); if (a && !a.contains(e.relatedTarget)) hideHC(); });
  hc.addEventListener('mouseenter', function () { clearTimeout(hcT); }); hc.addEventListener('mouseleave', hideHC);
  hc.addEventListener('click', function (e) {
    var b = e.target.closest('[data-hfollow]'), S = window.RowanSocial; if (!b) return;
    if (!me()) return toast('Log in to follow', 'error');
    S.toggleFollow(b.dataset.hfollow).then(function (on) { b.textContent = on ? 'Following' : 'Follow'; }, fail);
  });

  /* ---------------- composer ---------------- */
  var fileEl = $('#fd-file'), imgEl = $('#fd-img'), kindEl = $('#fd-kind'), metaEl = $('#fd-meta');
  function err(msg) { var el = $('#fd-err'); el.textContent = msg || ''; el.classList.toggle('show', !!msg); }
  function chips() {
    var f = fileEl.files[0], i = imgEl.files[0], h = '';
    if (f) h += '<span class="fd-chip">📎 ' + esc(f.name) + ' (' + fmtSize(f.size) + ')<button type="button" data-clear="file" aria-label="Remove file">×</button></span>';
    if (i) h += '<span class="fd-chip">🖼 ' + esc(i.name) + '<button type="button" data-clear="img" aria-label="Remove image">×</button></span>';
    $('#fd-files').innerHTML = h;
    if (f && metaEl) metaEl.hidden = false;
    if (f && kindEl && kindEl.value === 'post') { kindEl.value = /\.apk$/i.test(f.name) ? 'app' : /\.(lua|js|py|sh|ts|json)$/i.test(f.name) ? 'script' : 'file'; }
    if (f && !$('#fd-title').value) $('#fd-title').value = f.name.replace(/\.[^.]+$/, '').slice(0, 100);
  }
  fileEl.addEventListener('change', chips); imgEl.addEventListener('change', chips);
  $('#fd-files').addEventListener('click', function (e) { var b = e.target.closest('[data-clear]'); if (!b) return; (b.dataset.clear === 'file' ? fileEl : imgEl).value = ''; chips(); });
  if (kindEl) kindEl.addEventListener('change', function () { metaEl.hidden = kindEl.value === 'post' && !fileEl.files[0]; });
  $('#fd-body').addEventListener('input', function (e) { $('#fd-count').textContent = e.target.value.length + ' / 2000'; });

  function put(path, file, onProg) {
    return sb.auth.getSession().then(function (s) {
      var tok = s.data && s.data.session && s.data.session.access_token; if (!tok) throw new Error('Please log in again');
      var cfg = window.ROWAN_CONFIG;
      return new Promise(function (res, rej) {
        var x = new XMLHttpRequest();
        x.open('POST', cfg.url + '/storage/v1/object/uploads/' + path.split('/').map(encodeURIComponent).join('/'));
        x.setRequestHeader('Authorization', 'Bearer ' + tok); x.setRequestHeader('apikey', cfg.key); x.setRequestHeader('x-upsert', 'false'); x.setRequestHeader('cache-control', '3600');
        x.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
        if (onProg) x.upload.onprogress = function (ev) { if (ev.lengthComputable) onProg(ev.loaded / ev.total); };
        x.onload = function () {
          if (x.status >= 200 && x.status < 300) return res();
          var msg = ''; try { msg = JSON.parse(x.responseText).message; } catch (z) {}
          rej(new Error(x.status === 413 || /exceeded|too large|payload/i.test(msg || '') ? 'File is too large (max 50 MB)' : /bucket not found/i.test(msg || '') ? 'File storage is not set up. Run the latest supabase/schema.sql' : (msg || 'Upload failed')));
        };
        x.onerror = function () { rej(new Error('Cannot reach the server. Check your connection and retry')); };
        x.send(file);
      });
    });
  }
  form.addEventListener('submit', function (e) {
    e.preventDefault(); var m = me(); if (!m || busy) return;
    if (m.guest) return err('Guest accounts cannot post');
    var body = $('#fd-body').value.trim(), ttl = $('#fd-title').value.trim(), ver = $('#fd-version').value.trim(), f = fileEl.files[0], im = imgEl.files[0];
    var kind = fixed || (kindEl ? kindEl.value : 'post');
    if (f && f.size > MAX) return err('The file is larger than 50 MB');
    if (im && im.size > 5 * 1024 * 1024) return err('The image must be under 5 MB');
    if (!body && !f && !im && !ttl) return err('Write something or attach a file');
    if (fixed && !f) return err('Attach the file you are sharing');
    err(''); busy = true;
    var btn = $('#fd-submit'), pr = $('#fd-progress'), bar = $('#fd-bar'), pct = $('#fd-pct'); btn.disabled = true; btn.textContent = 'Uploading...'; pr.hidden = !f;
    var base = m.id + '/' + rid(), made = [], rec = { owner: m.id, kind: kind, title: ttl, body: body, version: ver };
    (f ? put(base + (ext(f.name) ? '.' + ext(f.name) : ''), f, function (p) { var v = Math.round(p * 100); bar.style.width = v + '%'; pct.textContent = v + '%'; }).then(function () {
        var path = base + (ext(f.name) ? '.' + ext(f.name) : ''); made.push(path);
        rec.file_path = path; rec.file_url = pub(path); rec.file_name = f.name.slice(0, 200); rec.size = f.size;
      }) : Promise.resolve())
      .then(function () {
        if (!im) return; var p = base + '-img.' + (ext(im.name) || 'jpg');
        return put(p, im).then(function () { made.push(p); rec.image_path = p; rec.image = pub(p); });
      })
      .then(function () { return sb.from('uploads').insert(rec).select('*').single(); })
      .then(function (r) {
        if (r.error) throw r.error;
        form.reset(); chips(); $('#fd-count').textContent = '0 / 2000'; if (metaEl && !fixed) metaEl.hidden = true; pr.hidden = true;
        if (!filter || filter === r.data.kind) { rows.unshift(r.data); draw(); } toast('Published');
      })
      .then(null, function (x) { if (made.length) sb.storage.from('uploads').remove(made).then(function () {}, function () {}); err((x && x.message) || 'Upload failed'); })
      .then(function () { busy = false; btn.disabled = false; btn.textContent = fixed ? 'Publish' : 'Post'; });
  });

  function gate() {
    if (ownerMode) { $('#fd-compose').hidden = true; return; }
    var m = me(); form.hidden = !m; $('#fd-login').hidden = !!m;
    $('#fd-av').innerHTML = m ? C.avatar(m, 44) : '';
  }
  A.ready.then(function () { gate(); return A.refreshProfiles ? A.refreshProfiles().catch(function () {}) : null; }).then(function () {
    gate();
    if (ownerMode) {
      var nm = new URLSearchParams(location.search).get('u') || (me() && me().username), pr = nm && A.byName(nm);
      if (!pr) { list.innerHTML = ''; return; }
      ownerId = pr.id;
    }
    return load();
  });
  window.addEventListener('rowan:auth', function () { gate(); loadLikes().then(draw); });
  try { sb.channel('rowan-uploads').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'uploads' }, function (p) {
    if (rows.some(function (r) { return r.id === p.new.id; }) || (filter && p.new.kind !== filter) || (ownerId && p.new.owner !== ownerId)) return;
    A.refreshProfiles().then(function () { rows.unshift(p.new); draw(); }); }).subscribe(); } catch (e) {}
})();
