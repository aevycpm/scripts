/* Aevy backend settings.
   The publishable key is designed to be public: it ships in the browser.
   What protects the data is Row Level Security (supabase/schema.sql), not this key.
   NEVER put a "secret" or "service_role" key in this file. */
window.ROWAN_CONFIG = {
  url: 'https://jjtgwzyupfqfnbkntkep.supabase.co',
  key: 'sb_publishable_ATZhUhGKT0KIDAQMbO2TKQ_ASu97PPj',
  creatorPosts: 3,   /* public scripts needed for the Creator check; keep equal to rowan_verify_scripts() in schema.sql */
  newDays: 7,        /* how long the "New" badge shows; keep equal to rowan_new_user_days() in schema.sql */
  contactEmail: 'support@rowancpm.com',
  adminNames: ['Rowan'],      /* display names reserved for the owner: only the earliest account with this name shows Admin */
  adminUsernames: ['rowan', 'admin'],   /* these accounts always show the Admin badge (real Admin rights: see README.txt) */
  followerBoost: { admin: 10000 }   /* display-only follower count shown for these usernames (the real follows table is untouched) */
};
