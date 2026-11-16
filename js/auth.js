/* Aevy accounts on Supabase Auth (email + password, plus Google).
   Public profile data lives in the public.profiles table and is cached in memory so views can render synchronously.
   Usernames are unique through a unique index on profiles.username (see supabase/schema.sql). */
(function(){
'use strict';
var cfg=window.AEVY_CONFIG||{};
if(!window.supabase||!cfg.url||!cfg.key){console.error('Supabase library or js/config.js is missing');return}
/* PKCE keeps the auth tokens out of the URL hash, which this app uses for routing (#/scripts, #/auth ...). */
var sb=window.supabase.createClient(cfg.url,cfg.key,{auth:{flowType:'pkce',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
window.AevySB={client:sb};

var COLORS=['#c8f53c','#5ec8ff','#ff9f5a','#c792ff','#ff6b8b','#4de0b0'];
var profiles=[],index={},user=null,me=null,silent=0,recovering=false,booted=false;
var HOME=location.origin+location.pathname;

function ms(t){var n=t?Date.parse(t):NaN;return isNaN(n)?Date.now():n}
function pub(p){return {id:p.id,username:p.username,name:p.name,bio:p.bio||'',color:p.color,created:ms(p.created)}}
function reindex(){index={};profiles.forEach(function(p){index[p.id]=p})}
function hash(s){var h=0;for(var i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))|0;return Math.abs(h)}
function aevy(msg,extra){var e=new Error(msg);e.aevy=1;if(extra)for(var k in extra)e[k]=extra[k];return e}
function nice(e){
  if(e&&e.aevy)return e;
  var c=String((e&&(e.code||e.error_code))||''),m=String((e&&e.message)||e||''),s=e&&e.status;
  if(c==='invalid_credentials'||/invalid login credentials/i.test(m))return new Error('Wrong email or password');
  if(c==='email_not_confirmed'||/email not confirmed/i.test(m))return new Error('Confirm your email first: open the link we sent you, then sign in');
  if(c==='user_already_exists'||c==='email_exists'||/already registered/i.test(m))return new Error('An account with that email already exists');
  if(c==='weak_password'||/password should be at least|weak/i.test(m))return new Error('Password must be at least 8 characters');
  if(c==='same_password'||/different from the old/i.test(m))return new Error('Choose a password different from the current one');
  if(c==='validation_failed'&&/email/i.test(m))return new Error('Enter a valid email address');
  if(/invalid email|unable to validate email/i.test(m))return new Error('Enter a valid email address');
  if(c==='over_request_rate_limit'||c==='over_email_send_rate_limit'||c==='email_rate_limit_exceeded'||s===429||/rate limit|too many/i.test(m))return new Error('Too many attempts. Wait a minute and try again');
  if(c==='signup_disabled')return new Error('Sign ups are disabled for this project');
  if(c==='provider_disabled'||/provider is not enabled|unsupported provider/i.test(m))return new Error('Google sign-in is not enabled yet. Turn it on in Supabase > Authentication > Providers > Google');
  if(c==='user_banned')return new Error('This account has been disabled');
  if(c==='session_not_found'||c==='reauthentication_needed'||/jwt|session/i.test(m)&&s===401)return new Error('Please sign in again, then retry');
  if(/database error saving new user/i.test(m))return new Error('That username is taken. Try another one');
  if(c==='23505'||/duplicate key/i.test(m))return new Error('That username is taken. Try another one');
  if(c==='42501'||/row-level security|permission denied/i.test(m))return new Error('Permission denied by the database. Run the latest supabase/schema.sql in the Supabase SQL editor');
  if(c==='42P01'||c==='PGRST205'||/schema cache|does not exist/i.test(m))return new Error('The database tables are missing. Run supabase/schema.sql in the Supabase SQL editor');
  if(/failed to fetch|networkerror|load failed|fetch failed/i.test(m))return new Error('Cannot reach the server. Check your connection and disable ad blockers/VPN, then retry');
  return new Error(m||'Request failed');
}
function must(r){if(r.error)throw r.error;return r.data}
function loadProfiles(){
  return sb.from('profiles').select('id,username,name,bio,color,created').order('created',{ascending:true}).limit(1000).then(function(r){
    profiles=must(r).map(pub);reindex();
  });
}
function setMe(){me=user?(index[user.id]||null):null}
function ensureProfile(){return index[user.id]?Promise.resolve():loadProfiles()}

var A=window.AevyAuth={
  ready:null,
  current:function(){return me},
  email:function(){return user?user.email:''},
  recovery:function(){return recovering},
  byName:function(n){var k=String(n).toLowerCase();return profiles.filter(function(u){return u.username===k})[0]},
  byId:function(id){return index[id]},
  all:function(){return profiles.slice()},
  refreshProfiles:function(){return loadProfiles().then(setMe)},
  /* true = free, false = taken, null = could not check (never blocks the form) */
  checkUsername:function(un){
    un=String(un||'').trim().toLowerCase();
    if(!/^[a-z0-9_]{3,20}$/.test(un))return Promise.resolve(null);
    return sb.from('profiles').select('id').eq('username',un).limit(1).then(function(r){
      if(r.error)return null;
      return r.data.length?!!(user&&r.data[0].id===user.id):true;
    },function(){return null});
  },
  /* Creates the profile of the signed-in user. The unique index on username makes the claim atomic. */
  claim:function(un,name){
    return sb.from('profiles').insert({id:user.id,username:un,name:name,bio:'',color:COLORS[hash(un)%COLORS.length]}).then(function(r){
      if(r.error){
        if(r.error.code==='23505')throw aevy('That username is taken. Try another one',{taken:1});
        throw r.error;
      }
    });
  },
  signUp:function(o){
    var un=String(o.username||'').trim().toLowerCase(),email=String(o.email||'').trim(),pw=o.password||'';
    if(!/^[a-z0-9_]{3,20}$/.test(un))return Promise.reject(new Error('Username: 3 to 20 letters, numbers or underscores'));
    if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))return Promise.reject(new Error('Enter a valid email address'));
    if(pw.length<8)return Promise.reject(new Error('Password must be at least 8 characters'));
    var name=((o.name||un).trim()||un).slice(0,40);
    silent++;
    return A.checkUsername(un).then(function(free){
      if(free===false)throw aevy('That username is taken. Try another one');
      /* username + name travel as user metadata; a database trigger creates the profile (works with or without email confirmation) */
      return sb.auth.signUp({email:email,password:pw,options:{data:{username:un,name:name},emailRedirectTo:HOME}}).then(must);
    }).then(function(d){
      /* with "Confirm email" on, an already registered address returns a user with no identities instead of an error */
      if(d.user&&d.user.identities&&d.user.identities.length===0)throw aevy('An account with that email already exists. Use the Sign in tab');
      if(!d.session)throw aevy('Account created. Open the confirmation link we emailed you, then sign in');
      user=d.session.user;
      return loadProfiles();
    }).then(function(){
      setMe();
      if(!me)throw aevy('Account created, but the profile could not be saved. Run supabase/schema.sql and sign in again');
      return me;
    }).then(function(v){silent--;return v},function(e){silent--;throw nice(e)});
  },
  /* signed in (e.g. with Google) but no profile yet: pick a username */
  pending:function(){return !!user&&!me},
  suggest:function(){
    if(!user)return {name:'',username:''};
    var md=user.user_metadata||{},full=md.full_name||md.name||'';
    var base=String(full||(user.email||'').split('@')[0]||'').toLowerCase().replace(/[^a-z0-9_]+/g,'_').replace(/^_+|_+$/g,'').slice(0,16);
    return {name:full,username:base.length>=3?base:''};
  },
  completeProfile:function(o){
    if(!user)return Promise.reject(new Error('Sign in first'));
    var un=String(o.username||'').trim().toLowerCase();
    if(!/^[a-z0-9_]{3,20}$/.test(un))return Promise.reject(new Error('Username: 3 to 20 letters, numbers or underscores'));
    var name=((o.name||un).trim()||un).slice(0,40);
    silent++;
    return A.claim(un,name).then(function(){return loadProfiles()}).then(function(){setMe();return me})
      .then(function(v){silent--;return v},function(e){silent--;throw nice(e)});
  },
  /* Redirects to Google and back; the page reloads signed in (a username is asked for on first login). */
  google:function(){
    silent++;
    return sb.auth.signInWithOAuth({provider:'google',options:{redirectTo:HOME,queryParams:{prompt:'select_account'}}}).then(function(r){
      if(r.error)throw r.error;
      return new Promise(function(){});
    }).then(null,function(e){silent--;throw nice(e)});
  },
  resetPassword:function(email){
    email=String(email||'').trim();
    if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))return Promise.reject(new Error('Enter your email address first'));
    return sb.auth.resetPasswordForEmail(email,{redirectTo:HOME}).then(function(r){
      /* do not reveal whether an address has an account */
      if(r.error&&r.error.code!=='user_not_found')throw nice(r.error);
    },function(e){throw nice(e)});
  },
  /* used after the user opens the reset link from the email */
  setNewPassword:function(pw){
    if((pw||'').length<8)return Promise.reject(new Error('Password must be at least 8 characters'));
    return sb.auth.updateUser({password:pw}).then(must).then(function(){recovering=false},function(e){throw nice(e)});
  },
  signIn:function(email,pw){
    silent++;
    return sb.auth.signInWithPassword({email:String(email).trim(),password:pw}).then(must).then(function(d){
      user=d.user;
      return ensureProfile().then(function(){setMe();return me});
    }).then(function(v){silent--;return v},function(e){silent--;throw nice(e)});
  },
  signOut:function(){
    silent++;
    return sb.auth.signOut().then(function(){user=null;me=null;silent--},function(){user=null;me=null;silent--});
  },
  update:function(p){
    if(!me)return Promise.reject(new Error('Sign in first'));
    var f={};
    if(p.name!=null)f.name=String(p.name).trim().slice(0,40)||me.name;
    if(p.bio!=null)f.bio=String(p.bio).slice(0,280);
    if(p.color)f.color=p.color;
    return sb.from('profiles').update(f).eq('id',me.id).select('id,username,name,bio,color,created').single().then(must).then(function(d){
      var n=pub(d);profiles=profiles.map(function(u){return u.id===n.id?n:u});reindex();me=n;return n;
    }).then(null,function(e){throw nice(e)});
  },
  /* re-checks the password by signing in again */
  verify:function(pw,msg){
    return sb.auth.signInWithPassword({email:user.email,password:pw}).then(function(r){
      if(r.error){
        if(r.error.status===429||/fetch/i.test(r.error.message||''))throw r.error;
        throw new Error(msg||'Password is wrong');
      }
    });
  },
  changePassword:function(oldPw,newPw){
    if(!me)return Promise.reject(new Error('Sign in first'));
    if((newPw||'').length<8)return Promise.reject(new Error('New password must be at least 8 characters'));
    silent++;
    return A.verify(oldPw,'Current password is wrong').then(function(){return sb.auth.updateUser({password:newPw}).then(must)})
      .then(function(){silent--},function(e){silent--;throw nice(e)});
  },
  /* cleanup: function returning a promise that deletes the user's scripts/videos first */
  remove:function(pw,cleanup){
    if(!me)return Promise.reject(new Error('Sign in first'));
    silent++;
    return A.verify(pw,'Password is wrong').then(function(){return cleanup?cleanup():null}).then(function(){
      /* security-definer function from schema.sql: deletes the auth user, which cascades to profile, scripts, files and videos */
      return sb.rpc('delete_my_account').then(must);
    }).then(function(){return sb.auth.signOut({scope:'local'}).catch(function(){})}).then(function(){
      user=null;me=null;return loadProfiles().catch(function(){});
    }).then(function(){silent--},function(e){silent--;throw nice(e)});
  }
};

