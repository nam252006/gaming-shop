let products=[];
let cart=JSON.parse(localStorage.getItem("gaming_cart")||"[]");
let token=localStorage.getItem("gaming_token")||"";
let currentUser=null;
let currentCat="all";

const $=s=>document.querySelector(s);
const money=n=>new Intl.NumberFormat("vi-VN").format(Number(n)||0)+"đ";
const fmt=n=>Number(n)>=1000?(Number(n)/1000).toFixed(Number(n)>=10000?0:1)+"k":String(n||0);
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
function toast(msg){const el=$("#toast");el.textContent=msg;el.className="toast show";setTimeout(()=>el.className="toast",2600)}
async function api(url,opts={}){opts.headers={...(opts.headers||{}),"Content-Type":"application/json",...(token?{Authorization:"Bearer "+token}:{})};const r=await fetch(url,opts);const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||"Có lỗi xảy ra");return d}

async function boot(){
  try{
    const cfg=await fetch("/api/config").then(r=>r.json());
    document.title=cfg.shopName;
    ["#shopName","#footerShopName","#copyrightName"].forEach(sel=>{if($(sel))$(sel).textContent=cfg.shopName});
    products=await fetch("/api/products").then(r=>r.json());
    if(token){try{currentUser=await api("/api/me")}catch{logout(false)}}
    updateAccount();updateCartCount();renderProducts();
  }catch(e){toast("Không tải được dữ liệu: "+e.message)}
}
function updateAccount(){if(currentUser){$("#accountName").textContent=currentUser.name;$("#accountBalance").textContent=money(currentUser.balance)}else{$("#accountName").textContent="Khách";$("#accountBalance").textContent="Đăng nhập"}}
function updateCartCount(){$("#cartCount").textContent=cart.reduce((s,i)=>s+i.qty,0)}
function productImage(p,cls="thumb"){
  return p.image?`<div class="${cls}"><img src="${p.image}" alt="${esc(p.name)}" loading="lazy">${p.badge?`<span class="badge">${esc(p.badge)}</span>`:""}</div>`:`<div class="${cls}"><div class="thumb-placeholder">Chưa có ảnh</div>${p.badge?`<span class="badge">${esc(p.badge)}</span>`:""}</div>`
}
function renderProducts(){
  const q=( $("#search")?.value || "").trim().toLowerCase();
  let list=products.filter(p=>(currentCat==="all"||p.category===currentCat)&&(!q||`${p.name} ${p.category} ${p.description}`.toLowerCase().includes(q)));
  const sort=$("#sortSelect")?.value||"default";
  if(sort==="price-asc")list.sort((a,b)=>a.price-b.price);
  if(sort==="price-desc")list.sort((a,b)=>b.price-a.price);
  if(sort==="sold")list.sort((a,b)=>(b.sold||0)-(a.sold||0));
  $("#resultMeta").textContent=`${list.length} sản phẩm • Danh mục: ${currentCat==="all"?"Tất cả":currentCat}`;
  $("#productGrid").innerHTML=list.length?list.map(card).join(""):`<div class="empty"><h3>Không tìm thấy sản phẩm</h3><p>Hãy thử từ khóa hoặc danh mục khác.</p></div>`;
  $("#searchClear").classList.toggle("hidden",!$("#search").value);
}
function card(p){
  return `<article class="card">
    ${productImage(p,"thumb")}
    <div class="card-body">
      <div class="card-category">${esc(p.category)}</div>
      <h3>${esc(p.name)}</h3>
      <div class="price-row"><span class="price">${money(p.price)}</span>${p.oldPrice?`<span class="old">${money(p.oldPrice)}</span>`:""}</div>
      <div class="card-meta"><span>Đã bán ${fmt(p.sold)}</span><span class="delivery">${esc(p.delivery||"Giao ngay")}</span></div>
      <div class="card-footer"><button class="card-buy" onclick="openProduct(${p.id})">Xem chi tiết</button><button class="card-cart" title="Thêm vào giỏ" onclick="event.stopPropagation();addCart(${p.id})">＋</button></div>
    </div>
  </article>`
}
function openProduct(id){
  const p=products.find(x=>x.id===id);if(!p)return;
  const image=p.image?`<img src="${p.image}" alt="${esc(p.name)}">`:`<div class="thumb-placeholder">Chưa có ảnh sản phẩm</div>`;
  openModal(`<div class="modal-head"><div><span class="pill">${esc(p.category)}</span><h2 style="margin-top:8px">${esc(p.name)}</h2></div><button class="close-btn" onclick="closeModal()">×</button></div><div class="detail-grid"><div class="detail-image">${image}</div><div class="detail-copy"><p>${esc(p.description||"Sản phẩm đang được cập nhật thông tin.")}</p><div class="detail-price">${money(p.price)}</div><p><b>Giao hàng:</b> ${esc(p.delivery||"Giao ngay")}</p><p><b>Đã bán:</b> ${fmt(p.sold)}</p><div class="row"><button class="action-btn primary" onclick="addCart(${p.id});closeModal()">Thêm vào giỏ</button><button class="action-btn secondary" onclick="buyNow(${p.id})">Mua ngay</button></div></div></div>`)
}
function addCart(id){const x=cart.find(i=>i.id===id);x?x.qty++:cart.push({id,qty:1});saveCart();updateCartCount();toast("Đã thêm vào giỏ hàng")}
function removeCart(id){cart=cart.filter(i=>i.id!==id);saveCart();openCart()}
function changeQty(id,delta){const x=cart.find(i=>i.id===id);if(!x)return;x.qty+=delta;if(x.qty<=0)cart=cart.filter(i=>i.id!==id);saveCart();updateCartCount();openCart()}
function buyNow(id){addCart(id);closeModal();openCart()}
function saveCart(){localStorage.setItem("gaming_cart",JSON.stringify(cart))}
function openCart(){
  const rows=cart.map(i=>{const p=products.find(x=>x.id===i.id);if(!p)return"";return `<div class="cart-row"><div class="cart-row-info"><b>${esc(p.name)}</b><small>${money(p.price)} / món</small></div><div class="cart-qty"><button class="qty-btn" onclick="changeQty(${p.id},-1)">−</button><span>${i.qty}</span><button class="qty-btn" onclick="changeQty(${p.id},1)">＋</button><button class="qty-btn" onclick="removeCart(${p.id})">×</button></div></div>`}).join("");
  const total=cart.reduce((s,i)=>{const p=products.find(x=>x.id===i.id);return s+(p?p.price*i.qty:0)},0);
  openModal(`<div class="modal-head"><h2>Giỏ hàng</h2><button class="close-btn" onclick="closeModal()">×</button></div>${rows||"<p style='color:#94a3b8'>Giỏ hàng đang trống.</p>"}<div class="checkout-bar"><div class="checkout-total"><small>TỔNG CỘNG</small><strong>${money(total)}</strong></div><button class="action-btn primary" ${!cart.length?"disabled":""} onclick="checkout()">Thanh toán</button></div>`)
}
async function checkout(){if(!currentUser){closeModal();openAuth("login");return}if(!cart.length)return;try{const d=await api("/api/orders",{method:"POST",body:JSON.stringify({items:cart})});currentUser=d.user;cart=[];saveCart();updateAccount();updateCartCount();closeModal();toast("Đặt hàng thành công: "+d.order.id)}catch(e){toast(e.message)}}
function openAuth(mode="login"){openModal(`<div class="modal-head"><h2>${mode==="login"?"Đăng nhập":"Tạo tài khoản"}</h2><button class="close-btn" onclick="closeModal()">×</button></div><form class="form" onsubmit="authSubmit(event,'${mode}')">${mode==="register"?`<input name="name" placeholder="Tên hiển thị" required>`:""}<input name="email" type="email" placeholder="Email" required><input name="password" type="password" placeholder="Mật khẩu" required minlength="6"><button class="action-btn primary">${mode==="login"?"Đăng nhập":"Đăng ký"}</button></form><button class="action-btn secondary" style="margin-top:10px" onclick="openAuth('${mode==="login"?"register":"login"}')">${mode==="login"?"Chưa có tài khoản? Đăng ký":"Đã có tài khoản? Đăng nhập"}</button>`)}
async function authSubmit(e,mode){e.preventDefault();const f=new FormData(e.target);try{const d=await api("/api/"+mode,{method:"POST",body:JSON.stringify(Object.fromEntries(f))});token=d.token;localStorage.setItem("gaming_token",token);currentUser=d.user;updateAccount();closeModal();toast("Xin chào "+currentUser.name)}catch(err){toast(err.message)}}
function showAccount(){
  if(!currentUser)return openAuth("login");
  openModal(`<div class="modal-head"><div><span class="pill">Tài khoản</span><h2 style="margin-top:8px">${esc(currentUser.name)}</h2></div><button class="close-btn" onclick="closeModal()">×</button></div><p style="color:#64748b">${esc(currentUser.email)}</p><div class="stat-box" style="margin-top:14px"><small>SỐ DƯ VÍ</small><strong style="font-size:22px">${money(currentUser.balance)}</strong></div><div class="row" style="margin-top:14px"><button class="action-btn primary" onclick="openTopup()">Nạp tiền</button><button class="action-btn secondary" onclick="showPage('orders')">Đơn hàng</button>${currentUser.role==="admin"?`<button class="action-btn secondary" onclick="openAdmin()">Admin</button>`:""}</div><button class="action-btn secondary" style="margin-top:12px;width:100%" onclick="logout()">Đăng xuất</button>`)
}
function logout(show=true){token="";currentUser=null;localStorage.removeItem("gaming_token");updateAccount();if(show){closeModal();toast("Đã đăng xuất")}}
function openTopup(){if(!currentUser){openAuth("login");return}openModal(`<div class="modal-head"><h2>Nạp tiền</h2><button class="close-btn" onclick="closeModal()">×</button></div><p style="color:#64748b">Tạo yêu cầu nạp tiền để admin xác nhận và cộng số dư.</p><form class="form" onsubmit="topupSubmit(event)"><input name="amount" type="number" min="1000" step="1000" placeholder="Số tiền (VND)" required><select name="method"><option value="bank">Ngân hàng</option><option value="crypto">Crypto</option><option value="card">Thẻ</option></select><button class="action-btn primary">Tạo yêu cầu nạp</button></form>`)}
async function topupSubmit(e){e.preventDefault();const f=new FormData(e.target);try{const d=await api("/api/topups",{method:"POST",body:JSON.stringify(Object.fromEntries(f))});closeModal();toast("Đã tạo yêu cầu "+d.id)}catch(err){toast(err.message)}}
async function showPage(page){if(page!=="orders"){openModal(`<div class="modal-head"><h2>${page==="blogs"?"Tin tức":"Yêu thích"}</h2><button class="close-btn" onclick="closeModal()">×</button></div><p style="color:#64748b">Khu vực này có thể mở rộng thêm nội dung ở phiên bản sau.</p>`);return}if(!currentUser){openAuth("login");return}try{const orders=await api("/api/orders");openModal(`<div class="modal-head"><h2>Đơn hàng của tôi</h2><button class="close-btn" onclick="closeModal()">×</button></div>${orders.length?orders.map(o=>`<div class="cart-row"><div class="cart-row-info"><b>${esc(o.id)}</b><small>${o.items.map(i=>esc(i.name)+" × "+i.qty).join(" · ")}</small></div><div><b>${money(o.total)}</b><div class="pill">${esc(o.status)}</div></div></div>`).join(""):"<p style='color:#94a3b8'>Chưa có đơn hàng.</p>"}`)}catch(e){toast(e.message)}}

