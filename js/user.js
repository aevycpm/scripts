/* Aevy public profile page: user.html?u=<username> */
(function () {
  'use strict';
  var A = window.RowanAuth, C = window.RowanCore, S = window.RowanSocial, DB = window.RowanDB, esc = C.esc;
  function $(s) { return document.querySelector(s); }
  function me() { return A.current(); }
  function num(n) { return (n || 0).toLocaleString(); }
  function fail(e) { C.toast((e && e.message) || 'Something went wrong', 'error'); }
  var u = null;
  function head() {
    var own = me() && me().id === u.id, cover = C.safeImg(u.cover);
    $('#u-cover').style.backgroundImage = cover ? 'url("' + cover + '")' : '';
    $('#u-card').innerHTML = C.avatar(u, 112) +
      '<div class="rc-grow"><h1 style="font-size:var(--fs-xl)">' + esc(u.name) + C.badge(u) + '</h1><p class="rc-muted">@' + esc(u.username) + ' <span id="u-follows"></span></p><p class="rc-muted" id="u-pres"></p>' +
      (u.bio ? '<p style="margin-top:8px;white-space:pre-wrap">' + esc(u.bio) + '</p>' : '') +
      '<p class="rc-muted" style="margin-top:6px">' + (u.location ? esc(u.location) + ' · ' : '') + 'Joined ' + C.fmtDate(u.created) + (/^https?:\/\//.test(u.website) ? ' · <a class="link-accent" rel="nofollow noopener" target="_blank" href="' + esc(u.website) + '">' + esc(u.website.replace(/^https?:\/\//, '')) + '</a>' : '') + '</p>' +
      '<div class="rc-stats"><button data-list="followers"><b id="u-fers">-</b> <span class="rc-muted">followers</span></button><button data-list="following"><b id="u-fing">-</b> <span class="rc-muted">following</span></button><span><b id="u-scripts">0</b> <span class="rc-muted">uploads</span></span><span><b id="u-dl">0</b> <span class="rc-muted">downloads</span></span></div></div>' +
      '<div class="rc-row">' + (own ? '<a class="btn btn-secondary btn-sm" href="profile.html">Edit profile</a>' : '<button class="btn btn-secondary btn-sm" id="u-follow">' + (S.isFollowing(u.id) ? 'Following' : 'Follow') + '</button><a class="btn btn-primary btn-sm" href="messages.html?to=' + encodeURIComponent(u.username) + '">Message</a>') + '</div>';
    document.title = u.name + ' (@' + u.username + ') \u2014 Aevy';
  }
  function presence() { var t = S.isOnline(u.id) ? 'Online' : S.lastSeen(u.id); $('#u-pres').textContent = t || ''; }
  function counts() { S.counts(u.id).then(function (c) { $('#u-fers').textContent = num(c[0]); $('#u-fing').textContent = num(c[1]); }); }
  function posts() {
    S.listPosts({ owner: u.id, limit: 30 }).then(function (list) {
      $('#u-posts').innerHTML = list.length ? list.map(function (p) {
        return '<article class="card rc-card"><div class="rc-muted">' + C.ago(p.t) + '</div><div class="rc-body">' + esc(p.body) + '</div><div class="rc-muted" style="margin-top:8px">\u2661 ' + num(p.likes) + ' · ' + num(p.comments) + ' comments</div></article>';
      }).join('') : '<p class="rc-empty">No posts yet.</p>';
    }, fail);
  }
  /* uploads stats: how many things the member shared and how often they were downloaded */
  function scripts() {
    var sb = window.RowanSB && window.RowanSB.client; if (!sb) return;
    sb.from('uploads').select('downloads').eq('owner', u.id).limit(1000).then(function (r) {
      var n = 0, dl = 0; (r.data || []).forEach(function (x) { n++; dl += x.downloads || 0; });
      $('#u-scripts').textContent = num(n); $('#u-dl').textContent = num(dl);
    }, function () {});
  }
  function init() {
    var name = new URLSearchParams(location.search).get('u') || (me() && me().username);
    u = name && A.byName(name);
    if (!u) { $('#u-missing').hidden = false; $('#u-main').hidden = true; return; }
    $('#u-main').hidden = false;
    Promise.resolve(me() ? S.start() : null).then(function () {
      head(); counts(); posts(); scripts(); S.pollOnline([u.id]).then(presence);
      if (me() && me().id !== u.id) S.followsMe(u.id).then(function (y) { if (y) $('#u-follows').textContent = '· Follows you'; });
    });
    window.addEventListener('rowan:presence', presence);
    document.addEventListener('click', function (e) {
      var t;
      if (e.target.closest('#u-follow')) { if (!me()) { C.toast('Log in to follow', 'error'); return; } S.toggleFollow(u.id).then(function (on) { $('#u-follow').textContent = on ? 'Following' : 'Follow'; counts(); }, fail); return; }
      if ((t = e.target.closest('[data-list]'))) {
        var kind = t.dataset.list, box = $('#u-people');
        if (box.dataset.kind === kind && !box.hidden) { box.hidden = true; return; }
        box.dataset.kind = kind; box.hidden = false; box.innerHTML = '<p class="rc-muted">Loading...</p>';
        S.people(u.id, kind).then(function (list) {
          box.innerHTML = '<h3 style="margin-bottom:8px">' + (kind === 'followers' ? 'Followers' : 'Following') + '</h3>' + (list.map(function (p) { return '<div class="rc-row" style="padding:6px 0"><a class="rc-who" href="user.html?u=' + encodeURIComponent(p.username) + '">' + C.avatar(p, 36) + '<span><b>' + esc(p.name) + C.badge(p) + '</b><small>@' + esc(p.username) + '</small></span></a></div>'; }).join('') || '<p class="rc-muted">Nobody yet.</p>');
        }, fail);
      }
    });
  }
  A.ready.then(init);
})();
