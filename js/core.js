/* Aevy shared helpers used by the community, messaging and e2e modules. */
(function () {
  'use strict';
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function toast(m, t) { if (window.showToast) window.showToast(m, t || 'success'); }
  function fmtDate(t) { try { return new Date(t).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); } catch (e) { return ''; } }
  function ago(t) {
    var d = Math.max(0, (Date.now() - t) / 1000);
    if (d < 60) return 'just now';
    if (d < 3600) return Math.floor(d / 60) + ' min ago';
    if (d < 86400) return Math.floor(d / 3600) + ' h ago';
    if (d < 86400 * 7) return Math.floor(d / 86400) + ' d ago';
    return fmtDate(t);
  }
  var cfg = window.ROWAN_CONFIG || {}, ADMINS = (cfg.adminUsernames || []).map(function (x) { return String(x).toLowerCase(); }), DAY = 864e5;
  function isAdmin(u) { return !!u && (u.role === 'admin' || ADMINS.indexOf(String(u.username || '').toLowerCase()) > -1); }
  function isNew(u) { return !!u && !!u.created && Date.now() - u.created < (cfg.newDays || 7) * DAY && !isAdmin(u); }
  var CHECK = '<svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true"><path fill="currentColor" d="M12 1.8l2.6 1.9 3.2-.1 1 3.1 2.6 1.9-1 3.1 1 3.1-2.6 1.9-1 3.1-3.2-.1L12 22.2l-2.6-1.9-3.2.1-1-3.1-2.6-1.9 1-3.1-1-3.1 2.6-1.9 1-3.1 3.2.1z"/><path d="M8.3 12.2l2.5 2.5 4.9-5" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  /* Creator check, Admin and New badges (rules are decided by the database) */
  function badge(u) {
    if (!u) return '';
    var o = '';
    if (u.verified || isAdmin(u)) o += '<span class="rc-vbadge" title="Creator" role="img" aria-label="Creator">' + CHECK + '</span>';
    if (isAdmin(u)) o += '<span class="badge badge-vip" title="Aevy Admin">Admin</span>';
    else if (isNew(u)) o += '<span class="badge badge-new" title="New to Aevy">New</span>';
    return o ? '<span class="rc-badges">' + o + '</span>' : '';
  }
  function safeImg(u) { return /^https:\/\//i.test(u || '') ? u : ''; }
  function avatar(u, sz) {
    sz = sz || 40;
    if (!u) return '<span class="rc-av" style="width:' + sz + 'px;height:' + sz + 'px">?</span>';
    var img = safeImg(u.avatar), st = 'width:' + sz + 'px;height:' + sz + 'px;font-size:' + Math.round(sz * .4) + 'px;background:' + (/^#[0-9a-f]{6}$/i.test(u.color || '') ? u.color : 'var(--color-primary)');
    return '<span class="rc-av" data-uid="' + esc(u.id) + '" style="' + st + '">' + (img ? '<img src="' + esc(img) + '" alt="" loading="lazy">' : esc((u.name || u.username || '?').charAt(0).toUpperCase())) + '</span>';
  }
  /* shrink a photo in the browser before upload */
  function shrink(file, w, h) {
    return new Promise(function (ok, no) {
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        var r = Math.max(w / img.width, h / img.height), sw = w / r, sh = h / r, c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, 0, 0, w, h);
        URL.revokeObjectURL(url);
        c.toBlob(function (b) { b ? ok(b) : no(new Error('Could not process the image')); }, 'image/jpeg', 0.85);
      };
      img.onerror = function () { URL.revokeObjectURL(url); no(new Error('That file is not an image')); };
      img.src = url;
    });
  }
  window.RowanCore = { esc: esc, toast: toast, fmtDate: fmtDate, ago: ago, badge: badge, avatar: avatar, safeImg: safeImg, shrink: shrink, isAdmin: isAdmin };
})();
