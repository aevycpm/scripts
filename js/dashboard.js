/* Aevy creator dashboard: totals, trends and management for the signed-in member's uploads. */
(function () {
  'use strict';
  var A = window.RowanAuth, SBW = window.RowanSB, C = window.RowanCore;
  var esc = C.esc, $ = function (s, r) { return (r || document).querySelector(s); };
  var KINDS = { post: 'Post', app: 'App', script: 'Script', game: 'Game', file: 'File' };
  var COLORS = { app: '#2563EB', script: '#0F766E', game: '#B45309', file: '#475569', post: '#94A3B8' };
  var rows = [], range = 30, tab = '', term = '', sort = 'new', sb, me;
  function num(n) { return (n || 0).toLocaleString(); }
  function K(n) { return C.fmtCount(n); }
  function sum(k) { return rows.reduce(function (a, r) { return a + (r[k] || 0); }, 0); }
  function fmtSize(n) { return n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }
  function day(t) { try { return new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); } catch (e) { return ''; } }
  function name(r) { return r.title || (r.body || '').slice(0, 60) || r.file_name || 'Untitled'; }

  function gate(html) { var g = $('#db-gate'); g.innerHTML = html; g.hidden = false; $('#db-app').hidden = true; }

  /* ---------- KPIs ---------- */
  function kpis(followers) {
    var wk = Date.now() - 7 * 864e5, newWk = rows.filter(function (r) { return Date.parse(r.created) > wk; }).length;
    var items = [
      ['Followers', K(followers), ''],
      ['Uploads', K(rows.length), newWk ? '+' + newWk + ' this week' : 'None this week', newWk],
      ['Downloads', K(sum('downloads')), rows.length ? 'Avg ' + Math.round(sum('downloads') / rows.length) + ' per upload' : ''],
      ['Likes', K(sum('likes')), ''],
      ['Comments', K(sum('comments')), '']
    ];
    $('#db-kpis').innerHTML = items.map(function (i) { return '<div class="db-kpi' + (i[3] ? ' is-up' : '') + '"><span>' + i[0] + '</span><b>' + i[1] + '</b><small>' + (i[2] || '&nbsp;') + '</small></div>'; }).join('');
  }

  /* ---------- uploads over time ---------- */
  function chart() {
    var n = range, weekly = n > 30, size = weekly ? 7 : 1, buckets = Math.ceil(n / size), end = new Date(); end.setHours(23, 59, 59, 999);
    var start = end.getTime() - n * 864e5, counts = new Array(buckets).fill(0), total = 0;
    rows.forEach(function (r) { var t = Date.parse(r.created); if (t < start || t > end.getTime()) return; var i = Math.min(buckets - 1, Math.floor((t - start) / (size * 864e5))); counts[i]++; total++; });
    var max = Math.max.apply(null, counts.concat([1]));
    $('#db-chart').innerHTML = counts.map(function (c, i) {
      var d = new Date(start + i * size * 864e5 + 864e5);
      return '<div class="db-bar' + (c ? '' : ' z') + '" style="height:' + (c ? Math.max(6, c / max * 100) : 0) + '%" title="' + (weekly ? 'Week of ' : '') + day(d) + ': ' + c + ' upload' + (c === 1 ? '' : 's') + '"></div>';
    }).join('');
    $('#db-chart').setAttribute('role', 'img'); $('#db-chart').setAttribute('aria-label', total + ' uploads in the last ' + n + ' days');
    var ax = $('#db-chart').nextElementSibling; if (ax && ax.className === 'db-axis') ax.remove();
    $('#db-chart').insertAdjacentHTML('afterend', '<div class="db-axis"><span>' + day(start) + '</span><span>' + total + ' upload' + (total === 1 ? '' : 's') + '</span><span>Today</span></div>');
  }

  /* ---------- by type ---------- */
  function types() {
    var by = {}; rows.forEach(function (r) { var k = by[r.kind] = by[r.kind] || { n: 0, d: 0 }; k.n++; k.d += r.downloads || 0; });
    var keys = Object.keys(by).sort(function (a, b) { return by[b].n - by[a].n; });
    if (!keys.length) { $('#db-types').innerHTML = '<p class="db-empty">Nothing uploaded yet.</p>'; return; }
    $('#db-types').innerHTML = '<div class="db-split">' + keys.map(function (k) { return '<i style="width:' + by[k].n / rows.length * 100 + '%;background:' + COLORS[k] + '" title="' + KINDS[k] + '"></i>'; }).join('') + '</div>' +
      '<ul class="db-leg">' + keys.map(function (k) { return '<li><i style="background:' + COLORS[k] + '"></i><span>' + (KINDS[k] || k) + 's</span><b>' + by[k].n + '</b><small>' + num(by[k].d) + ' downloads</small></li>'; }).join('') + '</ul>';
  }

  /* ---------- top by downloads ---------- */
  function top() {
    var t = rows.filter(function (r) { return r.downloads > 0; }).sort(function (a, b) { return b.downloads - a.downloads; }).slice(0, 5);
    if (!t.length) { $('#db-top').innerHTML = '<p class="db-empty">Downloads will show up here once people start using your uploads.</p>'; return; }
    var max = t[0].downloads;
    $('#db-top').innerHTML = '<ol class="db-top">' + t.map(function (r) { return '<li><div class="db-top__r"><a href="#r-' + esc(r.id) + '" translate="no">' + esc(name(r)) + '</a><b>' + num(r.downloads) + '</b></div><div class="db-meter"><i style="width:' + Math.max(3, r.downloads / max * 100) + '%"></i></div></li>'; }).join('') + '</ol>';
  }

  /* ---------- recent activity: new followers + comments on your uploads ---------- */
  function activity() {
    var box = $('#db-act'), ids = rows.slice(0, 100).map(function (r) { return r.id; });
    var byId = {}; rows.forEach(function (r) { byId[r.id] = r; });
    Promise.all([
      sb.from('follows').select('follower,created').eq('following', me.id).order('created', { ascending: false }).limit(6).then(function (r) { return r.data || []; }, function () { return []; }),
      ids.length ? sb.from('upload_comments').select('*').in('upload_id', ids).order('created', { ascending: false }).limit(6).then(function (r) { return r.data || []; }, function () { return []; }) : []
    ]).then(function (res) {
      var ev = [];
      res[0].forEach(function (f) { var p = A.byId(f.follower); if (p) ev.push({ t: Date.parse(f.created), ic: '+', h: '<b translate="no">' + esc(p.name) + '</b> followed you' }); });
      res[1].forEach(function (c) { var p = A.byId(c.owner), u = byId[c.upload_id]; ev.push({ t: Date.parse(c.created), ic: '✉', h: '<b translate="no">' + esc(p ? p.name : 'Someone') + '</b> commented on <span translate="no">' + esc(u ? name(u) : 'your upload') + '</span><br><span class="rc-muted">' + esc((c.body || '').slice(0, 90)) + '</span>' }); });
      ev.sort(function (a, b) { return b.t - a.t; }); ev = ev.slice(0, 8);
      box.innerHTML = ev.length ? '<ul class="db-act">' + ev.map(function (e) { return '<li><span class="db-ico">' + e.ic + '</span><div><p>' + e.h + '</p><small>' + C.ago(e.t) + '</small></div></li>'; }).join('') + '</ul>' : '<p class="db-empty">New followers and comments will appear here.</p>';
    });
  }

  /* ---------- content list ---------- */
  function tabs() {
    var present = Object.keys(KINDS).filter(function (k) { return rows.some(function (r) { return r.kind === k; }); });
    $('#db-tabs').innerHTML = ['All'].concat(present).map(function (k, i) { var v = i ? k : ''; return '<button type="button" data-k="' + v + '" class="' + (tab === v ? 'on' : '') + '">' + (i ? KINDS[k] + 's' : 'All') + '</button>'; }).join('');
  }
  function list() {
    var t = term.toLowerCase(), l = rows.filter(function (r) { return (!tab || r.kind === tab) && (!t || (name(r) + ' ' + (r.file_name || '')).toLowerCase().indexOf(t) > -1); });
    var key = { new: 'created', dl: 'downloads', like: 'likes', cmt: 'comments' }[sort];
    l.sort(function (a, b) { return key === 'created' ? Date.parse(b.created) - Date.parse(a.created) : (b[key] || 0) - (a[key] || 0); });
    $('#db-list').innerHTML = l.length ? l.map(function (r) {
      return '<div class="db-row" id="r-' + esc(r.id) + '" data-id="' + esc(r.id) + '"><div class="db-row__main"><div class="db-row__t"><span translate="no">' + esc(name(r)) + '</span><span class="fd-kind">' + (KINDS[r.kind] || 'Post') + '</span>' + (r.version ? '<span class="fd-ver">v' + esc(r.version.replace(/^v/i, '')) + '</span>' : '') + '</div>' +
        '<div class="db-row__s">' + C.fmtDate(Date.parse(r.created)) + (r.size ? ' · ' + fmtSize(r.size) : '') + '</div></div>' +
        '<div class="db-nums"><span><b>' + num(r.downloads) + '</b>download' + (r.downloads === 1 ? '' : 's') + '</span><span><b>' + num(r.likes) + '</b>like' + (r.likes === 1 ? '' : 's') + '</span><span><b>' + num(r.comments) + '</b>comment' + (r.comments === 1 ? '' : 's') + '</span></div>' +
        '<div class="db-row__a"><button class="btn btn-secondary btn-sm" data-edit="' + esc(r.id) + '" type="button">Edit</button><button class="btn btn-secondary btn-sm db-danger" data-del="' + esc(r.id) + '" type="button">Delete</button></div></div>';
    }).join('') : '<p class="db-empty">' + (rows.length ? 'Nothing matches your filters.' : 'You have not uploaded anything yet. <a class="link-accent" href="index.html">Share your first upload</a>.') + '</p>';
  }
  function drawAll(followers) { kpis(followers); chart(); types(); top(); tabs(); list(); }

  /* ---------- edit / delete ---------- */
  var sheet;
  function ensureSheet() {
    if (sheet) return sheet;
    sheet = document.createElement('div'); sheet.className = 'pf-sheet'; sheet.hidden = true;
    sheet.innerHTML = '<div class="pf-sheet__bg" data-close></div><div class="pf-sheet__box" role="dialog" aria-modal="true" aria-labelledby="db-et"><div class="pf-sheet__grab"></div><div class="pf-sheet__head"><h2 id="db-et">Edit upload</h2><button type="button" class="pf-x" data-close aria-label="Close">×</button></div>' +
      '<form class="pf-sheet__body db-form" id="db-form" novalidate><label for="db-t">Title</label><input class="form-input" id="db-t" maxlength="100"><label for="db-v">Version</label><input class="form-input" id="db-v" maxlength="30" placeholder="1.0.0"><label for="db-b">Description</label><textarea class="form-input" id="db-b" maxlength="2000" rows="4"></textarea><p class="form-error" id="db-err" role="alert"></p><div class="rc-row"><button type="button" class="btn btn-secondary btn-sm" data-close>Cancel</button><button type="submit" class="btn btn-primary btn-sm" id="db-save">Save changes</button></div></form></div>';
    document.body.appendChild(sheet);
    sheet.addEventListener('click', function (e) { if (e.target.closest('[data-close]')) close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !sheet.hidden) close(); });
    return sheet;
  }
  function close() { if (sheet) { sheet.hidden = true; document.documentElement.classList.remove('pf-lock'); } }
  function edit(id) {
    var r = rows.filter(function (x) { return x.id === id; })[0]; if (!r) return; ensureSheet();
    $('#db-t').value = r.title || ''; $('#db-v').value = r.version || ''; $('#db-b').value = r.body || ''; $('#db-err').textContent = '';
    sheet.hidden = false; document.documentElement.classList.add('pf-lock'); $('#db-t').focus();
    $('#db-form').onsubmit = function (e) {
      e.preventDefault(); var btn = $('#db-save'), patch = { title: $('#db-t').value.trim(), version: $('#db-v').value.trim(), body: $('#db-b').value.trim() };
      if (!patch.title && !patch.body && !r.file_url && !r.image) { $('#db-err').textContent = 'Add a title or description'; return; }
      btn.disabled = true; btn.textContent = 'Saving...';
      sb.from('uploads').update(patch).eq('id', id).eq('owner', me.id).select('*').then(function (res) {
        btn.disabled = false; btn.textContent = 'Save changes';
        if (res.error || !res.data || !res.data.length) { $('#db-err').textContent = (res.error && res.error.message) || 'Could not save. Try again.'; return; }
        Object.assign(r, res.data[0]); close(); drawAll(window.__followers || 0); C.toast('Saved');
      }, function () { btn.disabled = false; btn.textContent = 'Save changes'; $('#db-err').textContent = 'Cannot reach the server'; });
    };
  }
  function del(id) {
    var r = rows.filter(function (x) { return x.id === id; })[0]; if (!r) return;
    if (!confirm('Delete "' + name(r) + '"? This cannot be undone.')) return;
    sb.from('uploads').delete().eq('id', id).eq('owner', me.id).select('id').then(function (res) {
      if (res.error || !res.data || !res.data.length) return C.toast('Could not delete', 'error');
      var paths = [r.file_path, r.image_path].filter(Boolean); if (paths.length) sb.storage.from('uploads').remove(paths).then(function () {}, function () {});
      rows = rows.filter(function (x) { return x.id !== id; }); drawAll(window.__followers || 0); C.toast('Deleted');
    });
  }

  function init() {
    me = A.current && A.current(); sb = SBW && SBW.client;
    if (!me || me.guest) {
      gate('<h1>' + (me ? 'Create an account to see your dashboard' : 'Log in to see your dashboard') + '</h1><p class="rc-muted">Your uploads, downloads and followers are collected here.</p><a class="btn btn-primary" href="' + (me ? 'signup.html' : 'login.html') + '">' + (me ? 'Sign up' : 'Log in') + '</a>');
      return;
    }
    $('#db-app').hidden = false; $('#db-gate').hidden = true;
    $('#db-hello').textContent = 'Welcome back, ' + (me.name || me.username).split(' ')[0];
    $('#db-sub').textContent = '@' + me.username + ' · Joined ' + C.fmtDate(me.created);
    $('#db-profile').href = 'user.html?u=' + encodeURIComponent(me.username);
    $('#db-list').innerHTML = '<p class="db-empty">Loading...</p>';
    Promise.all([
      sb.from('uploads').select('*').eq('owner', me.id).order('created', { ascending: false }).limit(500),
      sb.from('follows').select('*', { count: 'exact', head: true }).eq('following', me.id).then(function (r) { return r.count || 0; }, function () { return 0; })
    ]).then(function (res) {
      if (res[0].error) throw res[0].error;
      rows = res[0].data || []; window.__followers = res[1];
      drawAll(res[1]); activity();
    }, function (e) {
      $('#db-list').innerHTML = '<p class="db-empty">' + (/PGRST205|42P01/.test((e && e.code) || '') ? 'The uploads table is missing. Run supabase/schema.sql in Supabase.' : 'Could not load your data. Reload and try again.') + '</p>';
    });
    $('#db-range').addEventListener('click', function (e) { var b = e.target.closest('button[data-d]'); if (!b) return; range = +b.dataset.d; Array.prototype.forEach.call(this.children, function (x) { x.classList.toggle('on', x === b); }); chart(); });
    $('#db-tabs').addEventListener('click', function (e) { var b = e.target.closest('button[data-k]'); if (!b) return; tab = b.dataset.k; tabs(); list(); });
    $('#db-q').addEventListener('input', function (e) { term = e.target.value.trim(); list(); });
    $('#db-sort').addEventListener('change', function (e) { sort = e.target.value; list(); });
    $('#db-list').addEventListener('click', function (e) { var b; if ((b = e.target.closest('[data-edit]'))) edit(b.dataset.edit); else if ((b = e.target.closest('[data-del]'))) del(b.dataset.del); });
  }
  A.ready.then(init);
})();
