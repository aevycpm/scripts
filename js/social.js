/* Aevy social layer (data + realtime, no markup): follows, online status, encrypted direct messages,
   community posts with likes and comments. Tables, policies and functions: supabase/schema.sql.
   Pages (community.html, messages.html, user.html) draw the interface with Rowan's own styles. */
(function () {
  'use strict';
  var A = window.RowanAuth, SB = window.RowanSB && window.RowanSB.client, C = window.RowanCore;
  if (!A || !SB || !C) return;
  function me() { return A.current(); }
  function fire(n, d) { try { window.dispatchEvent(new CustomEvent(n, { detail: d })); } catch (e) {} }
  function E() { return window.RowanE2E; }
  function must(r) { if (r.error) throw r.error; return r.data; }
  var HIDE_KEY = 'rowan.hideStatus';
  function hidden() { try { return localStorage.getItem(HIDE_KEY) === '1'; } catch (e) { return false; } }

  /* ================= online / offline ================= */
  var seen = {};
  function isOnline(id) { return !!seen[id] && Date.now() - seen[id] < 150000; }
  function lastSeen(id) {
    var t = seen[id]; if (!t) return '';
    var d = Math.max(0, (Date.now() - t) / 1000);
    if (d < 150) return 'Online';
    if (d < 3600) return 'Last seen ' + Math.round(d / 60) + ' min ago';
    if (d < 86400) return 'Last seen ' + Math.round(d / 3600) + ' h ago';
    if (d < 86400 * 7) return 'Last seen ' + Math.round(d / 86400) + ' d ago';
    return 'Last seen ' + C.fmtDate(t);
  }
  function beat() {
    if (!me() || document.hidden) return Promise.resolve();
    return SB.rpc('touch_presence', { hide: hidden() }).then(function (r) { if (!r.error && !hidden()) seen[me().id] = Date.now(); }, function () {});
  }
  function pollOnline(ids) {
    return SB.rpc('get_presence', ids && ids.length ? { ids: ids } : {}).then(function (r) {
      if (r.error) return;
      (r.data || []).forEach(function (x) { if (x.last_seen) seen[x.user_id] = Date.parse(x.last_seen); else delete seen[x.user_id]; });
      fire('rowan:presence');
    }, function () {});
  }

  /* ================= follows ================= */
  var following = {};
  function loadFollowing() {
    following = {};
    if (!me()) return Promise.resolve();
    return SB.from('follows').select('following').eq('follower', me().id).limit(5000).then(function (r) {
      if (!r.error) (r.data || []).forEach(function (x) { following[x.following] = 1; });
    }, function () {});
  }
  function counts(id) {
    var q = function (col) { return SB.from('follows').select('*', { count: 'exact', head: true }).eq(col, id).then(function (r) { return r.count || 0; }, function () { return 0; }); };
    return Promise.all([q('following'), q('follower')]).then(function (c) {   /* [followers, following] */
      var b = C.boost(A.byId(id)); if (b) c[0] = Math.max(c[0], b);          /* display-only boost from config.js */
      return c;
    });
  }
  function toggleFollow(id) {
    if (!me()) return Promise.reject(new Error('Log in first'));
    var was = !!following[id];
    var q = was ? SB.from('follows').delete().eq('follower', me().id).eq('following', id) : SB.from('follows').insert({ follower: me().id, following: id });
    return q.then(function (r) { if (r.error) throw r.error; if (was) delete following[id]; else following[id] = 1; fire('rowan:following'); return !was; });
  }
  function people(id, kind) {   /* kind: 'followers' | 'following' */
    var col = kind === 'followers' ? 'follower' : 'following', other = kind === 'followers' ? 'following' : 'follower';
    return SB.from('follows').select(col).eq(other, id).order('created', { ascending: false }).limit(200).then(function (r) {
      var ids = (must(r) || []).map(function (x) { return x[col]; });
      var miss = ids.filter(function (i) { return !A.byId(i); });
      return (miss.length ? A.refreshProfiles().catch(function () {}) : Promise.resolve()).then(function () {
        return ids.map(function (i) { return A.byId(i); }).filter(Boolean);
      });
    });
  }
  function followsMe(id) {
    if (!me()) return Promise.resolve(false);
    return SB.from('follows').select('follower').eq('follower', id).eq('following', me().id).limit(1).then(function (r) { return !r.error && !!(r.data && r.data.length); }, function () { return false; });
  }

  /* ================= direct messages (end-to-end encrypted) ================= */
  var msgs = [], loaded = false, chan = null, tchan = null, typing = {}, tout = {}, outCh = {}, lastTyped = {}, tmpN = 0;
  function mrow(r) { return { id: r.id, s: r.sender, r: r.recipient, body: r.body, t: Date.parse(r.created) || Date.now(), read: !!r.read_at }; }
  function opened(rows) { return Promise.all((rows || []).map(function (r) { var m = mrow(r); return E() ? E().open(m) : Promise.resolve(m); })); }
  function addMsg(m) { for (var i = 0; i < msgs.length; i++) if (msgs[i].id === m.id) return false; msgs.push(m); return true; }
  function loadMsgs() {
    if (!me()) return Promise.resolve();
    var id = me().id;
    return SB.from('messages').select('*').or('sender.eq.' + id + ',recipient.eq.' + id).order('created', { ascending: false }).limit(500).then(function (r) {
      if (r.error) throw r.error;
      return opened(r.data).then(function (list) { msgs = list; loaded = true; fire('rowan:msgs'); });
    });
  }
  function loadPair(other) {
    var a = me().id;
    return SB.from('messages').select('*').or('and(sender.eq.' + a + ',recipient.eq.' + other + '),and(sender.eq.' + other + ',recipient.eq.' + a + ')').order('created', { ascending: false }).limit(200).then(function (r) {
      if (r.error) return; return opened(r.data).then(function (list) { list.forEach(addMsg); fire('rowan:msgs'); });
    });
  }
  function unreadFrom(id) { return msgs.filter(function (m) { return m.s === id && m.r === me().id && !m.read; }).length; }
  function unreadTotal() { return me() ? msgs.filter(function (m) { return m.r === me().id && !m.read; }).length : 0; }
  function pair(pid) { var id = me().id; return msgs.filter(function (m) { return (m.s === id && m.r === pid) || (m.s === pid && m.r === id); }).sort(function (a, b) { return a.t - b.t; }); }
  function convos() {
    var id = me().id, map = {};
    msgs.forEach(function (m) { var o = m.s === id ? m.r : m.s; if (!map[o] || m.t > map[o].t) map[o] = m; });
    return Object.keys(map).map(function (o) { return { id: o, last: map[o], n: unreadFrom(o) }; }).filter(function (c) { return A.byId(c.id); }).sort(function (a, b) { return b.last.t - a.last.t; });
  }
  /* resolves with the stored message; rejects with a readable Error (e.code: locked | nokey | off) */
  function send(rid, text) {
    text = String(text || '').trim();
    if (!text) return Promise.reject(new Error('Write something first'));
    if (text.length > 4000) return Promise.reject(new Error('Messages are limited to 1500 characters'));
    var tmp = { id: 'tmp' + (++tmpN), s: me().id, r: rid, body: text, t: Date.now(), read: false, pending: true };
    msgs.push(tmp); fire('rowan:msgs');
    var e = E();
    return (e ? e.encrypt(rid, text) : Promise.reject({ code: 'off' })).then(function (ct) {
      return SB.from('messages').insert({ sender: me().id, recipient: rid, body: ct }).select('*').single();
    }).then(function (r) {
      msgs = msgs.filter(function (x) { return x !== tmp; });
      if (r.error) {
        var m = r.error.message || '';
        fire('rowan:msgs');
        throw new Error(/too fast/i.test(m) ? 'You are sending messages too fast. Wait a moment' : /row-level security|42501|42P01|PGRST205/i.test(m + (r.error.code || '')) ? 'Messaging is not set up yet. Run the latest supabase/schema.sql' : (m || 'Could not send'));
      }
      var row = mrow(r.data); row.body = text; addMsg(row); fire('rowan:msgs'); return row;
    }, function (x) {
      msgs = msgs.filter(function (y) { return y !== tmp; }); fire('rowan:msgs');
      var c = x && x.code, er;
      if (c === 'locked') { er = new Error('Unlock your messages first'); }
      else if (c === 'nokey') { var u = A.byId(rid); er = new Error((u ? '@' + u.username : 'This person') + ' has not turned on encrypted messages yet. They need to open Messages once.'); }
      else if (c === 'off') { er = new Error('Encrypted messages are not available here. Use a current browser over https.'); }
      else { er = (x instanceof Error) ? x : new Error('Cannot reach the server'); }
      er.code = c; throw er;
    });
  }
  function unsend(id) {
    return SB.from('messages').delete().eq('id', id).then(function (r) { if (r.error) throw r.error; msgs = msgs.filter(function (x) { return x.id !== id; }); fire('rowan:msgs'); });
  }
  /* ---- emoji reactions: reacts[messageId][userId] = emoji ---- */
  var reacts = {};
  function loadReactions(pid) {
    var ids = pair(pid).map(function (m) { return m.id; }).filter(function (i) { return i.indexOf('tmp') !== 0; }).slice(-200);
    if (!ids.length) return Promise.resolve();
    return SB.from('message_reactions').select('message_id,owner,emoji').in('message_id', ids).then(function (r) {
      if (r.error) return;
      ids.forEach(function (i) { delete reacts[i]; });
      (r.data || []).forEach(function (x) { (reacts[x.message_id] = reacts[x.message_id] || {})[x.owner] = x.emoji; });
      fire('rowan:msgs');
    }, function () {});
  }
  function reactionsOf(mid) { return reacts[mid] || {}; }
  /* same emoji again removes your reaction; a different emoji replaces it */
  function react(mid, emoji) {
    if (!me()) return Promise.reject(new Error('Log in first'));
    var id = me().id, cur = (reacts[mid] || {})[id], set = function (e) { reacts[mid] = reacts[mid] || {}; if (e) reacts[mid][id] = e; else delete reacts[mid][id]; fire('rowan:msgs'); };
    var del = function () { return SB.from('message_reactions').delete().eq('message_id', mid).eq('owner', id).then(function (r) { if (r.error) throw r.error; }); };
    if (cur === emoji) { set(null); return del().then(null, function (e) { set(cur); throw e; }); }
    set(emoji);
    return (cur ? del() : Promise.resolve()).then(function () { return SB.from('message_reactions').insert({ message_id: mid, owner: id, emoji: emoji }); })
      .then(function (r) { if (r && r.error) throw r.error; }, function (e) { set(cur || null); throw e; });
  }
  function markRead(pid) {
    var any = false; msgs.forEach(function (m) { if (m.s === pid && m.r === me().id && !m.read) { m.read = true; any = true; } });
    if (any) fire('rowan:msgs');
    return SB.rpc('mark_read', { other: pid }).then(function () {}, function () {});
  }
  /* live typing indicator (broadcast, never stored) */
  function typingTo(pid) {
    if (Date.now() - (lastTyped[pid] || 0) < 2500) return; lastTyped[pid] = Date.now();
    var ch = outCh[pid]; if (!ch) { ch = outCh[pid] = SB.channel('rowan-typing-' + pid); ch.subscribe(); }
    try { ch.send({ type: 'broadcast', event: 'typing', payload: { from: me().id } }); } catch (e) {}
  }
  function isTyping(id) { return !!typing[id]; }
  function listen() {
    if (chan) { try { SB.removeChannel(chan); } catch (e) {} chan = null; }
    if (tchan) { try { SB.removeChannel(tchan); } catch (e) {} tchan = null; }
    if (!me()) return;
    chan = SB.channel('rowan-dm-' + me().id)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, function (p) {
        var id = me().id; if (p.new.sender !== id && p.new.recipient !== id) return;
        opened([p.new]).then(function (l) {
          var m = l[0]; if (!addMsg(m)) return;
          if (m.r === id) { delete typing[m.s]; fire('rowan:incoming', m); }
          fire('rowan:msgs');
        });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, function (p) {
        var n = p.new; if (!n || !n.id) return;
        for (var i = 0; i < msgs.length; i++) if (msgs[i].id === n.id) { var was = msgs[i].read; msgs[i].read = !!n.read_at; if (was !== msgs[i].read) fire('rowan:msgs'); break; }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_reactions' }, function (p) {
        var n = p.new && p.new.message_id ? p.new : p.old; if (!n || !n.message_id) return;
        if (!msgs.some(function (m) { return m.id === n.message_id; })) return;
        var box = reacts[n.message_id] = reacts[n.message_id] || {};
        if (p.eventType === 'DELETE') delete box[n.owner]; else box[n.owner] = p.new.emoji;
        fire('rowan:msgs');
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, function (p) {
        var id = p.old && p.old.id; if (!id) return;
        msgs = msgs.filter(function (x) { return x.id !== id; }); fire('rowan:msgs');
      }).subscribe();
    tchan = SB.channel('rowan-typing-' + me().id).on('broadcast', { event: 'typing' }, function (p) {
      var f = p && p.payload && p.payload.from; if (!f) return;
      typing[f] = 1; clearTimeout(tout[f]); tout[f] = setTimeout(function () { delete typing[f]; fire('rowan:typing'); }, 4000); fire('rowan:typing');
    }).subscribe();
  }

  /* ================= community posts ================= */
  function prow(r) { return { id: r.id, owner: r.owner, body: r.body, script_id: r.script_id, likes: r.likes || 0, comments: r.comments || 0, t: Date.parse(r.created) || Date.now() }; }
  var myPostLikes = {};
  function loadMyPostLikes() {
    myPostLikes = {}; if (!me()) return Promise.resolve();
    return SB.from('post_likes').select('post_id').eq('owner', me().id).limit(3000).then(function (r) { (r.data || []).forEach(function (x) { myPostLikes[x.post_id] = 1; }); }, function () {});
  }
  /* opts: {owner, followingOnly, before (ms), limit} */
  function listPosts(o) {
    o = o || {};
    var q = SB.from('posts').select('*').order('created', { ascending: false }).limit(o.limit || 20);
    if (o.owner) q = q.eq('owner', o.owner);
    if (o.owners) q = q.in('owner', o.owners.length ? o.owners : ['00000000-0000-0000-0000-000000000000']);
    if (o.before) q = q.lt('created', new Date(o.before).toISOString());
    return q.then(function (r) { return must(r).map(prow); });
  }
  function createPost(body, scriptId) {
    body = String(body || '').trim();
    if (!me()) return Promise.reject(new Error('Log in first'));
    if (!body) return Promise.reject(new Error('Write something first'));
    if (body.length > 1000) return Promise.reject(new Error('Posts are limited to 1000 characters'));
    var row = { owner: me().id, body: body }; if (scriptId) row.script_id = scriptId;
    return SB.from('posts').insert(row).select('*').single().then(function (r) {
      if (r.error) throw new Error(/too fast/i.test(r.error.message || '') ? 'You are posting too fast. Wait a moment' : (r.error.message || 'Could not post'));
      return prow(r.data);
    });
  }
  function deletePost(id) { return SB.from('posts').delete().eq('id', id).then(function (r) { if (r.error) throw r.error; }); }
  function togglePostLike(id) {
    if (!me()) return Promise.reject(new Error('Log in first'));
    var was = !!myPostLikes[id];
    var q = was ? SB.from('post_likes').delete().eq('post_id', id).eq('owner', me().id) : SB.from('post_likes').insert({ post_id: id, owner: me().id });
    return q.then(function (r) { if (r.error) throw r.error; if (was) delete myPostLikes[id]; else myPostLikes[id] = 1; return !was; });
  }
  function crow(r) { return { id: r.id, post_id: r.post_id, owner: r.owner, body: r.body, t: Date.parse(r.created) || Date.now() }; }
  function listComments(pid) { return SB.from('post_comments').select('*').eq('post_id', pid).order('created', { ascending: true }).limit(200).then(function (r) { return must(r).map(crow); }); }
  function addComment(pid, body) {
    body = String(body || '').trim();
    if (!me()) return Promise.reject(new Error('Log in first'));
    if (!body) return Promise.reject(new Error('Write something first'));
    return SB.from('post_comments').insert({ post_id: pid, owner: me().id, body: body }).select('*').single().then(function (r) {
      if (r.error) throw new Error(/too fast/i.test(r.error.message || '') ? 'You are commenting too fast. Wait a moment' : (r.error.message || 'Could not comment'));
      return crow(r.data);
    });
  }
  function deleteComment(id) { return SB.from('post_comments').delete().eq('id', id).then(function (r) { if (r.error) throw r.error; }); }
  /* live: new / removed posts and comments */
  var feedCh = null;
  function watchPosts(cb) {
    if (feedCh) { try { SB.removeChannel(feedCh); } catch (e) {} }
    feedCh = SB.channel('rowan-posts-' + Math.random().toString(36).slice(2, 7))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, function (p) { cb('posts', p); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'post_comments' }, function (p) { cb('comments', p); })
      .subscribe();
    return function () { try { SB.removeChannel(feedCh); } catch (e) {} feedCh = null; };
  }

  /* ================= start ================= */
  var started = false, timer = null;
  function start() {
    if (!me()) return Promise.resolve();
    if (!started) {
      started = true;
      timer = setInterval(function () { beat().then(function () { return pollOnline(); }); }, 45000);
      document.addEventListener('visibilitychange', function () { if (!document.hidden) beat().then(function () { return pollOnline(); }); });
    }
    beat(); listen();
    return Promise.all([loadFollowing(), loadMyPostLikes(), E() ? E().init(me()) : null]).then(loadMsgs).then(function () { return pollOnline(); }).catch(function (e) { console.warn('[rowan] social:', e && e.message); });
  }
  function paintUnread() {
    var n = me() ? unreadTotal() : 0;
    document.querySelectorAll('[data-unread-badge]').forEach(function (el) {
      el.textContent = n ? String(n > 99 ? '99+' : n) : '';
      el.style.cssText = n ? 'margin-left:auto;background:var(--color-primary);color:#fff;border-radius:999px;font-size:11px;font-weight:700;padding:1px 7px' : '';
    });
    document.querySelectorAll('.user-chip').forEach(function (c) { c.classList.toggle('has-unread', n > 0); });
  }
  window.addEventListener('rowan:msgs', paintUnread);
  window.addEventListener('rowan:auth', function () { if (me()) start(); else { msgs = []; following = {}; myPostLikes = {}; paintUnread(); if (chan) { try { SB.removeChannel(chan); } catch (e) {} chan = null; } } });

  window.RowanSocial = {
    start: start, beat: beat, pollOnline: pollOnline, isOnline: isOnline, lastSeen: lastSeen,
    statusHidden: hidden, setStatusVisible: function (v) { try { localStorage.setItem(HIDE_KEY, v ? '0' : '1'); } catch (e) {} return beat(); },
    following: function () { return following; }, isFollowing: function (id) { return !!following[id]; }, counts: counts, toggleFollow: toggleFollow, people: people, followsMe: followsMe,
    loadMsgs: loadMsgs, loadPair: loadPair, loadReactions: loadReactions, reactionsOf: reactionsOf, react: react, convos: convos, pair: pair, unreadFrom: unreadFrom, unread: unreadTotal, send: send, unsend: unsend, markRead: markRead,
    typingTo: typingTo, isTyping: isTyping, messagesLoaded: function () { return loaded; },
    listPosts: listPosts, createPost: createPost, deletePost: deletePost, postLiked: function (id) { return !!myPostLikes[id]; }, togglePostLike: togglePostLike,
    listComments: listComments, addComment: addComment, deleteComment: deleteComment, watchPosts: watchPosts
  };
})();
