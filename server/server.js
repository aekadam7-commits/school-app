'use strict';
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const app = express();
const PORT = Number(process.env.PORT || 8787);
const ROOT = __dirname;
const DATA_DIR = path.resolve(process.env.GHIYABAT_DATA || path.join(ROOT, 'data'));
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const STATE_FILE = path.join(DATA_DIR, 'state.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');
fs.mkdirSync(DATA_DIR, {recursive:true});
app.disable('x-powered-by'); app.use(cors()); app.use(express.json({limit:'30mb'}));
const PUBLIC_DIR = path.resolve(process.env.GHIYABAT_PUBLIC || (fs.existsSync(path.join(ROOT, 'www', 'index.html')) ? path.join(ROOT, 'www') : path.join(ROOT, 'public')));
app.use(express.static(PUBLIC_DIR));
function read(file, fallback){try{return JSON.parse(fs.readFileSync(file,'utf8'))}catch{return fallback}}
function writeSafe(file, value){const tmp=file+'.tmp';fs.writeFileSync(tmp,JSON.stringify(value,null,2));fs.renameSync(tmp,file)}
let users=read(USERS_FILE,[]), state=read(STATE_FILE,null), sessions=read(SESSIONS_FILE,{});
const hash=(p,s)=>crypto.scryptSync(String(p),s,64).toString('hex');
const safeUser=u=>({username:u.username,role:u.role||'admin',first:u.first||'',last:u.last||'',birth:u.birth||''});
function auth(req,res,next){const token=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'');const sess=sessions[token];if(!sess||sess.expires<Date.now()){if(sess){delete sessions[token];writeSafe(SESSIONS_FILE,sessions)}return res.status(401).json({ok:false,error:'انتهت الجلسة، سجّل الدخول مجددًا'});}const u=users.find(x=>x.username===sess.username);if(!u)return res.status(401).json({ok:false,error:'الحساب غير موجود'});req.user=u;next()}
app.get('/api/ping',(req,res)=>res.json({ok:true,app:'تسيير غيابات التلاميذ',port:PORT,setupRequired:users.length===0,serverTime:new Date().toISOString()}));
app.get('/api/auth/status',(req,res)=>res.json({ok:true,setupRequired:users.length===0}));
app.post('/api/auth/setup',(req,res)=>{if(users.length)return res.status(409).json({ok:false,error:'تم إنشاء حساب المسؤول من قبل'});const username=String(req.body.username||'').trim();const password=String(req.body.password||'');if(!/^[\w.-]{3,40}$/.test(username)||password.length<8)return res.status(400).json({ok:false,error:'اسم المستخدم 3 أحرف على الأقل وكلمة المرور 8 أحرف على الأقل'});const salt=crypto.randomBytes(16).toString('hex');users=[{username,salt,hash:hash(password,salt),role:'admin',createdAt:new Date().toISOString()}];writeSafe(USERS_FILE,users);return makeSession(username,res)});
function makeSession(username,res){const token=crypto.randomBytes(32).toString('hex');sessions[token]={username,expires:Date.now()+1000*60*60*24*30};writeSafe(SESSIONS_FILE,sessions);res.json({ok:true,token,user:safeUser(users.find(u=>u.username===username))})}
const fails=new Map();
app.post('/api/auth/login',(req,res)=>{const key=req.ip,now=Date.now(),f=fails.get(key)||{n:0,t:now};if(now-f.t>15*60*1000){f.n=0;f.t=now}if(f.n>=10)return res.status(429).json({ok:false,error:'محاولات كثيرة، أعد المحاولة بعد 15 دقيقة'});const username=String(req.body.username||'').trim(),password=String(req.body.password||'');const u=users.find(x=>x.username.toLowerCase()===username.toLowerCase());if(!u||hash(password,u.salt)!==u.hash){f.n++;fails.set(key,f);return res.status(401).json({ok:false,error:'اسم المستخدم أو كلمة المرور غير صحيحة'})}fails.delete(key);makeSession(u.username,res)});
app.post('/api/auth/logout',auth,(req,res)=>{const token=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'');delete sessions[token];writeSafe(SESSIONS_FILE,sessions);res.json({ok:true})});
app.get('/api/auth/me',auth,(req,res)=>res.json({ok:true,user:safeUser(req.user)}));

