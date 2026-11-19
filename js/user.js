/* Aevy public profile page: user.html?u=<username> */
(function () {
  'use strict';
  var A = window.RowanAuth, C = window.RowanCore, S = window.RowanSocial, esc = C.esc;
  function $(s) { return document.querySelector(s); }
  function me() { return A.current(); }
  function num(n) { return (n || 0).toLocaleString(); }
  function fail(e) { C.toast((e && e.message) || 'Something went wrong', 'error'); }
  var u = null, realFollowers = 0;

  function head() {
    var own = me() && me().id === u.id, cover = C.safeImg(u.cover);
    $('#u-cover').style.backgroundImage = cover ? 'url("' + cover + '")' : '';
    var site = /^https?:\/\//.test(u.website) ? '<a class="link-accent" rel="nofollow noopener" target="_blank" href="' + esc(u.website) + '">' + esc(u.website.replace(/^https?:\/\//, '')) + '</a>' : '';
    var meta = [u.location ? esc(u.location) : '', 'Joined ' + C.fmtDate(u.created), site].filter(Boolean).join(' · ');
    var actions = own ? '<a class="btn btn-secondary btn-sm" href="profile.html">Edit profile</a>'
      : '<button class="btn btn-secondary btn-sm" id="u-follow" type="button">' + (S && S.isFollowing(u.id) ? 'Following' : 'Follow') + '</button>' +
        '<a class="btn btn-primary btn-sm" href="messages.html?to=' + encodeURIComponent(u.username) + '">Message</a>';
    $('#u-card').className = 'rc-hero-in pf';
    $('#u-card').innerHTML =
      '<div class="pf-top">' + C.avatar(u, 96) + '<div class="pf-actions">' + actions + '</div></div>' +
      '<div class="pf-id"><h1 class="pf-name"><span class="pf-nm">' + esc(u.name) + '</span>' + C.badge(u) + '</h1>' +
      '<p class="pf-handle">@' + esc(u.username) + ' <span id="u-follows"></span></p>' +
      '<p class="pf-pres" id="u-pres"></p></div>' +
      (u.bio ? '<p class="pf-bio">' + esc(u.bio) + '</p>' : '') +
      '<p class="pf-meta">' + meta + '</p>' +
      '<div class="pf-stats">' +
        '<button type="button" class="pf-stat" data-list="followers" aria-haspopup="dialog"><b id="u-fers">-</b><span>followers</span></button>' +
        '<button type="button" class="pf-stat" data-list="following" aria-haspopup="dialog"><b id="u-fing">-</b><span>following</span></button>' +
        '<div class="pf-stat"><b id="u-scripts">0</b><span>uploads</span></div>' +
        '<div class="pf-stat"><b id="u-dl">0</b><span>downloads</span></div>' +
      '</div>';
    document.title = u.name + ' (@' + u.username + ') — Aevy';
  }
  function presence() { if (!S) return; var t = S.isOnline(u.id) ? 'Online' : S.lastSeen(u.id); var el = $('#u-pres'); if (el) { el.textContent = t || ''; el.classList.toggle('on', t === 'Online'); } }
  function counts() {
    if (!S) return;
    S.counts(u.id).then(function (c) {
      realFollowers = c[0];
      var f = $('#u-fers'); f.textContent = C.fmtCount(c[0]); f.title = num(c[0]);
      $('#u-fing').textContent = C.fmtCount(c[1]);
    });
  }
  function posts() {
    if (!S) { $('#u-posts').innerHTML = '<p class="rc-empty">Posts are unavailable right now.</p>'; return; }
    S.listPosts({ owner: u.id, limit: 30 }).then(function (list) {
      $('#u-posts').innerHTML = list.length ? list.map(function (p) {
        return '<article class="card rc-card"><div class="rc-muted">' + C.ago(p.t) + '</div><div class="rc-body">' + esc(p.body) + '</div><div class="rc-muted" style="margin-top:8px">♡ ' + num(p.likes) + ' · ' + num(p.comments) + ' comments</div></article>';
      }).join('') : '<p class="rc-empty">No posts yet.</p>';
    }, function (e) { $('#u-posts').innerHTML = '<p class="rc-empty">Could not load posts.</p>'; fail(e); });
  }
  /* uploads stats: how many things the member shared and how often they were downloaded */
  function scripts() {
    var sb = window.RowanSB && window.RowanSB.client; if (!sb) return;
    sb.from('uploads').select('downloads').eq('owner', u.id).limit(1000).then(function (r) {
      var n = 0, dl = 0; (r.data || []).forEach(function (x) { n++; dl += x.downloads || 0; });
      $('#u-scripts').textContent = C.fmtCount(n); $('#u-dl').textContent = C.fmtCount(dl);
    }, function () {});
  }

  /* ---------- followers / following: a bottom sheet that always opens ---------- */
  var sheet = null, lastBtn = null;
  function ensureSheet() {
    if (sheet) return sheet;
    sheet = document.createElement('div');
    sheet.className = 'pf-sheet'; sheet.hidden = true;
    sheet.innerHTML = '<div class="pf-sheet__bg" data-close></div><div class="pf-sheet__box" role="dialog" aria-modal="true" aria-labelledby="pf-st"><div class="pf-sheet__grab"></div>' +
      '<div class="pf-sheet__head"><h2 id="pf-st">Followers</h2><button type="button" class="pf-x" data-close aria-label="Close">×</button></div><div class="pf-sheet__body" id="pf-sb"></div></div>';
    document.body.appendChild(sheet);
    sheet.addEventListener('click', function (e) { if (e.target.closest('[data-close]')) closeSheet(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !sheet.hidden) closeSheet(); });
    return sheet;
  }
  function closeSheet() { if (!sheet) return; sheet.hidden = true; document.documentElement.classList.remove('pf-lock'); if (lastBtn) lastBtn.focus(); }
  function row(p) {
    return '<a class="rc-who pf-person" href="user.html?u=' + encodeURIComponent(p.username) + '">' + C.avatar(p, 44) +
      '<span><b>' + esc(p.name) + C.badge(p) + '</b><small>@' + esc(p.username) + '</small></span></a>';
  }
  function openList(kind, btn) {
    lastBtn = btn; ensureSheet();
    var body = $('#pf-sb'), title = kind === 'followers' ? 'Followers' : 'Following';
    $('#pf-st').textContent = title;
    body.innerHTML = '<p class="rc-empty">Loading...</p>';
    sheet.hidden = false; document.documentElement.classList.add('pf-lock');
    if (!S) { body.innerHTML = '<p class="rc-empty">This list is unavailable right now. Reload the page and try again.</p>'; return; }
    S.people(u.id, kind).then(function (list) {
      if (list.length) { body.innerHTML = list.map(row).join(''); return; }
      body.innerHTML = '<p class="rc-empty">' + (kind === 'followers' ? 'No followers to show yet.' : 'Not following anyone yet.') + '</p>';
    }, function (e) {
      body.innerHTML = '<p class="rc-empty">Could not load this list.<br><button type="button" class="btn btn-secondary btn-sm" data-retry style="margin-top:12px">Try again</button></p>';
      body.querySelector('[data-retry]').onclick = function () { openList(kind, btn); };
    });
  }

  function init() {
    var name = new URLSearchParams(location.search).get('u') || (me() && me().username);
    u = name && A.byName(name);
    if (!u) { $('#u-missing').hidden = false; $('#u-main').hidden = true; return; }
    $('#u-main').hidden = false;
    /* draw straight away; the social layer (presence, follow state) fills in when it is ready */
    head(); counts(); posts(); scripts();
    Promise.resolve(me() && S ? S.start() : null).then(function () {
      head(); counts(); if (S) S.pollOnline([u.id]).then(presence);
      if (S && me() && me().id !== u.id) S.followsMe(u.id).then(function (y) { if (y) $('#u-follows').textContent = '· Follows you'; });
    }, function () {});
    window.addEventListener('rowan:presence', presence);
    document.addEventListener('click', function (e) {
      var t;
      if (e.target.closest('#u-follow')) {
        if (!me()) { C.toast('Log in to follow', 'error'); return; }
        S.toggleFollow(u.id).then(function (on) { $('#u-follow').textContent = on ? 'Following' : 'Follow'; counts(); }, fail); return;
      }
      if ((t = e.target.closest('[data-list]'))) openList(t.dataset.list, t);
    });
  }
  A.ready.then(init);
})();
