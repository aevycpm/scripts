/* Aevy ecosystem views: auth, profile, publisher pages, categories. */
(function(){
'use strict';
var C=window.AevyCore,A=window.AevyAuth,esc=C.esc;
function $(s){return document.querySelector(s)}
function mk(id,html){var s=document.createElement('section');s.className='view';s.id='view-'+id;s.dataset.view=id;s.innerHTML=html;$('main').appendChild(s);return s}
function head(e,t,p){return '<div class="page-head"><div class="wrap"><p class="eyebrow">'+e+'</p><h1>'+t+'</h1>'+(p?'<p>'+p+'</p>':'')+'</div></div>'}
function avatar(u,sz){return '<span class="avatar" style="--c:'+u.color+';width:'+sz+'px;height:'+sz+'px;font-size:'+sz*.42+'px">'+esc((u.name||u.username).charAt(0).toUpperCase())+'</span>'}
function err(box,e){box.textContent=e.message||String(e)}
function changed(){window.dispatchEvent(new Event('aevy:auth'))}

var G='<svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.6z"/><path fill="#FBBC05" d="M10.5 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg>';
var EYE='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
function pw(id,label,ac,extra){return '<div><label class="l" for="'+id+'">'+label+'</label><div class="pwrap"><input class="field" id="'+id+'" type="password" autocomplete="'+ac+'" required '+(extra||'')+'><button type="button" class="eye" data-eye="'+id+'" aria-label="Show password">'+EYE+'</button></div></div>'}
mk('auth','<div class="auth-shell"><aside class="auth-side"><span></span>'+
 '<div><p class="eyebrow">CPM script ecosystem</p><h1 id="aTitle">Welcome back.</h1><p class="auth-lead" id="aLead">Sign in to publish scripts, manage your files and keep your private work private.</p></div>'+
 '<ul class="auth-points"><li><b>Own your uploads</b><span>Only you can edit or delete what you publish.</span></li><li><b>Public or private</b><span>Choose who can see each script.</span></li><li><b>Free to join</b><span>No card, no spam. Your email stays private.</span></li></ul></aside>'+
 '<div class="auth-main"><div class="auth-card">'+
 '<div id="stChoose" hidden><h2>Pick your username</h2><p class="sub2" id="stSub">One last step. Your username is your public handle.</p>'+
 '<form class="form" id="fDone"><div><label class="l" for="dN">Display name</label><input class="field" id="dN" maxlength="40" autocomplete="name"></div>'+
 '<div><label class="l" for="dU">Username</label><input class="field" id="dU" maxlength="20" autocomplete="off" autocapitalize="off" spellcheck="false" required placeholder="letters, numbers, _"><p class="hint" id="dH"></p></div>'+
 '<p class="ferr" role="alert"></p><button class="btn btn-primary btn-lg">Continue</button><button type="button" class="linkbtn" id="dOut">Use a different account</button></form></div>'+
 '<div id="stMain"><div class="seg" role="tablist"><button type="button" role="tab" class="on" data-t="in">Sign in</button><button type="button" role="tab" data-t="up">Create account</button></div>'+
 '<button type="button" class="btn btn-lg gbtn" id="gBtn">'+G+'<span>Continue with Google</span></button><p class="gerr ferr" role="alert"></p><div class="or"><span>or use email</span></div>'+
 '<form class="form" id="fIn"><div><label class="l" for="siE">Email</label><input class="field" id="siE" type="email" autocomplete="email" required></div>'+pw('siP','Password','current-password')+
 '<div class="rowsb"><span class="ferr" role="alert" id="inErr"></span><button type="button" class="linkbtn" id="fgt">Forgot password?</button></div><button class="btn btn-primary btn-lg">Sign in</button></form>'+
 '<form class="form" id="fUp" hidden><div><label class="l" for="suU">Username</label><input class="field" id="suU" maxlength="20" autocomplete="username" autocapitalize="off" spellcheck="false" required placeholder="letters, numbers, _"><p class="hint" id="suH"></p></div>'+
 '<div><label class="l" for="suN">Display name <small>(optional)</small></label><input class="field" id="suN" maxlength="40" autocomplete="name"></div>'+
 '<div><label class="l" for="suE">Email</label><input class="field" id="suE" type="email" autocomplete="email" required></div>'+pw('suP','Password','new-password','minlength="8"')+
 '<div class="pm"><div class="pmeter" aria-hidden="true"><i></i><i></i><i></i><i></i></div><p class="hint" id="suM">Use 8 or more characters.</p></div>'+
 '<p class="ferr" role="alert" id="upErr"></p><button class="btn btn-primary btn-lg">Create account</button></form>'+
 '<p class="note">By continuing you agree to keep uploads lawful. Your email is never shown publicly.</p></div></div></div></div>');
var au=$('#view-auth'),ST={mode:'in'};
function busy(f,on){var bt=f.querySelector('button:not([type=button])');if(bt){bt.disabled=on;bt.classList.toggle('loading',on)}}
function setMode(m){
  ST.mode=m;
  au.querySelectorAll('[data-t]').forEach(function(x){var on=x.dataset.t===m;x.classList.toggle('on',on);x.setAttribute('aria-selected',on)});
  $('#fIn').hidden=m!=='in';$('#fUp').hidden=m!=='up';
  $('#aTitle').textContent=m==='in'?'Welcome back.':'Create your account.';
  $('#aLead').textContent=m==='in'?'Sign in to publish scripts, manage your files and keep your private work private.':'Join Aevy to publish, version and share your CPM scripts in under a minute.';
  $('#gBtn span').textContent=m==='in'?'Continue with Google':'Sign up with Google';
  ['.gerr','#inErr','#upErr'].forEach(function(q){au.querySelector(q).textContent=''});
}
function renderAuth(){
  var pend=A.pending();
  $('#stChoose').hidden=!pend;$('#stMain').hidden=pend;
  if(pend){
    var sg=A.suggest();
    $('#dN').value=$('#dN').value||sg.name;$('#dU').value=$('#dU').value||sg.username;
    $('#stSub').textContent='Signed in as '+A.email()+'. Your username is your public handle.';
    $('#aTitle').textContent='Almost there.';$('#aLead').textContent='Choose a username to finish setting up your profile.';
    if($('#dU').value)hint($('#dU'),$('#dH'));
  }else setMode(ST.mode);
}
au.querySelectorAll('[data-t]').forEach(function(b){b.onclick=function(){setMode(b.dataset.t)}});
au.addEventListener('click',function(e){var b=e.target.closest('[data-eye]');if(!b)return;var i=$('#'+b.dataset.eye),sh=i.type==='password';i.type=sh?'text':'password';b.setAttribute('aria-label',sh?'Hide password':'Show password');b.classList.toggle('on',sh)});
/* live username availability */
var tmr;
function hint(inp,box){
  clearTimeout(tmr);var v=inp.value.trim().toLowerCase();box.className='hint';
  if(!v){box.textContent='';return}
  if(!/^[a-z0-9_]{3,20}$/.test(v)){box.textContent='3 to 20 characters: letters, numbers or underscore';return}
  box.textContent='Checking...';
  tmr=setTimeout(function(){A.checkUsername(v).then(function(f){
    if(inp.value.trim().toLowerCase()!==v)return;
    if(f===true){box.textContent='@'+v+' is available';box.className='hint ok'}
    else if(f===false){box.textContent='@'+v+' is already taken';box.className='hint bad'}
    else box.textContent='';
  })},350);
}
$('#suU').oninput=function(){hint(this,$('#suH'))};
$('#dU').oninput=function(){hint(this,$('#dH'))};
$('#suP').oninput=function(){
  var v=this.value,n=0;if(v.length>=8)n++;if(/[a-z]/.test(v)&&/[A-Z]/.test(v))n++;if(/\d/.test(v))n++;if(/[^A-Za-z0-9]/.test(v)||v.length>=14)n++;
  if(v.length<8)n=Math.min(n,1);
  au.querySelectorAll('.pmeter i').forEach(function(i,k){i.className=k<n?'s'+n:''});
  $('#suM').textContent=!v?'Use 8 or more characters.':v.length<8?'Too short':['','Weak','Okay','Good','Strong'][n];
};
function done(){ST.mode='in';changed();location.hash='#/profile'}
function after(m){if(m)done();else{changed();renderAuth()}}
$('#gBtn').onclick=function(){var b=this,e=au.querySelector('.gerr');e.textContent='';b.disabled=true;A.google().then(function(m){b.disabled=false;after(m)},function(x){b.disabled=false;err(e,x)})};
$('#fgt').onclick=function(){var e=$('#inErr');e.className='ferr';A.resetPassword($('#siE').value).then(function(){e.className='ferr okmsg';e.textContent='If that email has an account, a reset link is on its way.'},function(x){e.textContent=x.message})};
$('#fIn').onsubmit=function(e){e.preventDefault();var f=this,b=$('#inErr');b.className='ferr';b.textContent='';busy(f,true);A.signIn($('#siE').value,$('#siP').value).then(function(m){busy(f,false);f.reset();after(m)},function(x){busy(f,false);err(b,x)})};
$('#fUp').onsubmit=function(e){e.preventDefault();var f=this,b=$('#upErr');b.textContent='';busy(f,true);A.signUp({name:$('#suN').value,email:$('#suE').value,username:$('#suU').value,password:$('#suP').value}).then(function(){busy(f,false);f.reset();$('#suH').textContent='';done()},function(x){busy(f,false);err(b,x)})};
$('#fDone').onsubmit=function(e){e.preventDefault();var f=this,b=f.querySelector('.ferr');b.textContent='';busy(f,true);A.completeProfile({name:$('#dN').value,username:$('#dU').value}).then(function(){busy(f,false);done()},function(x){busy(f,false);err(b,x)})};
$('#dOut').onclick=function(){A.signOut().then(function(){changed();renderAuth()})};

mk('profile','<div id="profBody"></div>');
mk('u','<div id="pubBody"></div>');
mk('publishers','<div id="pubsBody"></div>');

function stats(list){var b=0;list.forEach(function(s){b+=s.size||0});return list.length+' script'+(list.length===1?'':'s')+' · '+(b/1024).toFixed(1)+' KB'}
function renderProfile(){
  var m=A.current();if(!m)return;var mine=C.mine(),lg=C.localCount();
  $('#profBody').innerHTML=head('Your profile',esc(m.name),'@'+esc(m.username)+' · member since '+C.fmtDate(m.created))+
  '<div class="wrap prof-grid"><form class="form" id="pf"><h2>Edit profile</h2><p class="note">Signed in as '+esc(A.email())+'</p><div><label class="l" for="pName">Display name</label><input class="field" id="pName" maxlength="40" value="'+esc(m.name)+'"></div><div><label class="l" for="pBio">Bio</label><textarea class="field" id="pBio" maxlength="280" rows="3">'+esc(m.bio)+'</textarea></div><button class="btn btn-primary">Save profile</button></form>'+
  '<form class="form" id="pw"><h2>Password</h2><input class="field" id="pOld" type="password" placeholder="Current password" autocomplete="current-password" required><input class="field" id="pNew" type="password" placeholder="New password (8+)" autocomplete="new-password" required><p class="ferr" role="alert"></p><button class="btn">Change password</button></form></div>'+
  '<div class="wrap"><div class="sec-head"><div><p class="eyebrow">Upload management</p><h2>Your scripts ('+mine.length+')</h2></div><div class="row-btns"><a class="btn btn-primary" href="#/publish">Publish script</a><a class="btn" href="#/u/'+esc(m.username)+'">View public page</a></div></div>'+
  (lg?'<div class="notice">'+lg+' script'+(lg===1?'':'s')+' found in this browser from the old local version. <button class="btn" id="claim">Upload '+(lg===1?'it':'them')+' to your account</button></div>':'')+
  '<div class="cards" id="myCards">'+(mine.length?mine.map(C.cardHTML).join(''):'<div class="empty"><h3>Nothing published yet</h3><p>Your scripts appear here, and only you can edit or delete them.</p></div>')+'</div>'+
  '<div class="danger-zone"><h3>Delete account</h3><p>Permanently removes your account, profile, every script you published and all their files.</p><form id="del"><input class="field" id="dPw" type="password" placeholder="Confirm password" required><button class="btn btn-danger">Delete account</button></form><p class="ferr" id="dErr" role="alert"></p></div></div>';
  $('#pf').onsubmit=function(e){e.preventDefault();A.update({name:$('#pName').value,bio:$('#pBio').value}).then(function(){C.toast('Profile saved');changed()},function(x){C.toast(x.message)})};
  $('#pw').onsubmit=function(e){e.preventDefault();var b=this.querySelector('.ferr'),f=this;A.changePassword($('#pOld').value,$('#pNew').value).then(function(){f.reset();b.textContent='';C.toast('Password changed')},function(x){err(b,x)})};
  if($('#claim'))$('#claim').onclick=function(){var bt=this;bt.disabled=true;bt.textContent='Uploading...';C.importLocal().then(function(n){C.toast(n+' script(s) uploaded');changed()},function(x){bt.disabled=false;C.toast(x.message)})};
  $('#del').onsubmit=function(e){e.preventDefault();if(!confirm('Delete your account and all your scripts? This cannot be undone.'))return;A.remove($('#dPw').value,C.purgeFiles).then(function(){C.dropOwner(m.id);changed();location.hash='#/'},function(x){err($('#dErr'),x)})};
}
function renderPublisher(raw){
  var name=decodeURIComponent((raw.split('/')[1]||'')),u=A.byName(name),box=$('#pubBody');
  if(!u){box.innerHTML=head('Publisher','Not found','No publisher uses that name.');return}
  var list=C.vis().filter(function(s){return s.owner===u.id}),own=A.current()&&A.current().id===u.id;
  box.innerHTML='<div class="page-head"><div class="wrap pub-head">'+avatar(u,72)+'<div><p class="eyebrow">Publisher</p><h1>'+esc(u.name)+'</h1><p>@'+esc(u.username)+' · joined '+C.fmtDate(u.created)+' · '+stats(list)+'</p>'+(u.bio?'<p class="bio">'+esc(u.bio)+'</p>':'')+'</div></div></div><div class="wrap"><div class="cards" style="padding-top:28px">'+(list.length?list.map(C.cardHTML).join(''):'<div class="empty"><h3>No public scripts</h3></div>')+'</div></div>';
}
function renderPublishers(){
  var us=A.all(),pubs=us.map(function(u){return {u:u,n:C.vis().filter(function(s){return s.owner===u.id}).length}}).sort(function(a,b){return b.n-a.n});
  $('#pubsBody').innerHTML=head('Community','Publishers','Everyone who publishes on Aevy.')+'<div class="wrap"><div class="cards" style="padding-top:28px">'+(pubs.length?pubs.map(function(p){return '<a class="card pcard" href="#/u/'+esc(p.u.username)+'" style="opacity:1;animation:none">'+avatar(p.u,48)+'<h3>'+esc(p.u.name)+'</h3><p class="d">@'+esc(p.u.username)+' · '+p.n+' public script'+(p.n===1?'':'s')+'</p></a>'}).join(''):'<div class="empty"><h3>No publishers yet</h3><p><a href="#/auth"><u>Create the first account</u></a></p></div>')+'</div></div>';
}
function userSlot(){
  var m=A.current(),s=$('#userSlot');
  s.innerHTML=m?'<a class="userchip" href="#/profile" aria-label="Your profile">'+avatar(m,28)+'<span class="hide-sm">'+esc(m.username)+'</span></a><button class="btn btn-sm" id="so">Sign out</button>':'<a class="btn btn-sm" href="#/auth">Sign in</a>';
  var so=$('#so');if(so)so.onclick=function(){A.signOut().then(function(){changed();location.hash='#/'})};
  var pb=document.querySelector('.bar-actions .btn-primary');if(pb)pb.hidden=false;
}
function catChips(){
  if($('#catChips'))return;var chips=$('#chips');if(!chips)return;
  var d=document.createElement('div');d.className='chips';d.id='catChips';chips.parentNode.insertBefore(d,chips);
  d.onclick=function(e){var b=e.target.closest('[data-c]');if(!b)return;window.catFilter=b.dataset.c;draw();C.refresh()};draw();
  function draw(){var f=window.catFilter||'all';d.innerHTML=['all'].concat(C.cats).map(function(c){return '<button class="chip'+(c===f?' on':'')+'" data-c="'+esc(c)+'">'+(c==='all'?'All categories':esc(c))+'</button>'}).join('')}
}
function publishForm(){
  var a=$('#fAuthor');if(!a)return;var row=a.parentNode;
  row.innerHTML='<label class="l" for="fCat">Category</label><select class="field sel" id="fCat" style="width:100%">'+C.cats.map(function(c){return '<option>'+esc(c)+'</option>'}).join('')+'</select>';
  var v=document.createElement('div');v.innerHTML='<label class="l" for="fVis">Visibility</label><select class="field sel" id="fVis" style="width:100%"><option value="public">Public (anyone can view and download)</option><option value="private">Private (only you)</option></select>';
  row.parentNode.insertBefore(v,row.nextSibling);
}
window.AevyEco={render:function(h,raw){
  userSlot();
  if(h==='auth')renderAuth();
  if(h==='profile')renderProfile();
  if(h==='u')renderPublisher(raw);
  if(h==='publishers')renderPublishers();
  if(h==='scripts')catChips();
}};
/* Password reset: the email link signs the visitor in and Supabase fires a recovery event; ask for the new password. */
var recShown=false;
function showRecovery(){
  if(recShown||!A.recovery())return;recShown=true;
  var d=$('#dlg');
  $('#dlgTitle').textContent='Choose a new password';$('#dlgSub').textContent='Enter a new password for your account.';
  $('#dlgBody').innerHTML='<form class="form" id="rf"><div><label class="l" for="rpN">New password</label><input class="field" id="rpN" type="password" autocomplete="new-password" minlength="8" required></div><p class="ferr" role="alert"></p><button class="btn btn-primary">Save password</button></form>';
  $('#rf').onsubmit=function(e){e.preventDefault();var f=this,b=f.querySelector('.ferr');b.textContent='';busy(f,true);
    A.setNewPassword($('#rpN').value).then(function(){busy(f,false);d.close();C.toast('Password updated')},function(x){busy(f,false);err(b,x)})};
  if(!d.open){d.showModal();document.body.classList.add('lock')}
}
window.addEventListener('aevy:recovery',function(){recShown=false;showRecovery()});
A.ready.then(showRecovery);
publishForm();userSlot();
document.addEventListener('click',function(e){var c=e.target.closest('.pcard');if(c)e.stopPropagation()},true);
})();
