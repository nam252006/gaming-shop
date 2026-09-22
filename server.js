const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, "data.json");
const SHOP_NAME = process.env.SHOP_NAME || "Gaming Shop";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@example.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "change-this-password";

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

function loadDB() {
  try { return JSON.parse(fs.readFileSync(DB_FILE, "utf8")); }
  catch { return { users: [], products: [], orders: [], topups: [] }; }
}
function saveDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf8");
}
function hashPassword(password) {
  return crypto.createHash("sha256").update(String(password)).digest("hex");
}
function tokenFor(user) {
  return Buffer.from(JSON.stringify({ id:user.id, role:user.role, exp:Date.now()+1000*60*60*24*7 })).toString("base64url") + "." + crypto.createHash("sha256").update((process.env.SESSION_SECRET||"dev-secret") + user.id).digest("hex");
}
function userFromToken(token) {
  if (!token) return null;
  try {
    const [payload] = token.split(".");
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (data.exp < Date.now()) return null;
    const db = loadDB();
    return db.users.find(u => u.id === data.id && u.role === data.role) || null;
  } catch { return null; }
}
function auth(req,res,next) {
  const u = userFromToken((req.headers.authorization||"").replace(/^Bearer\s+/i,""));
  if (!u) return res.status(401).json({error:"Bạn cần đăng nhập."});
  req.user = u; next();
}
function admin(req,res,next) {
  if (req.user?.role !== "admin") return res.status(403).json({error:"Không có quyền admin."});
  next();
}
function publicUser(u) {
  return { id:u.id, email:u.email, name:u.name, role:u.role, balance:u.balance, createdAt:u.createdAt };
}

let db = loadDB();
if (!db.users.some(u => u.email === ADMIN_EMAIL)) {
  db.users.push({id:crypto.randomUUID(), email:ADMIN_EMAIL, name:"Admin", password:hashPassword(ADMIN_PASSWORD), role:"admin", balance:0, createdAt:new Date().toISOString()});
  saveDB(db);
}

app.get("/api/config", (req,res)=>res.json({shopName:SHOP_NAME}));
app.get("/api/products", (req,res)=>res.json(loadDB().products));
app.get("/api/me", auth, (req,res)=>res.json(publicUser(req.user)));

app.post("/api/register", (req,res)=>{
  const {email,password,name} = req.body;
  if (!email || !password || password.length < 6) return res.status(400).json({error:"Email và mật khẩu (tối thiểu 6 ký tự) là bắt buộc."});
  const db = loadDB();
  if (db.users.some(u=>u.email.toLowerCase()===String(email).toLowerCase())) return res.status(409).json({error:"Email đã tồn tại."});
  const u = {id:crypto.randomUUID(), email:String(email).toLowerCase(), name:name||email.split("@")[0], password:hashPassword(password), role:"user", balance:0, createdAt:new Date().toISOString()};
  db.users.push(u); saveDB(db);
  res.json({token:tokenFor(u), user:publicUser(u)});
});

app.post("/api/login", (req,res)=>{
  const {email,password} = req.body;
  const u = loadDB().users.find(x=>x.email.toLowerCase()===String(email||"").toLowerCase() && x.password===hashPassword(password||""));
  if (!u) return res.status(401).json({error:"Email hoặc mật khẩu không đúng."});
  res.json({token:tokenFor(u), user:publicUser(u)});
});

app.get("/api/orders", auth, (req,res)=>{
  const db=loadDB();
  res.json(db.orders.filter(o=>o.userId===req.user.id).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)));
});

app.post("/api/orders", auth, (req,res)=>{
  const items = Array.isArray(req.body.items) ? req.body.items : [];
  if (!items.length) return res.status(400).json({error:"Giỏ hàng trống."});
  const db=loadDB();
  let total=0, normalized=[];
  for (const item of items) {
    const p=db.products.find(x=>x.id===Number(item.id));
    const qty=Math.max(1,Math.min(99,Number(item.qty)||1));
    if (!p) return res.status(400).json({error:"Có sản phẩm không còn tồn tại."});
    total += p.price*qty;
    normalized.push({productId:p.id,name:p.name,price:p.price,qty});
  }
  const u=db.users.find(x=>x.id===req.user.id);
  if (u.balance < total) return res.status(400).json({error:"Số dư không đủ. Hãy nạp tiền trước."});
  u.balance -= total;
  const order={id:"GS-"+Date.now().toString(36).toUpperCase(),userId:u.id,items:normalized,total,status:"paid",createdAt:new Date().toISOString()};
  db.orders.push(order);
  normalized.forEach(i=>{const p=db.products.find(x=>x.id===i.productId); p.sold=(p.sold||0)+i.qty;});
  saveDB(db);
  res.json({order,user:publicUser(u)});
});

