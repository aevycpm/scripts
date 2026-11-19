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

Header (v2)
-----------
Same markup on every page (css/header.css, css/dark.css, js/header.js).
  Bar:       logo, search, settings, account, menu. Hides when you scroll down, returns when you scroll up
             or touch the top edge. Press "/" or Ctrl/Cmd+K to search.
  Menu:      every page, grouped (Discover, Community, Help) + account block (login/sign up or profile/log out).
  Settings:  language (js/locale.js mounts into [data-locale-mount]), theme Light/Dark/Auto, reduce animations.
  Saved in localStorage: aevy_theme ("light"/"dark", absent = Auto) and aevy_motion ("reduced"/"full").
To add a page: add one <a> to the Menu panel in each .html file (look for id="hdr-menu").