/* Registered immediately so the PASSWORD_RECOVERY event of a reset link is never missed.
   Do not call Supabase inside this callback. */
sb.auth.onAuthStateChange(function(ev,session){
  if(ev==='PASSWORD_RECOVERY'){recovering=true;setTimeout(function(){window.dispatchEvent(new Event('aevy:recovery'))},0)}
  if(silent||!booted)return;
  /* sign-out or session change in another tab */
  var u=session?session.user:null,before=user?user.id:null,after=u?u.id:null;
  if(before===after){if(u)user=u;return}
  user=u;
  setTimeout(function(){
    (u?ensureProfile().catch(function(){}):Promise.resolve()).then(function(){setMe();window.dispatchEvent(new Event('aevy:auth'))});
  },0);
});

/* Wait for Supabase to restore a saved session (or finish the Google / reset-link return), then load profiles. */
A.ready=sb.auth.getSession().then(function(r){
  user=(r.data&&r.data.session&&r.data.session.user)||null;
  return loadProfiles().catch(function(e){console.error(e)});
}).then(function(){
  setMe();
  /* signed in with Google but no profile yet: send the visitor to the username step */
  if(user&&!me&&location.hash!=='#/auth'&&!recovering)history.replaceState(null,'','#/auth');
  booted=true;
});
})();