app.post("/api/topups", auth, (req,res)=>{
  const amount=Math.max(1000,Number(req.body.amount)||0);
  const method=["bank","crypto","card"].includes(req.body.method)?req.body.method:"bank";
  if (!amount) return res.status(400).json({error:"Số tiền không hợp lệ."});
  const db=loadDB();
  const topup={id:"TP-"+Date.now().toString(36).toUpperCase(),userId:req.user.id,amount,method,status:"pending",createdAt:new Date().toISOString()};
  db.topups.push(topup); saveDB(db);
  res.json(topup);
});

app.get("/api/admin/stats", auth, admin, (req,res)=>{
  const db=loadDB();
  const revenue=db.orders.filter(o=>o.status!=="cancelled").reduce((s,o)=>s+o.total,0);
  res.json({users:db.users.filter(u=>u.role!=="admin").length,products:db.products.length,orders:db.orders.length,revenue,pendingTopups:db.topups.filter(t=>t.status==="pending").length});
});
app.get("/api/admin/orders", auth, admin, (req,res)=>res.json(loadDB().orders.sort((a,b)=>b.createdAt.localeCompare(a.createdAt))));
app.get("/api/admin/topups", auth, admin, (req,res)=>res.json(loadDB().topups.sort((a,b)=>b.createdAt.localeCompare(a.createdAt))));
app.post("/api/admin/topups/:id/approve", auth, admin, (req,res)=>{
  const db=loadDB(); const t=db.topups.find(x=>x.id===req.params.id);
  if(!t) return res.status(404).json({error:"Không tìm thấy yêu cầu."});
  if(t.status!=="pending") return res.status(400).json({error:"Yêu cầu đã xử lý."});
  const u=db.users.find(x=>x.id===t.userId);
  if(!u) return res.status(404).json({error:"Không tìm thấy người dùng."});
  u.balance += t.amount; t.status="approved"; t.approvedAt=new Date().toISOString(); saveDB(db);
  res.json(t);
});
app.patch("/api/admin/orders/:id", auth, admin, (req,res)=>{
  const db=loadDB(); const o=db.orders.find(x=>x.id===req.params.id);
  if(!o) return res.status(404).json({error:"Không tìm thấy đơn."});
  if(["paid","processing","completed","cancelled"].includes(req.body.status)) o.status=req.body.status;
  saveDB(db); res.json(o);
});
app.post("/api/admin/products", auth, admin, (req,res)=>{
  const {name,category,price,oldPrice,description,imageClass,badge,delivery,image}=req.body;
  if(!name || !category || Number(price)<=0) return res.status(400).json({error:"Thiếu tên, danh mục hoặc giá."});
  const db=loadDB(); const p={id:Date.now(),name,category,price:Number(price),oldPrice:Number(oldPrice)||0,rating:0,reviews:0,sold:0,badge:badge||"",delivery:delivery||"Giao ngay",description:description||"",imageClass:imageClass||"blue",image:image||""};
  db.products.unshift(p); saveDB(db); res.json(p);
});
app.put("/api/admin/products/:id", auth, admin, (req,res)=>{
  const db=loadDB(); const p=db.products.find(x=>x.id===Number(req.params.id));
  if(!p) return res.status(404).json({error:"Không tìm thấy sản phẩm."});
  Object.assign(p,{...req.body,price:Number(req.body.price||p.price),oldPrice:Number(req.body.oldPrice||0),image:req.body.image===undefined?p.image:req.body.image});
  saveDB(db); res.json(p);
});
app.delete("/api/admin/products/:id", auth, admin, (req,res)=>{
  const db=loadDB(); db.products=db.products.filter(x=>x.id!==Number(req.params.id)); saveDB(db); res.json({ok:true});
});

app.use((req, res) => {   res.sendFile(path.join(__dirname, "index.html")); });
app.listen(PORT, "0.0.0.0", ()=>console.log(`${SHOP_NAME} running at http://localhost:${PORT}`));