async function openAdmin(){
  if(!currentUser||currentUser.role!=="admin")return toast("Bạn không có quyền admin.");
  try{const s=await api("/api/admin/stats");const ts=await api("/api/admin/topups");const os=await api("/api/admin/orders");
    openModal(`<div class="modal-head"><div><span class="pill">ADMIN</span><h2 style="margin-top:8px">Quản lý cửa hàng</h2></div><button class="close-btn" onclick="closeModal()">×</button></div><div class="admin-grid"><div class="stat-box"><small>Users</small><strong>${s.users}</strong></div><div class="stat-box"><small>Products</small><strong>${s.products}</strong></div><div class="stat-box"><small>Orders</small><strong>${s.orders}</strong></div><div class="stat-box"><small>Revenue</small><strong>${money(s.revenue)}</strong></div></div><div class="row"><button class="action-btn primary" onclick="openProductAdmin()">+ Thêm sản phẩm</button></div><h3 style="margin:24px 0 10px">Yêu cầu nạp tiền</h3>${ts.filter(x=>x.status==="pending").map(t=>`<div class="cart-row"><div class="cart-row-info"><b>${esc(t.id)}</b><small>${money(t.amount)} · ${esc(t.method)}</small></div><button class="mini-btn" onclick="approveTopup('${t.id}')">Duyệt</button></div>`).join("")||"<p style='color:#94a3b8'>Không có yêu cầu chờ.</p>"}<h3 style="margin:24px 0 10px">Đơn hàng gần đây</h3>${os.slice(0,8).map(o=>`<div class="cart-row"><div class="cart-row-info"><b>${esc(o.id)}</b><small>${money(o.total)}</small></div><select onchange="setOrderStatus('${o.id}',this.value)" style="height:34px;border:1px solid var(--line);border-radius:8px"><option value="paid" ${o.status==="paid"?"selected":""}>paid</option><option value="processing" ${o.status==="processing"?"selected":""}>processing</option><option value="completed" ${o.status==="completed"?"selected":""}>completed</option><option value="cancelled" ${o.status==="cancelled"?"selected":""}>cancelled</option></select></div>`).join("")}<h3 style="margin:24px 0 10px">Sản phẩm của shop</h3><div class="admin-products">${products.map(p=>`<div class="admin-product"><div class="admin-product-main"><div class="admin-product-thumb">${p.image?`<img src="${p.image}" alt="">`:""}</div><div style="min-width:0"><b>${esc(p.name)}</b><small>${esc(p.category)} · ${money(p.price)}</small></div></div><div class="admin-actions"><button class="mini-btn" onclick="openProductAdmin(${p.id})">Sửa</button><button class="mini-btn danger" onclick="deleteProduct(${p.id})">Xóa</button></div></div>`).join("")}</div>`)
  }catch(e){toast(e.message)}
}
async function approveTopup(id){try{await api("/api/admin/topups/"+id+"/approve",{method:"POST"});toast("Đã duyệt");openAdmin()}catch(e){toast(e.message)}}
async function setOrderStatus(id,status){try{await api("/api/admin/orders/"+id,{method:"PATCH",body:JSON.stringify({status})});toast("Đã cập nhật") }catch(e){toast(e.message)}}
function imagePreview(fileInput,target){const f=fileInput.files?.[0];const wrap=$(target);if(!f){wrap.innerHTML="Chọn ảnh để xem trước";return}if(!f.type.startsWith("image/")){toast("Vui lòng chọn file ảnh");fileInput.value="";return}const reader=new FileReader();reader.onload=()=>{wrap.innerHTML=`<img src="${reader.result}" alt="preview">`;wrap.dataset.image=reader.result};reader.readAsDataURL(f)}
function openProductAdmin(id=null){
  const p=id?products.find(x=>x.id===id):null;
  openModal(`<div class="modal-head"><h2>${p?"Sửa sản phẩm":"Thêm sản phẩm"}</h2><button class="close-btn" onclick="closeModal()">×</button></div><form class="form" onsubmit="saveProduct(event,${id||"null"})"><input name="name" placeholder="Tên sản phẩm" value="${esc(p?.name||"")}" required><input name="category" placeholder="Danh mục" value="${esc(p?.category||"")}" required><input name="price" type="number" min="1" placeholder="Giá VND" value="${p?.price||""}" required><input name="oldPrice" type="number" min="0" placeholder="Giá cũ (không bắt buộc)" value="${p?.oldPrice||""}"><input name="badge" placeholder="Nhãn: Hot / Mới" value="${esc(p?.badge||"")}"><input name="delivery" placeholder="Ví dụ: Giao ngay" value="${esc(p?.delivery||"Giao ngay")}"><textarea name="description" placeholder="Mô tả sản phẩm">${esc(p?.description||"")}</textarea><label style="font-size:12px;font-weight:700">Ảnh sản phẩm</label><input name="imageFile" type="file" accept="image/png,image/jpeg,image/webp" onchange="imagePreview(this,'#imagePreview')"><div id="imagePreview" class="image-preview" data-image="${p?.image||""}">${p?.image?`<img src="${p.image}" alt="preview">`:"Chọn ảnh để xem trước"}</div><button type="button" class="mini-btn" onclick="clearProductImage()">Xóa ảnh</button><button class="action-btn primary">${p?"Lưu thay đổi":"Tạo sản phẩm"}</button></form>`)
}
function clearProductImage(){const el=$("#imagePreview");el.dataset.image="";el.innerHTML="Chọn ảnh để xem trước";const file=$("input[name=imageFile]");if(file)file.value=""}
async function saveProduct(e,id){
  e.preventDefault();const f=e.target;const preview=$("#imagePreview");let image=preview?.dataset.image||"";
  if(f.imageFile.files?.[0]){try{image=await fileToDataUrl(f.imageFile.files[0])}catch{toast("Không đọc được ảnh");return}}
  const body={name:f.name.value,category:f.category.value,price:Number(f.price.value),oldPrice:Number(f.oldPrice.value)||0,badge:f.badge.value,delivery:f.delivery.value,description:f.description.value,image};
  try{const p=id?await api("/api/admin/products/"+id,{method:"PUT",body:JSON.stringify(body)}):await api("/api/admin/products",{method:"POST",body:JSON.stringify(body)});if(id){const ix=products.findIndex(x=>x.id===id);if(ix>=0)products[ix]=p}else products.unshift(p);renderProducts();closeModal();toast(id?"Đã cập nhật sản phẩm":"Đã thêm sản phẩm")}catch(err){toast(err.message)}}
