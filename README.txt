Aevy - CPM script ecosystem (Supabase backend)
==============================================

Project: https://jjtgwzyupfqfnbkntkep.supabase.co  (settings are in js/config.js)

Setup (about 5 minutes, one time)
---------------------------------
1. Supabase dashboard -> SQL Editor -> New query -> paste the whole of supabase/schema.sql -> Run.
   This creates the tables, the Row Level Security policies, the profile trigger and the
   delete-account function. It is safe to run again. Without it every request fails.
2. Authentication -> Sign In / Providers -> Email: enabled.
   Recommended: turn OFF "Confirm email" so new accounts can sign in at once.
   (With it ON everything still works: the user must click the emailed link before signing in.)
3. Google button (optional): Authentication -> Sign In / Providers -> Google -> Enable, paste the
   Google OAuth client ID + secret. In Google Cloud Console add this redirect URI to the client:
       https://jjtgwzyupfqfnbkntkep.supabase.co/auth/v1/callback
4. Authentication -> URL Configuration:
     Site URL        = the address where you host the site (e.g. https://yourname.github.io/aevy/)
     Redirect URLs   = add the same address, plus http://localhost:8080/ for local testing.
   Google sign-in and password-reset links return to these addresses.
5. Serve the folder over http(s) - do not open index.html with file://.
   Examples:  npx serve .    or    python3 -m http.server 8080
   Any static host works (Netlify, Vercel, Cloudflare Pages, GitHub Pages ...).

The publishable key in js/config.js is meant to be public. Data is protected by Row Level
Security (supabase/schema.sql), not by hiding the key. Never put a secret / service_role key in the site.

What lives where
----------------
Accounts        Supabase Auth (auth.users: email + password, hashed by Supabase) and Google
Profiles        table public.profiles      (public: username, name, bio, colour; username is unique)
Scripts         table public.scripts       (title, language, category, visibility, preview...)
Script files    table public.script_files  (the file text, max 2 MB per script)
Saved videos    table public.videos        (private to each user)
Browser         only the colour theme stays in localStorage; Supabase keeps the login session.

Ownership and privacy (enforced by Row Level Security, not just the UI)
-----------------------------------------------------------------------
- Public scripts: anyone can read and download. Private: only the owner.
- Only the owner can create, edit, replace the file of, or delete a script.
- Owner and created date cannot be changed; usernames are permanent and unique.
- Saved videos are readable only by their owner.
- Deleting an account removes the profile, scripts, files and videos (database cascade).

Moving old data
---------------
If the browser still holds scripts from the old local version, the Profile page shows an
"Upload to your account" button. Data from the previous Firebase project is NOT migrated
automatically (different database); download your scripts from the old site first if you need them.

Notes
-----
- Sign in uses email + password; the username is the public handle.
- Password reset: "Forgot password?" on the sign-in form emails a reset link; opening it asks for a new password.
- Google sign-in: new Google users are asked to pick a username before their profile is created.
- Libraries load up to 1000 public scripts / profiles. Add pagination if you grow past that.
- supabase-js 2.117.3 is loaded from cdn.jsdelivr.net, so the site needs internet.
