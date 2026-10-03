const path = require('path');
const fs = require('fs');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const Database = require('better-sqlite3');
const morgan = require('morgan');

const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';
const ROOT = __dirname;
const DATA = path.join(ROOT, 'data');
const UPLOADS = path.join(ROOT, 'uploads');
fs.mkdirSync(DATA, {recursive:true});
fs.mkdirSync(UPLOADS, {recursive:true});

const db = new Database(path.join(DATA, 'antibiotic_awareness.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec(`
CREATE TABLE IF NOT EXISTS users (
 id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
 password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'student' CHECK(role IN ('student','faculty','admin')),
 course TEXT DEFAULT '', semester TEXT DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS content (id INTEGER PRIMARY KEY CHECK(id=1), title TEXT NOT NULL, subtitle TEXT NOT NULL, announcement TEXT DEFAULT '', updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS media (id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT NOT NULL CHECK(type IN ('video','article','pdf','image')), title TEXT NOT NULL, category TEXT NOT NULL, description TEXT DEFAULT '', url TEXT NOT NULL, thumbnail TEXT DEFAULT '', created_by INTEGER, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL);
CREATE TABLE IF NOT EXISTS quizzes (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, description TEXT DEFAULT '', active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS questions (id INTEGER PRIMARY KEY AUTOINCREMENT, quiz_id INTEGER NOT NULL, question TEXT NOT NULL, options_json TEXT NOT NULL, answer_index INTEGER NOT NULL, explanation TEXT DEFAULT '', FOREIGN KEY(quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS attempts (id INTEGER PRIMARY KEY AUTOINCREMENT, quiz_id INTEGER NOT NULL, user_id INTEGER NOT NULL, score INTEGER NOT NULL, total INTEGER NOT NULL, started_at TEXT NOT NULL, completed_at TEXT NOT NULL, FOREIGN KEY(quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE, FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, event TEXT NOT NULL, metadata_json TEXT DEFAULT '{}', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL);
`);

const adminEmail='admin@university.edu', studentEmail='student@university.edu';
function ensureUser(name,email,password,role){
 const exists=db.prepare('SELECT id FROM users WHERE email=?').get(email);
 if(!exists) db.prepare('INSERT INTO users(name,email,password_hash,role) VALUES(?,?,?,?)').run(name,email,bcrypt.hashSync(password,12),role);
}
ensureUser('Faculty Administrator',adminEmail,'admin123','admin');
ensureUser('Demo Student',studentEmail,'student123','student');
if(!db.prepare('SELECT id FROM content WHERE id=1').get()) db.prepare('INSERT INTO content(id,title,subtitle,announcement) VALUES(1,?,?,?)').run('Antibiotic Awareness','Protect antibiotics. Protect our future.','Welcome to the university learning portal. Complete lessons, watch media and track your progress.');
if(!db.prepare('SELECT id FROM quizzes LIMIT 1').get()){
 const q=db.prepare('INSERT INTO quizzes(title,description) VALUES(?,?)').run('Antibiotic Awareness Quiz','Six questions to check your understanding.');
 const add=db.prepare('INSERT INTO questions(quiz_id,question,options_json,answer_index,explanation) VALUES(?,?,?,?,?)');
 const items=[
 ['What do antibiotics treat?',['Some bacterial infections','All viral infections','All headaches','Every fever'],0,'Antibiotics are medicines used against bacterial infections; they do not treat viruses.'],
 ['Where does antibiotic resistance occur?',['In bacteria','Only in people','Only in water','In vitamins'],0,'Resistance is a property of microorganisms such as bacteria.'],
 ['Which action helps prevent resistance?',['Using antibiotics only when prescribed','Sharing leftovers','Stopping without advice','Taking them for every cold'],0,'Responsible use helps preserve antibiotic effectiveness.'],
 ['Which can spread infection?',['Poor hand hygiene','Reading a book','Drinking water','Sleeping'],0,'Hand hygiene is an important infection-prevention measure.'],
 ['Who should decide whether an antibiotic is needed?',['A qualified healthcare professional','A friend','A social-media post','A random website'],0,'A qualified healthcare professional assesses the illness and treatment.'],
 ['What is a good learning habit?',['Check trusted sources','Forward every message','Self-prescribe','Ignore instructions'],0,'Use trusted health information and professional advice.']
 ];
 items.forEach(x=>add.run(q.lastInsertRowid,x[0],JSON.stringify(x[1]),x[2],x[3]));
}

const app=express();
app.use(helmet({contentSecurityPolicy:false}));
app.use(cors({origin:false}));
app.use(cookieParser());
app.use(express.json({limit:'1mb'}));
app.use(morgan('combined'));
app.use('/uploads',express.static(UPLOADS,{maxAge:'7d'}));
app.use(express.static(path.join(ROOT,'public')));

const upload=multer({storage:multer.diskStorage({destination:UPLOADS,filename:(req,file,cb)=>{const ext=path.extname(file.originalname).toLowerCase(); cb(null,`${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`)}}),limits:{fileSize:50*1024*1024},fileFilter:(req,file,cb)=>{const ok=/^(video|image|application\/pdf)/.test(file.mimetype); cb(ok?null:new Error('Only video, image or PDF files are allowed.'),ok)}});

function tokenFor(user){return jwt.sign({id:user.id,role:user.role},JWT_SECRET,{expiresIn:'8h'});}
function auth(req,res,next){try{const token=req.cookies.aa_token; if(!token) return res.status(401).json({error:'Authentication required'}); req.auth=jwt.verify(token,JWT_SECRET); next();}catch{return res.status(401).json({error:'Session expired or invalid'});}}
function roles(...roles){return (req,res,next)=>roles.includes(req.auth.role)?next():res.status(403).json({error:'Permission denied'});}
function safeUser(u){return {id:u.id,name:u.name,email:u.email,role:u.role,course:u.course,semester:u.semester};}
function event(userId,event,metadata={}){db.prepare('INSERT INTO events(user_id,event,metadata_json) VALUES(?,?,?)').run(userId||null,event,JSON.stringify(metadata));}

app.get('/api/health',(req,res)=>res.json({ok:true,service:'Antibiotic Awareness Learning Portal',version:'2.0.0'}));
app.post('/api/auth/register',(req,res)=>{const {name,email,password,course='',semester=''}=req.body||{}; if(!name||!email||!password||password.length<8)return res.status(400).json({error:'Name, email and password (8+ characters) are required.'}); try{const hash=bcrypt.hashSync(password,12);const r=db.prepare('INSERT INTO users(name,email,password_hash,role,course,semester) VALUES(?,?,?,?,?,?)').run(name.trim(),email.trim().toLowerCase(),hash,'student',course,semester);const u=db.prepare('SELECT * FROM users WHERE id=?').get(r.lastInsertRowid);res.cookie('aa_token',tokenFor(u),{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',maxAge:8*60*60*1000});event(u.id,'register');res.status(201).json({user:safeUser(u)});}catch(e){res.status(409).json({error:'Email already registered.'});}});
app.post('/api/auth/login',(req,res)=>{const {email,password}=req.body||{};const u=db.prepare('SELECT * FROM users WHERE email=?').get(String(email||'').toLowerCase().trim());if(!u||!bcrypt.compareSync(password||'',u.password_hash))return res.status(401).json({error:'Invalid email or password'});res.cookie('aa_token',tokenFor(u),{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',maxAge:8*60*60*1000});event(u.id,'login');res.json({user:safeUser(u)});});
app.post('/api/auth/logout',(req,res)=>{res.clearCookie('aa_token');res.json({ok:true});});
app.get('/api/auth/me',auth,(req,res)=>{const u=db.prepare('SELECT * FROM users WHERE id=?').get(req.auth.id);res.json({user:safeUser(u)});});

app.get('/api/content', (req,res)=>res.json(db.prepare('SELECT * FROM content WHERE id=1').get()));
app.put('/api/content',auth,roles('faculty','admin'),(req,res)=>{const {title,subtitle,announcement}=req.body||{};if(!title||!subtitle)return res.status(400).json({error:'Title and subtitle are required'});db.prepare('UPDATE content SET title=?,subtitle=?,announcement=?,updated_at=CURRENT_TIMESTAMP WHERE id=1').run(title,subtitle,announcement||'');event(req.auth.id,'cms_updated');res.json(db.prepare('SELECT * FROM content WHERE id=1').get());});

app.get('/api/media',(req,res)=>res.json(db.prepare('SELECT m.*,u.name AS creator_name FROM media m LEFT JOIN users u ON u.id=m.created_by ORDER BY m.created_at DESC').all()));
app.post('/api/media',auth,roles('faculty','admin'),upload.single('file'),(req,res)=>{const {type,title,category,description,url}=req.body||{};const finalUrl=req.file?`/uploads/${req.file.filename}`:url;if(!type||!title||!category||!finalUrl)return res.status(400).json({error:'Type, title, category and URL/file are required'});const r=db.prepare('INSERT INTO media(type,title,category,description,url,created_by) VALUES(?,?,?,?,?,?)').run(type,title,category,description||'',finalUrl,req.auth.id);event(req.auth.id,'media_added',{mediaId:r.lastInsertRowid,type});res.status(201).json(db.prepare('SELECT * FROM media WHERE id=?').get(r.lastInsertRowid));});
app.delete('/api/media/:id',auth,roles('faculty','admin'),(req,res)=>{const m=db.prepare('SELECT * FROM media WHERE id=?').get(req.params.id);if(!m)return res.status(404).json({error:'Media not found'});if(m.url.startsWith('/uploads/')){try{fs.unlinkSync(path.join(ROOT,m.url.replace(/^\//,'')))}catch{}}db.prepare('DELETE FROM media WHERE id=?').run(req.params.id);event(req.auth.id,'media_deleted',{mediaId:m.id});res.json({ok:true});});

app.get('/api/quizzes',(req,res)=>res.json(db.prepare('SELECT id,title,description,active FROM quizzes WHERE active=1 ORDER BY id').all()));
app.get('/api/quizzes/:id',(req,res)=>{const q=db.prepare('SELECT id,title,description FROM quizzes WHERE id=? AND active=1').get(req.params.id);if(!q)return res.status(404).json({error:'Quiz not found'});q.questions=db.prepare('SELECT id,question,options_json,explanation FROM questions WHERE quiz_id=? ORDER BY id').all(q.id).map(x=>({id:x.id,question:x.question,options:JSON.parse(x.options_json),explanation:x.explanation}));res.json(q);});
app.post('/api/quizzes/:id/attempt',auth,(req,res)=>{const quiz=db.prepare('SELECT id FROM quizzes WHERE id=? AND active=1').get(req.params.id);if(!quiz)return res.status(404).json({error:'Quiz not found'});const answers=req.body?.answers;if(!Array.isArray(answers))return res.status(400).json({error:'Answers must be an array'});const qs=db.prepare('SELECT id,answer_index FROM questions WHERE quiz_id=? ORDER BY id').all(quiz.id);let score=0;const details=qs.map((q,i)=>{const selected=Number(answers[i]);const correct=selected===q.answer_index;if(correct)score++;return {questionId:q.id,selected,correct};});const now=new Date().toISOString();const r=db.prepare('INSERT INTO attempts(quiz_id,user_id,score,total,started_at,completed_at) VALUES(?,?,?,?,?,?)').run(quiz.id,req.auth.id,score,qs.length,req.body.startedAt||now,now);event(req.auth.id,'quiz_completed',{quizId:quiz.id,attemptId:r.lastInsertRowid,score,total:qs.length});res.json({score,total:qs.length,percentage:Math.round(score/qs.length*100),details});});

app.get('/api/dashboard',auth,(req,res)=>{const u=db.prepare('SELECT * FROM users WHERE id=?').get(req.auth.id);const attempts=db.prepare('SELECT a.id,a.score,a.total,a.completed_at,q.title FROM attempts a JOIN quizzes q ON q.id=a.quiz_id WHERE a.user_id=? ORDER BY a.completed_at DESC').all(req.auth.id);const avg=attempts.length?Math.round(attempts.reduce((s,a)=>s+a.score/a.total*100,0)/attempts.length):0;const activities=db.prepare('SELECT COUNT(*) c FROM events WHERE user_id=?').get(req.auth.id).c;res.json({user:safeUser(u),stats:{averageScore:avg,quizzesCompleted:attempts.length,activities,lastQuiz:attempts[0]?.completed_at||null},attempts});});
app.post('/api/events',auth,(req,res)=>{if(!req.body?.event)return res.status(400).json({error:'Event required'});event(req.auth.id,String(req.body.event).slice(0,80),req.body.metadata||{});res.status(204).end();});
app.get('/api/admin/analytics',auth,roles('faculty','admin'),(req,res)=>{const users=db.prepare("SELECT COUNT(*) c FROM users WHERE role='student'").get().c;const media=db.prepare('SELECT COUNT(*) c FROM media').get().c;const attempts=db.prepare('SELECT COUNT(*) c FROM attempts').get().c;const events=db.prepare('SELECT COUNT(*) c FROM events').get().c;const avg=db.prepare('SELECT ROUND(AVG(score*100.0/total),1) avg FROM attempts').get().avg||0;const recent=db.prepare('SELECT e.created_at,e.event,u.name,u.email FROM events e LEFT JOIN users u ON u.id=e.user_id ORDER BY e.id DESC LIMIT 25').all();res.json({summary:{students:users,media,attempts,events,averageScore:avg},recent});});
app.get('/api/admin/users',auth,roles('admin'),(req,res)=>res.json(db.prepare('SELECT id,name,email,role,course,semester,created_at FROM users ORDER BY created_at DESC').all()));
app.use((err,req,res,next)=>{console.error(err);res.status(400).json({error:err.message||'Request failed'});});
app.use((req,res,next)=>{ if(req.method==='GET' && !req.path.startsWith('/api/') && !req.path.startsWith('/uploads/')) return res.sendFile(path.join(ROOT,'public','index.html')); next(); });
app.listen(PORT,()=>console.log(`Antibiotic Awareness Portal running at http://localhost:${PORT}`));
