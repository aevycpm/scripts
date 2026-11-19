/* Aevy community page: post feed, published scripts, people, publish form. */
(function () {
  'use strict';
  var A = window.RowanAuth, C = window.RowanCore, S = window.RowanSocial, DB = window.RowanDB, esc = C.esc;
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function me() { return A.current(); }
  function fail(e) { C.toast((e && e.message) || 'Something went wrong', 'error'); console.error(e); }
  function needLogin() { C.toast('Log in to do that', 'error'); }
  function num(n) { return (n || 0).toLocaleString(); }
  function userLink(u) { return 'user.html?u=' + encodeURIComponent(u.username); }
  function who(u, extra) {
    if (!u) return '<span class="rc-who"><span class="rc-av">?</span><span><b>Member</b></span></span>';
    return '<a class="rc-who" href="' + userLink(u) + '">' + C.avatar(u, 40) + '<span><b>' + esc(u.name) + C.badge(u) + '</b><small>@' + esc(u.username) + (extra ? ' · ' + extra : '') + '</small></span></a>';
  }

  /* ======================= FEED ======================= */
  var posts = [], feedMode = 'all', oldest = 0, scriptsById = {};
  function postHTML(p) {
    var u = A.byId(p.owner), m = me(), liked = S.postLiked(p.id), s = p.script_id && scriptsById[p.script_id];
    var canDel = m && (m.id === p.owner || A.isAdmin());
    return '<article class="card rc-card" data-post="' + esc(p.id) + '">' +
      '<div class="rc-row">' + who(u, C.ago(p.t)) + '<span class="rc-grow"></span>' + (canDel ? '<button class="rc-act" data-pdel="' + esc(p.id) + '">Delete</button>' : '') + '</div>' +
      '<div class="rc-body">' + esc(p.body) + '</div>' +
      (p.script_id ? '<div class="rc-attach" data-open-script="' + esc(p.script_id) + '"><strong>' + esc(s ? s.title : 'Attached script') + '</strong><span class="rc-muted">' + (s ? esc(s.lang) + ' · ' + num(s.downloads) + ' downloads' : 'Open script') + '</span></div>' : '') +
      '<div class="rc-actions"><button class="rc-act' + (liked ? ' on' : '') + '" data-plike="' + esc(p.id) + '" aria-pressed="' + liked + '">' + (liked ? '\u2665' : '\u2661') + ' <span>' + num(p.likes) + '</span></button>' +
      '<button class="rc-act" data-pcmt="' + esc(p.id) + '">Comments <span>' + num(p.comments) + '</span></button></div>' +
      '<div class="rc-cmts" hidden></div></article>';
  }
  function drawFeed() {
    var box = $('#feed');
    box.innerHTML = posts.length ? posts.map(postHTML).join('') : '<p class="rc-empty">No posts yet. Be the first to share something.</p>';
    $('#feed-more').hidden = posts.length < 20 || !oldest;
  }
  function loadFeed(more) {
    var o = { limit: 20 };
    if (more && oldest) o.before = oldest;
    var go = feedMode === 'following' ? Promise.resolve(Object.keys(S.following())) : Promise.resolve(null);
    return go.then(function (ids) {
      if (ids) { if (!me()) return []; o.owners = ids.concat(me().id); }
      return S.listPosts(o);
    }).then(function (list) {
      posts = more ? posts.concat(list) : list;
      oldest = list.length ? list[list.length - 1].t : 0;
      $('#feed-more').dataset.end = list.length < 20 ? '1' : '';
      var need = list.map(function (p) { return p.script_id; }).filter(function (id) { return id && !scriptsById[id]; });
      if (need.length) return DB.listScripts().then(function (all) { all.forEach(function (s) { scriptsById[s.id] = s; }); });
    }).then(function () { drawFeed(); if ($('#feed-more').dataset.end) $('#feed-more').hidden = true; }, fail);
  }
  function toggleComments(pid, art) {
    var box = $('.rc-cmts', art);
    if (!box.hidden) { box.hidden = true; return; }
    box.hidden = false; box.innerHTML = '<p class="rc-muted">Loading...</p>';
    S.listComments(pid).then(function (list) {
      box.innerHTML = '<div class="rc-list-cm">' + list.map(cmtHTML).join('') + '</div>' +
        (me() ? '<form class="rc-cmt-form" data-cform="' + esc(pid) + '"><input class="form-input" maxlength="500" placeholder="Write a comment..." required><button class="btn btn-primary btn-sm">Send</button></form>' : '<p class="rc-muted">Log in to comment.</p>');
    }, fail);
  }
  function cmtHTML(c) {
    var u = A.byId(c.owner), m = me();
    return '<div class="rc-cmt" data-cid="' + esc(c.id) + '">' + C.avatar(u, 32) + '<div class="rc-grow"><b>' + (u ? '<a href="' + userLink(u) + '">' + esc(u.name) + '</a>' + C.badge(u) : 'Member') + '</b> <span class="rc-muted">' + C.ago(c.t) + '</span>' +
      (m && (m.id === c.owner || A.isAdmin()) ? ' <button class="rc-act" data-cdel="' + esc(c.id) + '">Delete</button>' : '') + '<p>' + esc(c.body) + '</p></div></div>';
  }
  function bumpCount(art, sel, d) { var el = $(sel + ' span', art); if (el) el.textContent = num(Math.max(0, (parseInt(String(el.textContent).replace(/\D/g, ''), 10) || 0) + d)); }

  /* ======================= SCRIPTS ======================= */
  var scripts = [], openS = null, rating = 0;
  function stars(n) { var r = Math.round(n), o = ''; for (var i = 1; i <= 5; i++) o += i <= r ? '\u2605' : '\u2606'; return o; }
  function visible() { return scripts.filter(function (s) { return s.vis === 'public' || (me() && s.owner === me().id); }); }
  function scriptCard(s) {
    var u = A.byId(s.owner), r = s.rcount ? s.rsum / s.rcount : 0;
    return '<div class="card rc-card" data-sid="' + esc(s.id) + '"><div class="rc-row"><strong class="rc-grow" style="font-family:var(--font-display)">' + esc(s.title) + '</strong>' +
      (s.vis === 'private' ? '<span class="badge">Private</span>' : '') + '<span class="badge badge-new">' + esc(s.lang) + '</span></div>' +
      '<p class="rc-muted" style="margin:6px 0">' + esc(s.desc || s.cat) + '</p>' +
      '<div class="rc-row wrap rc-muted"><span>' + num(s.downloads) + ' downloads</span><span>' + num(s.views) + ' views</span><span>' + num(s.likes) + ' likes</span>' + (r ? '<span class="rc-stars">' + stars(r) + ' ' + r.toFixed(1) + '</span>' : '') + '</div>' +
      '<div class="rc-row" style="margin-top:10px">' + who(u) + '<span class="rc-grow"></span><button class="btn btn-secondary btn-sm" data-open-script="' + esc(s.id) + '">Open</button></div></div>';
  }
  function drawScripts() {
    var q = ($('#s-search').value || '').toLowerCase().trim(), cat = $('#s-cat').value, sort = $('#s-sort').value;
    var list = visible().filter(function (s) { return (!cat || s.cat === cat) && (!q || (s.title + ' ' + s.desc + ' ' + s.tags.join(' ') + ' ' + s.lang).toLowerCase().indexOf(q) > -1); });
    var key = { new: function (a, b) { return b.created - a.created; }, downloads: function (a, b) { return b.downloads - a.downloads; }, views: function (a, b) { return b.views - a.views; }, likes: function (a, b) { return b.likes - a.likes; },
      rating: function (a, b) { return (b.rcount ? b.rsum / b.rcount : 0) - (a.rcount ? a.rsum / a.rcount : 0); } }[sort] || function () { return 0; };
    list.sort(key);
    $('#scripts-grid').innerHTML = list.length ? list.map(scriptCard).join('') : '<p class="rc-empty">No scripts match yet.</p>';
  }
  function loadScripts() {
    return DB.listScripts().then(function (list) { scripts = list; scripts.forEach(function (s) { scriptsById[s.id] = s; }); drawScripts(); }, fail);
  }
  function loadToday() {
    DB.today().then(function (d) {
      if (!d) return;
      var tot = 0; scripts.forEach(function (s) { if (s.vis === 'public') tot += s.downloads || 0; });
      $('#t-visitors').textContent = num(d.visitors); $('#t-views').textContent = num(d.views); $('#t-downloads').textContent = num(d.downloads); $('#t-total').textContent = num(tot);
    });
  }
  function fileName(s) { var ext = s.ext || { lua: 'lua', javascript: 'js', typescript: 'ts', python: 'py', bash: 'sh', go: 'go', rust: 'rs', html: 'html', css: 'css', json: 'json', text: 'txt' }[s.lang] || 'txt'; return (s.title.replace(/[^\w.-]+/g, '_').slice(0, 60) || 'script') + '.' + ext; }
  function download(s) {
    DB.getCode(s).then(function (code) {
      var blob = window.RowanBin.isBin(code) ? new Blob([window.RowanBin.bytes(code)], { type: 'application/octet-stream' }) : new Blob([code], { type: 'text/plain;charset=utf-8' });
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fileName(s); document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
      C.toast('Downloaded ' + fileName(s));
      DB.trackDownload([s]); if (me()) A.addDownload(s.title);
    }, fail);
  }
  function modalHTML(s) {
    var u = A.byId(s.owner), r = s.rcount ? s.rsum / s.rcount : 0, m = me(), mine = m && m.id === s.owner;
    return '<button class="modal-close" data-modal-close aria-label="Close"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg></button>' +
      '<h3>' + esc(s.title) + '</h3><div class="rc-row wrap" style="margin:8px 0">' + who(u, C.fmtDate(s.created)) + '</div>' +
      '<p class="rc-muted">' + esc(s.desc) + '</p>' +
      '<div class="rc-row wrap rc-muted" style="margin:10px 0"><span>' + esc(s.lang) + '</span><span>' + esc(s.cat) + '</span><span>' + num(s.downloads) + ' downloads</span><span>' + num(s.views) + ' views</span><span id="m-likes">' + num(s.likes) + ' likes</span>' + (r ? '<span class="rc-stars">' + stars(r) + ' ' + r.toFixed(1) + ' (' + s.rcount + ')</span>' : '') + '</div>' +
      '<pre class="rc-code">' + esc(s.preview) + '</pre>' +
      '<div class="rc-actions"><button class="btn btn-primary btn-sm" data-dl>Download</button>' +
      '<button class="rc-act' + (DB.liked(s.id) ? ' on' : '') + '" data-slike>' + (DB.liked(s.id) ? '\u2665 Liked' : '\u2661 Like') + '</button>' +
      '<button class="rc-act' + (DB.isSaved(s.id) ? ' on' : '') + '" data-ssave>' + (DB.isSaved(s.id) ? 'Saved' : 'Save') + '</button>' +
      (mine ? '<button class="rc-act" data-sdel>Delete script</button>' : '<button class="rc-act" data-srep>Report</button>') + '</div>' +
      '<h4 style="margin:18px 0 8px">Reviews</h4><div id="m-reviews"><p class="rc-muted">Loading...</p></div>' +
      (m && !mine ? '<form id="m-rform"><div class="rc-rate" id="m-rate">' + [1, 2, 3, 4, 5].map(function (i) { return '<button type="button" data-r="' + i + '" aria-label="' + i + ' stars">\u2605</button>'; }).join('') + '</div>' +
        '<textarea class="form-input" id="m-rbody" maxlength="600" rows="2" placeholder="Share your experience..." required></textarea><p class="form-error" id="m-rerr"></p><button class="btn btn-primary btn-sm">Post</button></form>' : '');
  }
  function openScript(id) {
    var s = scriptsById[id]; if (!s) { C.toast('That script is not available', 'error'); return; }
    openS = s; rating = 0;
    var ov = $('#scriptModal'); $('.modal', ov).innerHTML = modalHTML(s); ov.classList.add('open');
    DB.trackView(s);
    DB.listReviews(s).then(function (list) {
      $('#m-reviews').innerHTML = list.length ? list.map(function (c) {
        var u = A.byId(c.owner), m = me();
        return '<div class="rc-cmt" data-rid="' + esc(c.id) + '">' + C.avatar(u, 32) + '<div class="rc-grow"><b>' + esc(u ? u.name : 'Member') + '</b>' + (c.rating ? ' <span class="rc-stars">' + stars(c.rating) + '</span>' : '') + ' <span class="rc-muted">' + C.ago(c.t) + '</span>' +
          (m && (m.id === c.owner || A.isAdmin() || m.id === s.owner) ? ' <button class="rc-act" data-rdel="' + esc(c.id) + '">Delete</button>' : '') + '<p>' + esc(c.body) + '</p></div></div>';
      }).join('') : '<p class="rc-muted">No reviews yet.</p>';
    }, function () { $('#m-reviews').innerHTML = '<p class="rc-muted">Could not load reviews.</p>'; });
  }

  /* ======================= PEOPLE ======================= */
  function drawPeople() {
    var q = ($('#p-search').value || '').toLowerCase().trim(), list = A.all().filter(function (u) { return !q || (u.name + ' ' + u.username).toLowerCase().indexOf(q) > -1; }).slice().reverse().slice(0, 60);
    $('#people-list').innerHTML = list.length ? list.map(function (u) {
      var own = me() && me().id === u.id;
      return '<div class="card rc-card rc-row">' + who(u) + '<span class="rc-grow"></span>' + (own ? '' : '<button class="btn btn-secondary btn-sm" data-follow="' + esc(u.id) + '">' + (S.isFollowing(u.id) ? 'Following' : 'Follow') + '</button><a class="btn btn-primary btn-sm" href="messages.html?to=' + encodeURIComponent(u.username) + '">Message</a>') + '</div>';
    }).join('') : '<p class="rc-empty">Nobody found.</p>';
  }

  /* ======================= PUBLISH ======================= */
  function publish(e) {
    e.preventDefault();
    var f = e.target, err = $('#pub-error'), btn = $('[type=submit]', f); err.classList.remove('show');
    if (!me()) { needLogin(); return; }
    var file = $('#pub-file').files[0]; if (!file) { err.textContent = 'Choose a file to publish.'; err.classList.add('show'); return; }
    if (file.size > 2 * 1024 * 1024) { err.textContent = 'Files are limited to 2 MB.'; err.classList.add('show'); return; }
    btn.disabled = true;
    var ext = (file.name.split('.').pop() || '').toLowerCase();
    window.RowanBin.read(file).then(function (code) {
      return DB.createScript({ title: $('#pub-title').value.trim(), lang: $('#pub-lang').value, author: me().name, desc: $('#pub-desc').value.trim(),
        tags: ($('#pub-tags').value || '').split(',').map(function (t) { return t.trim(); }).filter(Boolean).slice(0, 8), cat: $('#pub-cat').value, vis: $('#pub-vis').value, ext: ext }, code);
    }).then(function (s) { f.reset(); C.toast('Script published'); scriptsById[s.id] = s; return loadScripts().then(function () { fillAttach(); $('[data-tab="scripts"]').click(); }); })
      .then(null, function (x) { err.textContent = x.message; err.classList.add('show'); }).then(function () { btn.disabled = false; });
  }
  function fillAttach() {
    var sel = $('#post-script'); if (!sel) return;
    var mine = me() ? scripts.filter(function (s) { return s.owner === me().id && s.vis === 'public'; }) : [];
    sel.innerHTML = '<option value="">No script attached</option>' + mine.map(function (s) { return '<option value="' + esc(s.id) + '">' + esc(s.title) + '</option>'; }).join('');
    sel.parentNode.hidden = !mine.length;
  }

  /* ======================= WIRING ======================= */
  function gate() {
    var on = !!me();
    $('#post-form').hidden = !on; $('#post-login').hidden = on; $('#pub-form').hidden = !on; $('#pub-login').hidden = on;
  }
  function init() {
    var cats = ['Vehicles & Tuning', 'Visual & Graphics', 'Gameplay & Physics', 'Tools & Utilities', 'Maps & Environment', 'Other'];
    $('#s-cat').innerHTML = '<option value="">All categories</option>' + cats.map(function (c) { return '<option>' + esc(c) + '</option>'; }).join('');
    $('#pub-cat').innerHTML = cats.map(function (c) { return '<option>' + esc(c) + '</option>'; }).join('');
    gate();
    var h = (location.hash || '').slice(1), tb = h && $('[data-tab="' + h + '"]'); if (tb) tb.click();
    Promise.all([DB.loadLikes(), DB.loadSaved(), S.start()]).then(function () { return loadScripts(); }).then(function () { fillAttach(); loadToday(); return loadFeed(); }).then(drawPeople);
    DB.trackVisit();
    ['s-search', 's-cat', 's-sort'].forEach(function (id) { $('#' + id).addEventListener('input', drawScripts); });
    $('#p-search').addEventListener('input', drawPeople);
    $$('[data-feed]').forEach(function (b) { b.addEventListener('click', function () {
      if (b.dataset.feed === 'following' && !me()) { needLogin(); return; }
      feedMode = b.dataset.feed; $$('[data-feed]').forEach(function (x) { x.classList.toggle('btn-primary', x === b); x.classList.toggle('btn-secondary', x !== b); }); loadFeed();
    }); });
    $('#feed-more').addEventListener('click', function () { loadFeed(true); });
    $('#post-body').addEventListener('input', function () { $('#post-count').textContent = this.value.length + ' / 1000'; });
    $('#post-form').addEventListener('submit', function (e) {
      e.preventDefault(); var b = $('[type=submit]', this); b.disabled = true;
      S.createPost($('#post-body').value, $('#post-script').value || null).then(function (p) {
        $('#post-body').value = ''; $('#post-count').textContent = '0 / 1000'; if (!posts.some(function (x) { return x.id === p.id; })) { posts.unshift(p); drawFeed(); }
      }, fail).then(function () { b.disabled = false; });
    });
    $('#pub-form').addEventListener('submit', publish);

    document.addEventListener('click', function (e) {
      var t;
      if ((t = e.target.closest('[data-plike]'))) { if (!me()) return needLogin(); var id = t.dataset.plike, art = t.closest('article');
        S.togglePostLike(id).then(function (on) { t.classList.toggle('on', on); t.firstChild.textContent = on ? '\u2665 ' : '\u2661 '; bumpCount(art, '[data-plike]', on ? 1 : -1); }, fail); return; }
      if ((t = e.target.closest('[data-pcmt]'))) { toggleComments(t.dataset.pcmt, t.closest('article')); return; }
      if ((t = e.target.closest('[data-pdel]'))) { if (!confirm('Delete this post?')) return; S.deletePost(t.dataset.pdel).then(function () { posts = posts.filter(function (p) { return p.id !== t.dataset.pdel; }); drawFeed(); }, fail); return; }
      if ((t = e.target.closest('[data-cdel]'))) { var art2 = t.closest('article'); S.deleteComment(t.dataset.cdel).then(function () { var row = t.closest('.rc-cmt'); if (row) row.remove(); bumpCount(art2, '[data-pcmt]', -1); }, fail); return; }
      if ((t = e.target.closest('[data-open-script]'))) { openScript(t.dataset.openScript); return; }
      if ((t = e.target.closest('[data-follow]'))) { if (!me()) return needLogin(); S.toggleFollow(t.dataset.follow).then(function (on) { t.textContent = on ? 'Following' : 'Follow'; }, fail); return; }
      var ov = $('#scriptModal');
      if (!ov.contains(e.target) || !openS) return;
      if (e.target.closest('[data-dl]')) { download(openS); return; }
      if (e.target.closest('[data-slike]')) { if (!me()) return needLogin(); DB.toggleLike(openS).then(function (on) { openS.likes += on ? 1 : -1; $('#m-likes').textContent = num(openS.likes) + ' likes'; var b = $('[data-slike]', ov); b.classList.toggle('on', on); b.textContent = on ? '\u2665 Liked' : '\u2661 Like'; drawScripts(); }, fail); return; }
      if (e.target.closest('[data-ssave]')) { if (!me()) return needLogin(); DB.toggleSave(openS.id).then(function (on) { var b = $('[data-ssave]', ov); b.classList.toggle('on', on); b.textContent = on ? 'Saved' : 'Save'; }, fail); return; }
      if (e.target.closest('[data-srep]')) { if (!me()) return needLogin(); var why = prompt('Report this script. Reason: malware, spam, impersonation, harassment, copyright or other', 'other'); if (!why) return;
        DB.report('script', openS.id, /^(malware|spam|impersonation|harassment|copyright|other)$/.test(why.trim().toLowerCase()) ? why.trim().toLowerCase() : 'other').then(function () { C.toast('Thanks, we will review it'); }, function (x) { C.toast(/duplicate|23505/i.test(x.message || '') ? 'You already reported this' : x.message, 'error'); }); return; }
      if (e.target.closest('[data-sdel]')) { if (!confirm('Delete this script for good?')) return; DB.deleteScript(openS).then(function () { scripts = scripts.filter(function (s) { return s.id !== openS.id; }); ov.classList.remove('open'); drawScripts(); fillAttach(); C.toast('Script deleted'); }, fail); return; }
      if ((t = e.target.closest('[data-rdel]'))) { DB.deleteReview(t.dataset.rdel).then(function () { var r = t.closest('.rc-cmt'); if (r) r.remove(); }, fail); return; }
      if ((t = e.target.closest('#m-rate [data-r]'))) { rating = rating === +t.dataset.r ? 0 : +t.dataset.r; $$('#m-rate button', ov).forEach(function (b) { b.classList.toggle('on', +b.dataset.r <= rating); }); }
    });
    document.addEventListener('submit', function (e) {
      var f = e.target;
      if (f.matches('[data-cform]')) { e.preventDefault(); var inp = $('input', f), art = f.closest('article'); S.addComment(f.dataset.cform, inp.value).then(function (c) { inp.value = ''; $('.rc-list-cm', art).insertAdjacentHTML('beforeend', cmtHTML(c)); bumpCount(art, '[data-pcmt]', 1); }, fail); }
      if (f.id === 'm-rform') { e.preventDefault(); var er = $('#m-rerr'); er.classList.remove('show');
        DB.addReview(openS, $('#m-rbody').value, rating).then(function () { return loadScripts().then(function () { openScript(openS.id); }); }, function (x) { er.textContent = x.message; er.classList.add('show'); }); }
    });
    /* live: new posts from others, counters, reviews */
    S.watchPosts(function (kind, p) { if (kind === 'posts' && p.eventType === 'INSERT' && feedMode === 'all' && !posts.some(function (x) { return x.id === p.new.id; })) { A.refreshProfiles().then(function () { return loadFeed(); }); } });
    DB.watch(function (kind) { if (kind === 'today') loadToday(); else if (!openS || !$('#scriptModal').classList.contains('open')) loadScripts(); });
    window.addEventListener('rowan:auth', function () { gate(); fillAttach(); drawFeed(); drawPeople(); });
  }
  A.ready.then(init);
})();
