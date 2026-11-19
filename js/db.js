/* Rowan data layer on Supabase (Postgres + Row Level Security).
   public.scripts       metadata + preview
   public.script_files  the script file itself (one row per script, max 2 MB)
   Table definitions and security policies: supabase/schema.sql */
(function(){
'use strict';
var fb=window.RowanSB;if(!fb)return;
var sb=fb.client,codeCache={},MAX=2*1024*1024;
/* Any file type is accepted. Text is stored as is; binary or encrypted files (not valid UTF-8, or containing NUL bytes)
   are stored losslessly as BIN + base64 and decoded again on download. */
var BIN='@@AEVYB64@@';   /* marker kept as is so files stay compatible with the Aevy backend */
function isBin(c){return typeof c==='string'&&c.indexOf(BIN)===0}
function toB64(u){var s='',n=0x8000;for(var i=0;i<u.length;i+=n)s+=String.fromCharCode.apply(null,u.subarray(i,i+n));return btoa(s)}
function fromB64(b){var s=atob(b),u=new Uint8Array(s.length);for(var i=0;i<s.length;i++)u[i]=s.charCodeAt(i);return u}
function binSize(c){var b=c.slice(BIN.length),pad=b.endsWith('==')?2:b.endsWith('=')?1:0;return Math.max(0,Math.floor(b.length*3/4)-pad)}
function codeBytes(c){return isBin(c)?fromB64(c.slice(BIN.length)):new TextEncoder().encode(c)}
function readFileCode(f){
  return f.arrayBuffer().then(function(buf){
    var u=new Uint8Array(buf);
    try{var t=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(u);if(t.indexOf('\u0000')<0)return t}catch(e){}
    return BIN+toB64(u);
  });
}
window.RowanBin={isBin:isBin,size:binSize,bytes:codeBytes,read:readFileCode,cleanExt:function(e){e=String(e||'').toLowerCase().replace(/^\./,'');return /^[a-z0-9]{1,10}$/.test(e)?e:''}};
function bytes(s){return isBin(s)?binSize(s):new Blob([s]).size}
function lineCount(s){return isBin(s)?1:s?s.split('\n').length:0}
function meta(code){
  if(isBin(code)){var n=binSize(code);return {size:n,lines:1,preview:'[Binary or encrypted file, '+n+' bytes]'}}
  return {size:bytes(code),lines:lineCount(code),preview:code.split('\n').slice(0,7).join('\n').slice(0,1500)};
}
function ms(t){var n=t?Date.parse(t):NaN;return isNaN(n)?Date.now():n}
function toScript(r){
  return {id:r.id,owner:r.owner,title:r.title,lang:r.lang,author:r.author,desc:r.description,tags:r.tags||[],cat:r.cat,vis:r.vis,
    path:r.id,ext:r.ext||'',size:r.size,lines:r.lines,preview:r.preview,created:ms(r.created),updated:ms(r.updated),
    downloads:r.downloads||0,views:r.views||0,likes:r.likes||0,rsum:r.rating_sum||0,rcount:r.rating_count||0};
}
function userId(){var m=window.RowanAuth.current();if(!m)throw new Error('Sign in first');return m.id}
function row(f){
  var r={title:f.title,lang:f.lang,author:f.author||'',description:f.desc||'',tags:f.tags||[],cat:f.cat||'Other',vis:f.vis||'public'};
  var e=window.RowanBin.cleanExt(f.ext);if(e)r.ext=e;   /* original file extension, kept so downloads keep their real type */
  return r;
}
function err(e){
  if(e&&(e.code==='42501'||/row-level security/i.test(e.message||'')))return new Error('Not allowed. You can only change your own scripts');
  if(e&&(e.code==='42P01'||e.code==='PGRST205'))return new Error('The database tables are missing. Run supabase/schema.sql in the Supabase SQL editor');
  if(e&&/failed to fetch|networkerror|load failed/i.test(e.message||''))return new Error('Cannot reach the server. Check your connection and retry');
  return e instanceof Error?e:new Error((e&&e.message)||'Request failed');
}
/* the database sets the Verified badge after a publish / delete: reload profiles so it shows at once */
function refreshBadge(){try{window.RowanAuth.refreshProfiles().then(function(){window.dispatchEvent(new Event('rowan:badges'))},function(){})}catch(e){}}
function must(r){if(r.error)throw r.error;return r.data}
var COLS='*';

window.RowanDB={
  toScript:toScript,
  /* All scripts the current viewer may see: every public one plus the viewer's own private ones. */
  listScripts:function(){
    var q=[sb.from('scripts').select(COLS).eq('vis','public').order('created',{ascending:false}).limit(1000).then(must)],m=window.RowanAuth.current();
    if(m)q.push(sb.from('scripts').select(COLS).eq('owner',m.id).order('created',{ascending:false}).limit(1000).then(must));
    return Promise.all(q).then(function(lists){
      var seen={},out=[];
      lists.forEach(function(l){l.forEach(function(r){if(!seen[r.id]){seen[r.id]=1;out.push(toScript(r))}})});
      return out.sort(function(a,b){return b.created-a.created});
    });
  },
  getCode:function(s){
    var c=codeCache[s.id];if(c&&c.u===s.updated)return Promise.resolve(c.code);
    return sb.from('script_files').select('code').eq('script_id',s.id).maybeSingle().then(function(r){
      if(r.error)throw r.error;
      if(!r.data)throw new Error('The file has no content');
      codeCache[s.id]={u:s.updated,code:r.data.code};return r.data.code;
    }).then(null,function(e){throw new Error('Could not load the file: '+((e&&e.message)||'download failed'))});
  },
  /* f: {title,lang,author,desc,tags,cat,vis}; resolves to the new script */
  createScript:function(f,code){
    var uid,id;
    try{uid=userId()}catch(e){return Promise.reject(e)}
    if(bytes(code)>MAX)return Promise.reject(new Error('Files are limited to 2 MB'));
    var r=row(f),m=meta(code);
    r.owner=uid;r.size=m.size;r.lines=m.lines;r.preview=m.preview;
    return sb.from('scripts').insert(r).select(COLS).single().then(must).then(function(d){
      id=d.id;
      return sb.from('script_files').insert({script_id:id,code:code}).then(function(x){
        if(x.error){
          /* do not leave a script without a file behind */
          return sb.from('scripts').delete().eq('id',id).then(function(){throw x.error});
        }
        var s=toScript(d);codeCache[s.id]={u:s.updated,code:code};refreshBadge();return s;
      });
    }).then(null,function(e){throw err(e)});
  },
  /* code is optional; pass it only when the file content changed */
  updateScript:function(s,f,code){
    try{userId()}catch(e){return Promise.reject(e)}
    var r=row(f);
    if(code!==undefined){
      if(bytes(code)>MAX)return Promise.reject(new Error('Files are limited to 2 MB'));
      var m=meta(code);r.size=m.size;r.lines=m.lines;r.preview=m.preview;
    }
    return sb.from('scripts').update(r).eq('id',s.id).select(COLS).then(must).then(function(rows){
      if(!rows.length)throw new Error('Not allowed. You can only change your own scripts');
      var d=rows[0];
      if(code===undefined)return toScript(d);
      return sb.from('script_files').upsert({script_id:s.id,code:code},{onConflict:'script_id'}).then(must).then(function(){
        var n=toScript(d);codeCache[n.id]={u:n.updated,code:code};return n;
      });
    }).then(null,function(e){throw err(e)});
  },
  /* the file row is removed together with the script (on delete cascade) */
  deleteScript:function(s){
    return sb.from('scripts').delete().eq('id',s.id).select('id').then(must).then(function(rows){
      if(!rows.length)throw new Error('Not allowed. You can only change your own scripts');
      delete codeCache[s.id];refreshBadge();
    }).then(null,function(e){throw err(e)});
  },
  /* removes every script (with its file) of the signed-in user; used before account deletion */
  purgeMyFiles:function(){
    var uid;try{uid=userId()}catch(e){return Promise.reject(e)}
    return sb.from('scripts').delete().eq('owner',uid).then(must).then(function(){codeCache={}}).then(null,function(e){throw err(e)});
  }
};

/* ---------- community stats: likes, reviews, views, downloads (counters are changed only by SQL functions) ---------- */
(function(){
var DB=window.RowanDB,A=window.RowanAuth,vid='';
function uuid(){if(window.crypto&&crypto.randomUUID)return crypto.randomUUID();var b=new Uint8Array(16);crypto.getRandomValues(b);b[6]=b[6]&15|64;b[8]=b[8]&63|128;var h=Array.prototype.map.call(b,function(x){return ('0'+x.toString(16)).slice(-2)}).join('');return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20)}
try{vid=localStorage.getItem('rowan.vid')||'';if(!/^[0-9a-f-]{36}$/.test(vid)){vid=uuid();localStorage.setItem('rowan.vid',vid)}}catch(e){vid=vid||uuid()}
function rpc(n,a){return sb.rpc(n,a).then(function(r){return r.error?null:r.data},function(){return null})}
var viewed={},likedSet={};
DB.today=function(){return rpc('get_today')};
DB.trackVisit=function(){return rpc('track_visit',{v:vid})};
DB.trackView=function(s){if(!s||viewed[s.id])return;viewed[s.id]=1;return rpc('track_view',{sid:s.id,v:vid})};
DB.trackDownload=function(list){var ids=(list||[]).map(function(s){return s.id}).filter(Boolean);if(ids.length)return rpc('track_download',{ids:ids})};
DB.loadLikes=function(){likedSet={};var m=A.current();if(!m)return Promise.resolve(likedSet);return sb.from('script_likes').select('script_id').eq('owner',m.id).limit(2000).then(function(r){(r.data||[]).forEach(function(x){likedSet[x.script_id]=true});return likedSet},function(){return likedSet})};
DB.liked=function(id){return !!likedSet[id]};
DB.toggleLike=function(s){var m=A.current();if(!m)return Promise.reject(new Error('Log in first'));var on=!likedSet[s.id];
  var q=on?sb.from('script_likes').insert({script_id:s.id,owner:m.id}):sb.from('script_likes').delete().eq('script_id',s.id).eq('owner',m.id);
  return q.then(function(r){if(r.error)throw r.error;if(on)likedSet[s.id]=true;else delete likedSet[s.id];return on})};
function crow(r){return {id:r.id,script_id:r.script_id,owner:r.owner,body:r.body,rating:r.rating||0,t:ms(r.created)}}
DB.listReviews=function(s){return sb.from('script_comments').select('*').eq('script_id',s.id).order('created',{ascending:false}).limit(100).then(must).then(function(rows){return rows.map(crow)})};
DB.addReview=function(s,body,rating){var m=A.current();if(!m)return Promise.reject(new Error('Log in first'));
  var p={script_id:s.id,owner:m.id,body:String(body||'').trim()};if(!p.body)return Promise.reject(new Error('Write something first'));if(rating)p.rating=rating;
  return sb.from('script_comments').insert(p).select('*').single().then(function(r){if(r.error){throw new Error(r.error.code==='23505'?'You already reviewed this script':(r.error.message||'Could not post'))}return crow(r.data)})};
DB.deleteReview=function(id){return sb.from('script_comments').delete().eq('id',id).select('id').then(must)};
/* saved scripts */
var saved={};
DB.loadSaved=function(){saved={};var m=A.current();if(!m)return Promise.resolve(saved);return sb.from('script_saves').select('script_id').eq('owner',m.id).order('created',{ascending:false}).then(function(r){(r.data||[]).forEach(function(x){saved[x.script_id]=1});return saved},function(){return saved})};
DB.isSaved=function(id){return !!saved[id]};
DB.toggleSave=function(id){var m=A.current();if(!m)return Promise.reject(new Error('Log in first'));var was=!!saved[id];
  var q=was?sb.from('script_saves').delete().eq('owner',m.id).eq('script_id',id):sb.from('script_saves').insert({script_id:id,owner:m.id});
  return q.then(function(r){if(r.error)throw r.error;if(was)delete saved[id];else saved[id]=1;return !was})};
/* reports (moderation) */
DB.report=function(kind,target,reason,details){return sb.from('reports').insert({kind:kind,target:target,reason:reason,details:details||''}).then(function(r){if(r.error)throw r.error})};
/* live counters */
DB.watch=function(cb){var ch=sb.channel('rowan-live').on('postgres_changes',{event:'*',schema:'public',table:'scripts'},function(p){cb('scripts',p)})
  .on('postgres_changes',{event:'*',schema:'public',table:'script_comments'},function(p){cb('reviews',p)})
  .on('postgres_changes',{event:'*',schema:'public',table:'daily_stats'},function(p){cb('today',p)}).subscribe();return function(){try{sb.removeChannel(ch)}catch(e){}}};
})();
})();