function fileToDataUrl(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file)})}
async function deleteProduct(id){if(!confirm("Xóa sản phẩm này?"))return;try{await api("/api/admin/products/"+id,{method:"DELETE"});products=products.filter(p=>p.id!==id);renderProducts();toast("Đã xóa");openAdmin()}catch(e){toast(e.message)}}

function openModal(html){$("#modalCard").innerHTML=html;$("#modal").classList.remove("hidden");$("#modal").setAttribute("aria-hidden","false")}
function closeModal(){$("#modal").classList.add("hidden");$("#modal").setAttribute("aria-hidden","true")}
function clearFilters(){currentCat="all";document.querySelectorAll(".nav-link").forEach(x=>x.classList.toggle("active",x.dataset.filter==="all"));$("#search").value="";$("#sortSelect").value="default";renderProducts()}
function clearSearch(){$("#search").value="";renderProducts()}
function filterCategory(cat){currentCat=cat;document.querySelectorAll(".nav-link").forEach(x=>x.classList.toggle("active",x.dataset.filter===cat));renderProducts();scrollToProducts()}
function scrollToProducts(){$("#products").scrollIntoView({behavior:"smooth"})}
document.querySelectorAll(".nav-link").forEach(b=>b.addEventListener("click",()=>filterCategory(b.dataset.filter)));
$("#search").addEventListener("input",renderProducts);
boot();
