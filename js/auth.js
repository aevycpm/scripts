/* ==========================================================================
   Aevy — Accounts on Supabase Auth (email + password) with public profiles.
   Ported from the Aevy backend. Requires, loaded before this file:
     js/config.js  and  the supabase-js UMD bundle.
   Public profile data lives in public.profiles and is cached in memory so pages can
   render synchronously. Usernames are unique (unique index on profiles.username).
   The original RowanAuth API (signup, login, logout, getCurrentUser, updateCurrentUser,
   deleteCurrentUser, addDownload, toggleFavorite, isLoggedIn) is kept; always wait for
   RowanAuth.ready before reading the current user on page load.
   ========================================================================== */
(function () {
  'use strict';
  var cfg = window.ROWAN_CONFIG || {};
  if (!window.supabase || !cfg.url || !cfg.key) {
    console.error('Supabase library or js/config.js is missing');
    window.RowanAuth = { ready: Promise.resolve(), isLoggedIn: function () { return false; }, getCurrentUser: function () { return null; }, current: function () { return null; }, logout: function () { return Promise.resolve(); } };
    return;
  }
  var sb = window.supabase.createClient(cfg.url, cfg.key, { auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  window.RowanSB = { client: sb };

  var COLORS = ['#2563EB', '#0F766E', '#475569', '#B45309', '#BE123C', '#0369A1'];
  var profiles = [], index = {}, user = null, me = null, items = { download: [], favorite: [] }, silent = 0, recovering = false, booted = false;
  var HOME = location.origin + location.pathname.replace(/[^/]*$/, '') + 'login.html';

  function ms(t) { var n = t ? Date.parse(t) : NaN; return isNaN(n) ? Date.now() : n; }
  function pub(p) {
    return { id: p.id, username: p.username, name: p.name, bio: p.bio || '', color: p.color, avatar: p.avatar || '', cover: p.cover || '',
      location: p.location || '', website: p.website || '', role: p.role === 'admin' ? 'admin' : 'user', verified: !!p.verified, guest: !!p.guest, created: ms(p.created) };
  }
  var PCOLS = 'id,username,name,bio,color,avatar,cover,location,website,role,verified,guest,created';
  var PBASE = 'id,username,name,bio,color,avatar,cover,location,website,created';
  function reindex() { index = {}; profiles.forEach(function (p) { index[p.id] = p; }); }
  function hash(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }
  function rowan(msg, extra) { var e = new Error(msg); e.rowan = 1; if (extra) for (var k in extra) e[k] = extra[k]; return e; }
  function nice(e) {
    if (e && e.rowan) return e;
    var c = String((e && (e.code || e.error_code)) || ''), m = String((e && e.message) || e || ''), s = e && e.status;
    if (c === 'invalid_credentials' || /invalid login credentials/i.test(m)) return new Error('Wrong email or password');
    if (c === 'email_not_confirmed' || /email not confirmed/i.test(m)) return new Error('Confirm your email first: open the link we sent you, then log in');
    if (c === 'user_already_exists' || c === 'email_exists' || /already registered/i.test(m)) return new Error('An account with that email already exists. Try logging in instead.');
    if (c === 'weak_password' || /password should be at least|weak/i.test(m)) return new Error('Password must be at least 8 characters');
    if (c === 'same_password' || /different from the old/i.test(m)) return new Error('Choose a password different from the current one');
    if (/invalid email|unable to validate email/i.test(m) || (c === 'validation_failed' && /email/i.test(m))) return new Error('Enter a valid email address');
    if (c === 'over_request_rate_limit' || c === 'over_email_send_rate_limit' || c === 'email_rate_limit_exceeded' || s === 429 || /rate limit|too many/i.test(m)) return new Error('Too many attempts. Wait a minute and try again');
    if (c === 'signup_disabled') return new Error('Sign ups are disabled for this project');
    if (c === 'user_banned') return new Error('This account has been disabled');
    if (c === 'session_not_found' || c === 'reauthentication_needed' || (/jwt|session/i.test(m) && s === 401)) return new Error('Please log in again, then retry');
    if (/database error saving new user/i.test(m) || c === '23505' || /duplicate key/i.test(m)) return new Error('That username is taken. Try another one');
    if (c === '42501' || /row-level security|permission denied/i.test(m)) return new Error('Permission denied by the database. Run the latest supabase/schema.sql in the Supabase SQL editor');
    if (c === '42P01' || c === 'PGRST205' || /schema cache|does not exist/i.test(m)) return new Error('The database tables are missing. Run supabase/schema.sql in the Supabase SQL editor');
    if (/failed to fetch|networkerror|load failed|fetch failed/i.test(m)) return new Error('Cannot reach the server. Check your connection and disable ad blockers/VPN, then retry');
    return new Error(m || 'Request failed');
  }
  function must(r) { if (r.error) throw r.error; return r.data; }

  function loadProfiles() {
    return sb.from('profiles').select(PCOLS).order('created', { ascending: true }).limit(1000).then(function (r) {
      if (r.error && (r.error.code === '42703' || /role|verified|guest/i.test(r.error.message || ''))) {
        console.warn('Run the latest supabase/schema.sql to enable badges');
        return sb.from('profiles').select(PBASE).order('created', { ascending: true }).limit(1000);
      }
      return r;
    }).then(function (r) { profiles = must(r).map(pub); reindex(); });
  }
  function loadItems() {
    items = { download: [], favorite: [] };
    if (!user) return Promise.resolve();
    return sb.from('user_items').select('kind,name,created').eq('owner', user.id).order('created', { ascending: false }).limit(500).then(function (r) {
      if (r.error) return;
      (r.data || []).forEach(function (x) { (items[x.kind] || (items[x.kind] = [])).push({ name: x.name, date: x.created }); });
    }, function () {});
  }
  var EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  function setMe() { me = user ? (index[user.id] || null) : null; }
  function ensureProfile() { return index[user.id] ? Promise.resolve() : loadProfiles(); }
  function finishUp(un, name) {
    setMe(); if (me || !un) return Promise.resolve(me);
    return A.claim(un, name).then(function () { return loadProfiles(); }).then(function () { setMe(); return me; });
  }
  /* the shape the original Rowan pages expect */
  function compat() {
    if (!me) return null;
    return { id: me.id, username: me.username, name: me.name, email: user ? (user.email || '') : '', joined: new Date(me.created).toISOString(),
      plan: me.role === 'admin' ? 'Admin' : (me.verified ? 'Creator' : 'Free'), bio: me.bio, avatar: me.avatar, cover: me.cover, location: me.location, website: me.website,
      role: me.role, verified: me.verified, color: me.color,
      downloads: items.download.slice(0, 50), favorites: items.favorite.map(function (f) { return f.name; }), orders: [] };
  }
  function fire(name) { try { window.dispatchEvent(new Event(name)); } catch (e) {} }

  var A = window.RowanAuth = {
    ready: null,
    /* ---- profile of the signed-in user (cached, synchronous) ---- */
    current: function () { return me; },
    getCurrentUser: compat,
    isLoggedIn: function () { return !!me; },
    isAdmin: function () { return !!(me && me.role === 'admin'); },
    email: function () { return user ? (user.email || '') : ''; },
    recovery: function () { return recovering; },
    byName: function (n) { var k = String(n).toLowerCase(); return profiles.filter(function (u) { return u.username === k; })[0]; },
    byId: function (id) { return index[id]; },
    all: function () { return profiles.filter(function (u) { return !u.guest || (me && (me.guest || me.id === u.id)); }); },
    refreshProfiles: function () { return loadProfiles().then(setMe); },
    /* true = free, false = taken, null = could not check (never blocks the form) */
    checkUsername: function (un) {
      un = String(un || '').trim().toLowerCase();
      if (!/^[a-z0-9_]{3,20}$/.test(un)) return Promise.resolve(null);
      return sb.from('profiles').select('id').eq('username', un).limit(1).then(function (r) {
        if (r.error) return null;
        return r.data.length ? !!(user && r.data[0].id === user.id) : true;
      }, function () { return null; });
    },
    claim: function (un, name) {
      return sb.from('profiles').insert({ id: user.id, username: un, name: name, bio: '', color: COLORS[hash(un) % COLORS.length] }).then(function (r) {
        if (r.error) { if (r.error.code === '23505') throw rowan('That username is taken. Try another one', { taken: 1 }); throw r.error; }
      });
    },
    /* ---- sign up / log in / log out ---- */
    signup: function (o) {
      var un = String(o.username || '').trim().toLowerCase(), pw = o.password || '', email = String(o.email || '').trim();
      if (!/^[a-z0-9_]{3,20}$/.test(un)) return Promise.reject(new Error('Username: 3 to 20 letters, numbers or underscores'));
      if (!EMAIL_RE.test(email)) return Promise.reject(new Error('Please enter a valid email address.'));
      if (pw.length < 8) return Promise.reject(new Error('Password must be at least 8 characters'));
      var name = ((o.name || un).trim() || un).slice(0, 40);
      silent++;
      return A.checkUsername(un).then(function (free) {
        if (free === false) throw rowan('That username is taken. Try another one');
        /* username + name travel as user metadata; a database trigger creates the profile */
        return sb.auth.signUp({ email: email, password: pw, options: { data: { username: un, name: name }, emailRedirectTo: HOME } }).then(must);
      }).then(function (d) {
        if (d.user && d.user.identities && d.user.identities.length === 0) throw rowan('An account with that email already exists. Try logging in instead.');
        if (!d.session) throw rowan('Account created. Open the confirmation link we emailed you, then log in', { confirm: 1 });
        user = d.session.user;
        return loadProfiles().then(function () { return finishUp(un, name); });
      }).then(function () { return loadItems(); }).then(function () { silent--; fire('rowan:auth'); return compat(); }, function (e) { silent--; throw nice(e); });
    },
    login: function (o) {
      var email = String((o && o.email) || '').trim(), pw = (o && o.password) || '';
      if (!email || !pw) return Promise.reject(new Error('Please enter your email and password.'));
      if (!EMAIL_RE.test(email)) return Promise.reject(new Error('Enter a valid email address'));
      silent++;
      return sb.auth.signInWithPassword({ email: email, password: pw }).then(must).then(function (d) {
        user = d.user;
        return ensureProfile().then(function () { setMe(); return loadItems(); });
      }).then(function () { silent--; fire('rowan:auth'); return compat(); }, function (e) { silent--; throw nice(e); });
    },
    logout: function () {
      silent++;
      return sb.auth.signOut().then(function () {}, function () {}).then(function () { user = null; me = null; items = { download: [], favorite: [] }; silent--; fire('rowan:auth'); });
    },
    pending: function () { return !!user && !me; },
    suggest: function () {
      if (!user) return { name: '', username: '' };
      var md = user.user_metadata || {}, full = md.full_name || md.name || '';
      var base = String(full || (user.email || '').split('@')[0] || '').toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 16);
      return { name: full, username: base.length >= 3 ? base : '' };
    },
    completeProfile: function (o) {
      if (!user) return Promise.reject(new Error('Log in first'));
      var un = String(o.username || '').trim().toLowerCase();
      if (!/^[a-z0-9_]{3,20}$/.test(un)) return Promise.reject(new Error('Username: 3 to 20 letters, numbers or underscores'));
      var name = ((o.name || un).trim() || un).slice(0, 40);
      silent++;
      return A.claim(un, name).then(function () { return loadProfiles(); }).then(function () { setMe(); return loadItems(); })
        .then(function () { silent--; fire('rowan:auth'); return me; }, function (e) { silent--; throw nice(e); });
    },
    resetPassword: function (email) {
      email = String(email || '').trim();
      if (!EMAIL_RE.test(email)) return Promise.reject(new Error('Enter your email address first'));
      return sb.auth.resetPasswordForEmail(email, { redirectTo: HOME }).then(function (r) {
        if (r.error && r.error.code !== 'user_not_found') throw nice(r.error);   /* never reveal whether an address has an account */
      }, function (e) { throw nice(e); });
    },
    setNewPassword: function (pw) {
      if ((pw || '').length < 8) return Promise.reject(new Error('Password must be at least 8 characters'));
      return sb.auth.updateUser({ password: pw }).then(must).then(function () { recovering = false; }, function (e) { throw nice(e); });
    },
    /* ---- profile editing ---- */
    update: function (p) {
      if (!me) return Promise.reject(new Error('Log in first'));
      var f = {};
      if (p.name != null) f.name = String(p.name).trim().slice(0, 40) || me.name;
      if (p.bio != null) f.bio = String(p.bio).slice(0, 280);
      if (p.color) f.color = p.color;
      if (p.location != null) f.location = String(p.location).trim().slice(0, 40);
      if (p.website != null) {
        var w = String(p.website).trim();
        if (w && !/^https?:\/\//i.test(w)) w = 'https://' + w;
        if (w && !/^https?:\/\/[^\s.]+\.[^\s]+$/i.test(w)) return Promise.reject(new Error('Enter a valid website address'));
        f.website = w.slice(0, 100);
      }
      if (p.avatar != null) f.avatar = p.avatar;
      if (p.cover != null) f.cover = p.cover;
      return sb.from('profiles').update(f).eq('id', me.id).select(PCOLS).single().then(must).then(function (d) {
        var n = pub(d); profiles = profiles.map(function (u) { return u.id === n.id ? n : u; }); reindex(); me = n; fire('rowan:auth'); return n;
      }).then(null, function (e) { throw nice(e); });
    },
    /* Original API: change display name and/or email. Username stays permanent. */
    updateCurrentUser: function (fields) {
      fields = fields || {};
      var jobs = [];
      if (fields.name != null || fields.bio != null || fields.location != null || fields.website != null) {
        jobs.push(A.update({ name: fields.name, bio: fields.bio, location: fields.location, website: fields.website }));
      }
      if (fields.email && user && String(fields.email).trim().toLowerCase() !== String(user.email || '').toLowerCase()) {
        if (!EMAIL_RE.test(fields.email)) return Promise.reject(new Error('Enter a valid email address'));
        jobs.push(sb.auth.updateUser({ email: String(fields.email).trim() }).then(must).then(function (d) { if (d && d.user) user = d.user; }, function (e) { throw nice(e); }));
      }
      return Promise.all(jobs).then(compat);
    },
    /* Uploads a profile photo ('avatar') or cover photo ('cover') to Storage and saves its address on the profile. */
    setImage: function (kind, blob) {
      if (!me) return Promise.reject(new Error('Log in first'));
      if (kind !== 'avatar' && kind !== 'cover') return Promise.reject(new Error('Unknown image'));
      var path = me.id + '/' + kind + '.jpg';
      return sb.storage.from('avatars').upload(path, blob, { upsert: true, contentType: 'image/jpeg', cacheControl: '3600' }).then(function (r) {
        if (r.error) throw r.error;
        var url = sb.storage.from('avatars').getPublicUrl(path).data.publicUrl + '?v=' + Date.now();
        var o = {}; o[kind] = url; return A.update(o);
      }).then(null, function (e) {
        var m = String((e && e.message) || e);
        if (/bucket not found/i.test(m)) throw new Error('Photo storage is not set up. Run the latest supabase/schema.sql in the Supabase SQL editor');
        if (/row-level security|not authorized|unauthorized/i.test(m)) throw new Error('Not allowed to upload. Run the latest supabase/schema.sql in the Supabase SQL editor');
        throw nice(e);
      });
    },
    removeImage: function (kind) {
      if (!me) return Promise.reject(new Error('Log in first'));
      var o = {}; o[kind] = '';
      return A.update(o).then(function (n) { sb.storage.from('avatars').remove([me.id + '/' + kind + '.jpg']).then(function () {}, function () {}); return n; });
    },
    purgeImages: function () { return me ? sb.storage.from('avatars').remove([me.id + '/avatar.jpg', me.id + '/cover.jpg']).then(function () {}, function () {}) : Promise.resolve(); },
    /* re-checks the password by signing in again */
    verify: function (pw, msg) {
      return sb.auth.signInWithPassword({ email: user.email, password: pw }).then(function (r) {
        if (r.error) {
          if (r.error.code === 'invalid_credentials' || /invalid login credentials/i.test(r.error.message || '')) throw new Error(msg || 'Password is wrong');
          throw r.error;
        }
      });
    },
    changePassword: function (oldPw, newPw) {
      if (!me) return Promise.reject(new Error('Log in first'));
      if ((newPw || '').length < 8) return Promise.reject(new Error('New password must be at least 8 characters'));
      silent++;
      return A.verify(oldPw, 'Current password is wrong').then(function () { return sb.auth.updateUser({ password: newPw }).then(must); })
        .then(function () { silent--; }, function (e) { silent--; throw nice(e); });
    },
    /* Deletes the account (profile, scripts, posts, messages, photos). Pass the password to confirm. */
    remove: function (pw, cleanup) {
      if (!me) return Promise.reject(new Error('Log in first'));
      silent++;
      return A.verify(pw, 'Password is wrong').then(function () { return cleanup ? cleanup() : null; }).then(function () { return A.purgeImages(); }).then(function () {
        return sb.rpc('delete_my_account').then(must);
      }).then(function () { return sb.auth.signOut({ scope: 'local' }).catch(function () {}); }).then(function () {
        user = null; me = null; items = { download: [], favorite: [] }; return loadProfiles().catch(function () {});
      }).then(function () { silent--; fire('rowan:auth'); }, function (e) { silent--; throw nice(e); });
    },
    deleteCurrentUser: function (pw) { return A.remove(pw); },
    /* ---- catalog downloads and favorites (saved to the account) ---- */
    addDownload: function (name) {
      if (!me) return null;
      items.download = items.download.filter(function (d) { return d.name !== name; });
      items.download.unshift({ name: name, date: new Date().toISOString() });
      sb.from('user_items').upsert({ owner: me.id, kind: 'download', name: name, created: new Date().toISOString() }, { onConflict: 'owner,kind,name' }).then(function () {}, function () {});
      return compat();
    },
    toggleFavorite: function (name) {
      if (!me) return null;
      var i = -1; items.favorite.forEach(function (f, k) { if (f.name === name) i = k; });
      if (i === -1) {
        items.favorite.unshift({ name: name, date: new Date().toISOString() });
        sb.from('user_items').upsert({ owner: me.id, kind: 'favorite', name: name }, { onConflict: 'owner,kind,name' }).then(function () {}, function () {});
      } else {
        items.favorite.splice(i, 1);
        sb.from('user_items').delete().eq('owner', me.id).eq('kind', 'favorite').eq('name', name).then(function () {}, function () {});
      }
      return compat();
    }
  };

  /* Registered immediately so the PASSWORD_RECOVERY event of a reset link is never missed.
     Do not call Supabase inside this callback. */
  sb.auth.onAuthStateChange(function (ev, session) {
    if (ev === 'PASSWORD_RECOVERY') { recovering = true; setTimeout(function () { fire('rowan:recovery'); }, 0); }
    if (silent || !booted) return;
    var u = session ? session.user : null, before = user ? user.id : null, after = u ? u.id : null;   /* sign-out / session change in another tab */
    if (before === after) { if (u) user = u; return; }
    user = u;
    setTimeout(function () {
      (u ? ensureProfile().then(loadItems).catch(function () {}) : Promise.resolve()).then(function () { setMe(); fire('rowan:auth'); });
    }, 0);
  });

  /* Wait for Supabase to restore a saved session (or finish a reset-link return), then load profiles. */
  A.ready = sb.auth.getSession().then(function (r) {
    user = (r.data && r.data.session && r.data.session.user) || null;
    return loadProfiles().catch(function (e) { console.error(e); });
  }).then(function () { setMe(); return loadItems(); }).then(function () { booted = true; }, function () { booted = true; });
})();

/* ---------------- Shared header UI wiring (same markup and classes as before) ---------------- */
document.addEventListener('DOMContentLoaded', function () {
  function escapeHtml(str) { return String(str).replace(/[&<>"']/g, function (s) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[s]; }); }
  function initials(name) { return String(name).trim().split(/\s+/).map(function (w) { return w[0]; }).slice(0, 2).join('').toUpperCase() || '?'; }
  function safeImg(u) { return /^https:\/\//i.test(u || '') ? u : ''; }

  function userDropdownMarkup(user) {
    var shown = user.name || user.username, img = safeImg(user.avatar);
    return '\n      <button class="user-chip" data-auth-chip>\n        <span class="user-chip__avatar">' + (img ? '<img src="' + escapeHtml(img) + '" alt="" style="width:100%;height:100%;border-radius:inherit;object-fit:cover">' : escapeHtml(initials(shown))) + '</span>\n        <span class="user-chip__name">' + escapeHtml(shown) + '</span>\n        <svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>\n      </button>\n      <div class="user-dropdown">\n        <a href="profile.html"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>My Profile</a>\n        <a href="dashboard.html"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>Dashboard</a>\n        <a href="messages.html"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>Messages<span data-unread-badge></span></a>\n        <a href="community.html"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>Community</a>\n        <a href="profile.html#downloads"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z"/></svg>My Downloads</a>\n        <hr>\n        <button type="button" data-auth-logout><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>Log Out</button>\n      </div>';
  }

  function wireUserMenu(menuEl) {
    /* main.js wires .user-menu once at page load, before this async render, so the toggle is wired here */
    var chip = menuEl.querySelector('.user-chip'), dd = menuEl.querySelector('.user-dropdown');
    if (chip && dd) chip.addEventListener('click', function (e) { e.stopPropagation(); dd.classList.toggle('show'); });
    var out = menuEl.querySelector('[data-auth-logout]');
    if (out) out.addEventListener('click', function () { RowanAuth.logout().then(function () { window.location.href = 'index.html'; }); });
  }

  function renderHeaderAuthState() {
    var user = RowanAuth.getCurrentUser();
    if (!user) return;
    /* index/scripts/games/apps/support: a login/signup button pair sits in .header-auth-buttons */
    document.querySelectorAll('.header-auth-buttons').forEach(function (container) {
      if (container.closest('.mobile-nav')) return;   /* the mobile drawer keeps its own buttons */
      var menu = document.createElement('div');
      menu.className = 'user-menu';
      menu.innerHTML = userDropdownMarkup(user);
      container.replaceWith(menu);
      wireUserMenu(menu);
    });
    /* profile.html: a static user-menu exists in the markup */
    document.querySelectorAll('.user-menu[data-static]').forEach(function (menu) {
      menu.innerHTML = userDropdownMarkup(user);
      wireUserMenu(menu);
    });
  }

  RowanAuth.ready.then(function () {
    renderHeaderAuthState();
    var m = RowanAuth.current();
    if (m && window.RowanSocial && RowanSocial.start) RowanSocial.start();
  });

  /* ---------------- Download buttons persist to the real account ---------------- */
  document.querySelectorAll('[data-download]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var name = btn.dataset.download;
      if (RowanAuth.isLoggedIn()) {
        RowanAuth.addDownload(name);
      } else if (window.showToast) {
        setTimeout(function () { window.showToast('Log in to save this to your account', 'error'); }, 350);
      }
    });
  });
});
