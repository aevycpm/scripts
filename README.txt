Aevy (Supabase backend)
===========================
The pages and design are the original Aevy ones. Accounts, profiles, community posts,
published scripts, follows and encrypted messages now run on Supabase (ported from Aevy).

Setup (one time, about 5 minutes)
---------------------------------
1. Supabase dashboard -> SQL Editor -> New query -> paste all of supabase/schema.sql -> Run.
   Safe to run again. Without it every request fails.
2. Authentication -> Sign In / Providers -> Email: enabled. Recommended: turn OFF "Confirm email".
3. Authentication -> URL Configuration: Site URL and Redirect URLs = the address of your site
   (plus http://localhost:8080/ for local tests). Password-reset links return to login.html.
4. js/config.js holds the project URL and publishable key (public by design; RLS protects data).
   It currently points at the same Supabase project Aevy used: replace both values to use a new project.
5. Serve the folder over http(s), not file://  (npx serve .   or   python3 -m http.server 8080).

Pages
-----
login.html / signup.html   Supabase email + password, password reset, unique usernames
profile.html               name, email, bio, location, website, profile + cover photo, password, delete account,
                           downloads and favorites (saved to the account)
community.html             feed (posts, likes, comments, following filter), community scripts (live stats,
                           search, sort, likes, 1-5 star reviews, save, report), people, publish a script
messages.html              end-to-end encrypted direct messages, live delivery, read receipts, typing, online status
index.html / apps / scripts / games
                           ONE X-style feed of everything members upload: posts, apps (APK), scripts, games and any
                           other file type (max 50 MB). Each upload gets its date and time automatically, an optional
                           version, image, likes, comments and a download counter. Home shows everything with filter tabs;
                           apps.html, scripts.html and games.html show one type each. The old built-in catalog is removed.
                           Needs the latest schema.sql (tables uploads, upload_likes, upload_comments + Storage bucket "uploads").
user.html?u=<username>     public profile: followers, following, posts, scripts

Admin: run in the SQL editor:  update public.profiles set role = 'admin' where username = 'rowan';
For the @admin account (real Admin rights + blue Verified tick in the database):
  update public.profiles set role = 'admin', verified = true where username = 'admin';
The Admin + blue badge already show for 'admin' without this, because js/config.js lists it in adminUsernames.
Follower count: js/config.js -> followerBoost { admin: 10000 } shows 10K on that profile (display only; the follows table and the
followers list stay real). Remove the line to show real numbers.

Header (v2)
-----------
Same markup on every page (css/header.css, css/dark.css, js/header.js).
  Bar:       logo, search, settings, account, menu. Hides when you scroll down, returns when you scroll up
             or touch the top edge. Press "/" or Ctrl/Cmd+K to search.
  Menu:      every page, grouped (Discover, Community, Help) + account block (login/sign up or profile/log out).
  Settings:  language (js/locale.js mounts into [data-locale-mount]), theme Light/Dark/Auto, reduce animations.
  Saved in localStorage: aevy_theme ("light"/"dark", absent = Auto) and aevy_motion ("reduced"/"full").
To add a page: add one <a> to the Menu panel in each .html file (look for id="hdr-menu").

Creator dashboard (dashboard.html)
----------------------------------
Signed-in members see totals (followers, uploads, downloads, likes, comments), uploads over time (7/30/90 days),
a breakdown by type, top uploads, recent followers and comments, and a searchable list where they can edit or
delete their own uploads. Linked from the menu, the account dropdown and the footer.

Language (js/translate.js)
--------------------------
The picker now translates the WHOLE page (all text, including content drawn by JavaScript) with Google's free
website translation engine, and remembers the choice on every page. English restores the original text.
Names, usernames, file names and code are marked translate="no". Needs internet access to translate.google.com.

Web app / install (PWA) for Android and Windows
-----------------------------------------------
Files: manifest.webmanifest, sw.js (service worker), offline.html, js/pwa.js, css/pwa.css, assets/icons/*.
- Needs HTTPS (or localhost). Host the folder on any HTTPS host (Netlify, Vercel, Cloudflare Pages, GitHub Pages).
- Android (Chrome / Edge / Samsung Internet): an "Install Aevy" banner appears, and the menu has "Install app".
- Windows (Edge / Chrome): same banner and menu row, or the install icon in the address bar. Installs as its own window
  with a Start-menu / taskbar icon.
- iPhone / iPad (Safari): Share -> Add to Home Screen (a hint banner explains it).
- Offline: pages you opened before still open; anything new shows offline.html. Login, posts and uploads need internet.
- After you change files, bump VERSION in sw.js (for example 'aevy-v2') so installed apps update; users see "A new version is ready".
- Real store packages: give the hosted https URL to https://www.pwabuilder.com to get an Android app bundle (Google Play)
  and a Windows MSIX package (Microsoft Store).