// ---- حسابات المشرفين التربويين: يديرها المسؤول (admin) فقط
// اسم المستخدم = الحرف الأول من اللقب + نقطة + الاسم (aissa allel -> a.allel)، كلمة المرور = اسم المستخدم + سنة الميلاد (a.allel1987)
const adminOnly=(req,res,next)=>(req.user.role||'admin')==='admin'?next():res.status(403).json({ok:false,error:'هذه العملية خاصة بالمسؤول (admin) فقط'});
const latin=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
function credsOf(first,last,birth){const f=latin(first),l=latin(last),m=/^(\d{4})-\d{2}-\d{2}$/.exec(String(birth||'').trim());if(!f||!l)return{error:'اكتب الاسم واللقب بالحروف اللاتينية (الفرنسية)'};if(!m||+m[1]<1900||+m[1]>new Date().getFullYear())return{error:'تاريخ الميلاد غير صالح'};const un=l[0]+'.'+f;return{username:un,password:un+m[1]}}
function killSessions(name){let ch=false;for(const t of Object.keys(sessions))if(sessions[t].username===name){delete sessions[t];ch=true}if(ch)writeSafe(SESSIONS_FILE,sessions)}
function supRow(u){const c=credsOf(u.first,u.last,u.birth);return{username:u.username,first:u.first,last:u.last,birth:u.birth,custom:!!u.customPw,password:u.customPw?'':(c.password||'')}}
const findSup=name=>users.find(u=>u.username===name&&u.role==='supervisor');
// ترحيل الحسابات المنشأة بالصيغة القديمة إلى الصيغة الجديدة (مرة واحدة)
(function migrate(){let ch=false;for(const u of users){if(u.role!=='supervisor'||u.v===2)continue;u.v=2;ch=true;[u.first,u.last]=[u.last,u.first];if(u.customPw)continue;const c=credsOf(u.first,u.last,u.birth);if(c.error)continue;if(users.some(x=>x!==u&&x.username.toLowerCase()===c.username))continue;killSessions(u.username);u.username=c.username;u.salt=crypto.randomBytes(16).toString('hex');u.hash=hash(c.password,u.salt)}if(ch)writeSafe(USERS_FILE,users)})();
app.get('/api/users',auth,adminOnly,(req,res)=>res.json({ok:true,users:users.filter(u=>u.role==='supervisor').map(supRow)}));
function saveSup(req,res,old){
  const first=String(req.body.first||'').trim().slice(0,40),last=String(req.body.last||'').trim().slice(0,40),birth=String(req.body.birth||'').trim();
  const c=credsOf(first,last,birth);if(c.error)return res.status(400).json({ok:false,error:c.error});
  if(users.some(u=>u!==old&&u.username.toLowerCase()===c.username))return res.status(409).json({ok:false,error:'اسم المستخدم '+c.username+' موجود مسبقًا'});
  const salt=crypto.randomBytes(16).toString('hex');
  const rec={username:c.username,salt,hash:hash(c.password,salt),role:'supervisor',v:2,first,last,birth,createdAt:old?old.createdAt:new Date().toISOString()};
  if(old){killSessions(old.username);users[users.indexOf(old)]=rec}else users.push(rec);
  writeSafe(USERS_FILE,users);res.json({ok:true,user:supRow(rec)})}
app.post('/api/users',auth,adminOnly,(req,res)=>saveSup(req,res,null));
app.put('/api/users/:username',auth,adminOnly,(req,res)=>{const old=findSup(req.params.username);if(!old)return res.status(404).json({ok:false,error:'المشرف غير موجود'});saveSup(req,res,old)});
app.delete('/api/users/:username',auth,adminOnly,(req,res)=>{const old=findSup(req.params.username);if(!old)return res.status(404).json({ok:false,error:'المشرف غير موجود'});killSessions(old.username);users=users.filter(u=>u!==old);writeSafe(USERS_FILE,users);res.json({ok:true})});

// ---- المستخدم يعدّل حسابه ويغيّر كلمة مروره (يلزم إدخال كلمة المرور الحالية)
app.put('/api/auth/me',auth,(req,res)=>{
  const u=req.user,b=req.body||{};
  if(hash(String(b.currentPassword||''),u.salt)!==u.hash)return res.status(400).json({ok:false,error:'كلمة المرور الحالية غير صحيحة'});
  const rec={...u};
  if(u.role==='supervisor'&&(b.first!==undefined||b.last!==undefined||b.birth!==undefined)){
    const first=String(b.first||'').trim().slice(0,40),last=String(b.last||'').trim().slice(0,40),birth=String(b.birth||'').trim();
    const c=credsOf(first,last,birth);if(c.error)return res.status(400).json({ok:false,error:c.error});
    Object.assign(rec,{first,last,birth});
  }
  const nu=String(b.username===undefined?u.username:b.username).trim();
  if(nu!==u.username){
    if(!/^[\w.-]{3,40}$/.test(nu))return res.status(400).json({ok:false,error:'اسم المستخدم 3 أحرف على الأقل (حروف لاتينية وأرقام ونقطة فقط)'});
    if(users.some(x=>x!==u&&x.username.toLowerCase()===nu.toLowerCase()))return res.status(409).json({ok:false,error:'اسم المستخدم مستعمل مسبقًا'});
    rec.username=nu;
  }
  const np=String(b.newPassword||'');
  if(np){if(np.length<6)return res.status(400).json({ok:false,error:'كلمة المرور الجديدة 6 أحرف على الأقل'});rec.salt=crypto.randomBytes(16).toString('hex');rec.hash=hash(np,rec.salt);rec.customPw=true}
  users[users.indexOf(u)]=rec;
  if(rec.username!==u.username)for(const t of Object.keys(sessions))if(sessions[t].username===u.username)sessions[t].username=rec.username;
  if(np){const cur=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'');for(const t of Object.keys(sessions))if(sessions[t].username===rec.username&&t!==cur)delete sessions[t]}
  writeSafe(USERS_FILE,users);writeSafe(SESSIONS_FILE,sessions);res.json({ok:true,user:safeUser(rec)})});
app.get('/api/state',auth,(req,res)=>res.json({ok:true,state:state,updatedAt:state&&state.updatedAt||null}));
app.put('/api/state',auth,(req,res)=>{if(!req.body||typeof req.body.state!=='object'||Array.isArray(req.body.state))return res.status(400).json({ok:false,error:'بيانات غير صالحة'});state={data:req.body.state,updatedAt:new Date().toISOString(),updatedBy:req.user.username};writeSafe(STATE_FILE,state);res.json({ok:true,updatedAt:state.updatedAt})});
app.get('/api/storage',auth,(req,res)=>{const f=fs.existsSync(STATE_FILE)?fs.statSync(STATE_FILE).size:0;res.json({ok:true,bytes:f,hasData:!!state,users:users.length,dataDirectory:DATA_DIR})});
function backupDir(){const d=path.join(DATA_DIR,'backups');fs.mkdirSync(d,{recursive:true});return d}
function listBackups(){const dir=backupDir();return fs.readdirSync(dir).filter(x=>x.endsWith('.json')).map(n=>({name:n,time:fs.statSync(path.join(dir,n)).mtimeMs,size:fs.statSync(path.join(dir,n)).size})).sort((a,b)=>a.time-b.time)}
function makeBackup(prefix){const dir=backupDir();const name=prefix+'-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json';const payload={createdAt:new Date().toISOString(),state,users:users.map(u=>({username:u.username,role:u.role}))};fs.writeFileSync(path.join(dir,name),JSON.stringify(payload,null,2));const all=listBackups();while(all.length>30)fs.unlinkSync(path.join(dir,all.shift().name));return name}
app.post('/api/backup',auth,(req,res)=>res.json({ok:true,name:makeBackup('backup')}));
app.get('/api/backups',auth,(req,res)=>res.json({ok:true,backups:listBackups().reverse()}));
app.post('/api/restore',auth,(req,res)=>{const n=String(req.body.name||'');if(!/^[\w.-]+\.json$/.test(n)||!fs.existsSync(path.join(backupDir(),n)))return res.status(400).json({ok:false,error:'نسخة غير موجودة'});let p;try{p=JSON.parse(fs.readFileSync(path.join(backupDir(),n),'utf8'))}catch{return res.status(400).json({ok:false,error:'ملف النسخة تالف'})}if(!p.state||typeof p.state.data!=='object')return res.status(400).json({ok:false,error:'النسخة لا تحتوي بيانات'});if(state)makeBackup('before-restore');state={data:p.state.data,updatedAt:new Date().toISOString(),updatedBy:req.user.username};writeSafe(STATE_FILE,state);res.json({ok:true,updatedAt:state.updatedAt})});
function autoBackup(){try{if(!state)return;const l=listBackups().filter(x=>x.name.startsWith('auto-'));const last=l.length?l[l.length-1].time:0;if(Date.now()-last>=24*3600*1000)makeBackup('auto')}catch(e){console.error('auto backup failed',e)}}
setTimeout(autoBackup,5000);setInterval(autoBackup,3600*1000);
app.get('*',(req,res)=>res.sendFile(path.join(PUBLIC_DIR,'index.html')));
app.listen(PORT,'0.0.0.0',()=>{console.log('\n=== سيرفر تسيير غيابات التلاميذ ===');console.log('محليًا: http://localhost:'+PORT);for(const xs of Object.values(os.networkInterfaces()))for(const n of xs||[])if(n.family==='IPv4'&&!n.internal)console.log('من جهاز آخر على الشبكة: http://'+n.address+':'+PORT);console.log('مجلد البيانات: '+DATA_DIR);console.log('أوقف السيرفر بإغلاق هذه النافذة.\n')});
