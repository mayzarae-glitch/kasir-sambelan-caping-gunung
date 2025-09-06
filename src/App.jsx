import React, { useEffect, useMemo, useState } from "react";

/* Kasir Sambelan Caping Gunung - simplified single-file App for Vite+React+Tailwind
   NOTE: This is a prototype that stores data in localStorage.
*/

const IDR = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const STORAGE = {
  SALES: "scg_pos_sales",
  USERS: "scg_pos_users",
  INVENTORY: "scg_pos_inventory",
  SETTINGS: "scg_pos_settings",
  THEME: "scg_pos_theme",
};

// Initial menu (subset)
const INITIAL_MENU = [
  { name: "Ayam goreng", price: 10000, category: "Serba 10K", stock: 50 },
  { name: "Telur dadar", price: 10000, category: "Serba 10K", stock: 100 },
  { name: "Lele goreng", price: 10000, category: "Serba 10K", stock: 50 },
  { name: "Ayam goreng jumbo", price: 21000, category: "Penyetan", stock: 20 },
  { name: "Tahu tempe goreng", price: 10000, category: "Penyetan", stock: 40 },
  { name: "Es cendol ori", price: 7000, category: "Es cendol", stock: 80 },
  { name: "Jus alpukat", price: 10000, category: "Jus buah", stock: 60 },
];

const DEFAULT_USERS = [
  { username: "admin", password: btoa("admin123"), role: "admin" },
  { username: "kasir", password: btoa("kasir123"), role: "kasir" },
];

function loadStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}
function saveStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem(STORAGE.THEME) || "light");
  useEffect(() => { document.documentElement.classList.toggle("dark", theme === "dark"); localStorage.setItem(STORAGE.THEME, theme); }, [theme]);

  const [users, setUsers] = useState(() => loadStorage(STORAGE.USERS, DEFAULT_USERS));
  const [currentUser, setCurrentUser] = useState(() => loadStorage("scg_pos_current_user", null));
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });

  useEffect(() => saveStorage(STORAGE.USERS, users), [users]);
  useEffect(() => saveStorage("scg_pos_current_user", currentUser), [currentUser]);

  const [settings, setSettings] = useState(() => loadStorage(STORAGE.SETTINGS, {
    shopName: "Sambelan Caping Gunung",
    address: "Jalan Contoh No.1",
    footer: "Terima kasih - Sampai jumpa lagi",
    logoDataUrl: null,
    printerThermal: false,
  }));

  const [inventory, setInventory] = useState(() => loadStorage(STORAGE.INVENTORY, INITIAL_MENU));
  const [sales, setSales] = useState(() => loadStorage(STORAGE.SALES, []));
  useEffect(() => saveStorage(STORAGE.INVENTORY, inventory), [inventory]);
  useEffect(() => saveStorage(STORAGE.SALES, sales), [sales]);

  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState("Semua");
  const [cart, setCart] = useState([]);
  const [discountRp, setDiscountRp] = useState(0);
  const [discountPct, setDiscountPct] = useState(0);
  const [ppn, setPpn] = useState(true);
  const [serviceFee, setServiceFee] = useState(0);
  const [cash, setCash] = useState(0);
  const [orderNo, setOrderNo] = useState(() => loadStorage("scg_pos_order_no", 1));
  useEffect(() => localStorage.setItem("scg_pos_order_no", orderNo), [orderNo]);

  const flatItems = useMemo(() => inventory, [inventory]);
  const categories = useMemo(() => ["Semua", ...Array.from(new Set(inventory.map((i) => i.category)))], [inventory]);

  const items = useMemo(() => {
    let data = flatItems;
    if (activeCat !== "Semua") data = data.filter((i) => i.category === activeCat);
    if (query.trim()) data = data.filter((i) => i.name.toLowerCase().includes(query.toLowerCase()));
    return data;
  }, [query, activeCat, flatItems]);

  const subTotal = cart.reduce((s, it) => s + it.price * it.qty, 0);
  const discByPct = Math.round((subTotal * (Number(discountPct) || 0)) / 100);
  const discTotal = Math.min(subTotal, (Number(discountRp) || 0) + discByPct);
  const tax = ppn ? Math.round((subTotal - discTotal) * 0.11) : 0;
  const total = subTotal - discTotal + tax + (Number(serviceFee) || 0);
  const change = Math.max(0, (Number(cash) || 0) - total);

  const addToCart = (item) => {
    if (item.stock <= 0) return alert("Stok habis");
    setCart((c) => {
      const idx = c.findIndex((x) => x.name === item.name);
      if (idx >= 0) {
        const cp = [...c];
        if (cp[idx].qty + 1 > item.stock) return alert("Melebihi stok");
        cp[idx].qty += 1;
        return cp;
      }
      return [...c, { name: item.name, price: item.price, qty: 1, note: "" }];
    });
  };

  const updateQty = (name, delta) => {
    const inv = inventory.find((i) => i.name === name);
    setCart((c) =>
      c
        .map((it) => {
          if (it.name !== name) return it;
          const newQty = Math.max(1, it.qty + delta);
          if (inv && newQty > inv.stock) return it;
          return { ...it, qty: newQty };
        })
        .filter((it) => it.qty > 0)
    );
  };

  const removeItem = (name) => setCart((c) => c.filter((it) => it.name !== name));
  const clearCart = () => setCart([]);

  const saveSale = (paid, method = "Cash") => {
    const time = new Date().toISOString();
    const record = {
      id: `${Date.now()}`,
      orderNo,
      time,
      items: cart,
      subTotal,
      discountRp: Number(discountRp) || 0,
      discountPct: Number(discountPct) || 0,
      tax,
      serviceFee: Number(serviceFee) || 0,
      total,
      paid,
      method,
      change: Math.max(0, paid - total),
      cashier: currentUser ? currentUser.username : "guest",
      voided: false,
    };
    setSales((s) => [record, ...s]);
    setInventory((inv) => {
      const copy = inv.map((it) => {
        const inCart = cart.find((c) => c.name === it.name);
        if (!inCart) return it;
        return { ...it, stock: Math.max(0, it.stock - inCart.qty) };
      });
      return copy;
    });
    setOrderNo((n) => n + 1);
  };

  const printReceipt = (record) => {
    const win = window.open("", "print", "width=400,height=600");
    const logoImg = settings.logoDataUrl ? `<img src='${settings.logoDataUrl}' style='max-width:120px;margin:0 auto;display:block' />` : "";
    const lines = [
      `<div style='font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; padding:12px; width:300px'>`,
      `${logoImg}`,
      `<div style='text-align:center; font-weight:700; font-size:16px'>${settings.shopName}</div>`,
      `<div style='text-align:center; font-size:11px'>${settings.address}</div>`,
      `<div style='text-align:center; font-size:11px'>Nota: ${record.orderNo} | ${new Date(record.time).toLocaleString()}</div>`,
      `<hr/>`,
      ...record.items.map((it) => `<div style='font-size:12px; display:flex; justify-content:space-between'><span>${it.qty} x ${it.name}</span><span>${IDR.format(it.price * it.qty)}</span></div>`),
      `<hr/>`,
      `<div style='display:flex; justify-content:space-between'><span>Sub total</span><span>${IDR.format(record.subTotal)}</span></div>`,
      record.discountRp || record.discountPct ? `<div style='display:flex; justify-content:space-between'><span>Diskon</span><span>-${IDR.format(record.discountRp + Math.round((record.subTotal*(record.discountPct||0))/100))}</span></div>` : "",
      record.tax ? `<div style='display:flex; justify-content:space-between'><span>PPN 11%</span><span>${IDR.format(record.tax)}</span></div>` : "",
      record.serviceFee ? `<div style='display:flex; justify-content:space-between'><span>Biaya layanan</span><span>${IDR.format(record.serviceFee)}</span></div>` : "",
      `<div style='display:flex; justify-content:space-between; font-weight:700'><span>Total</span><span>${IDR.format(record.total)}</span></div>`,
      `<div style='display:flex; justify-content:space-between'><span>Paid (${record.method})</span><span>${IDR.format(record.paid)}</span></div>`,
      `<div style='display:flex; justify-content:space-between'><span>Kembali</span><span>${IDR.format(record.change)}</span></div>`,
      `<hr/>`,
      `<div style='text-align:center; margin-top:8px; font-size:12px'>${settings.footer}</div>`,
      `</div>`,
    ].join("");
    win.document.write(lines);
    win.document.close();
    win.focus();
    win.print();
    win.close();
  };

  const payAndFinish = (method = "Cash") => {
    const paid = Number(cash) || 0;
    if (!cart.length) return alert("Keranjang masih kosong");
    if (paid < total) return alert("Uang belum cukup");
    const rec = {
      id: `${Date.now()}`,
      orderNo,
      time: new Date().toISOString(),
      items: cart,
      subTotal,
      discountRp: Number(discountRp) || 0,
      discountPct: Number(discountPct) || 0,
      tax,
      serviceFee: Number(serviceFee) || 0,
      total,
      paid,
      method,
      change: Math.max(0, paid - total),
      cashier: currentUser ? currentUser.username : "guest",
      voided: false,
    };
    setSales((s) => [rec, ...s]);
    setInventory((inv) => inv.map((it) => {
      const inCart = cart.find((c) => c.name === it.name);
      if (!inCart) return it;
      return { ...it, stock: Math.max(0, it.stock - inCart.qty) };
    }));
    printReceipt(rec);
    clearCart();
    setDiscountRp(0); setDiscountPct(0); setPpn(true); setServiceFee(0); setCash(0);
    setOrderNo((n) => n + 1);
  };

  const voidSale = (id) => {
    if (!confirm("Batalkan/void transaksi ini?")) return;
    setSales((s) => s.map((r) => (r.id === id ? { ...r, voided: true } : r)));
    alert("Transaksi dibatalkan");
  };

  const filteredSales = useMemo(() => sales, [sales]);

  const exportCSV = (list = sales) => {
    const header = ["id,orderNo,time,items,subtotal,discountRp,discountPct,tax,serviceFee,total,paid,change,method,cashier,voided"].join("\n");
    const rows = list.map((s) => {
      const itemsStr = s.items.map((it) => `${it.name} x${it.qty}`).join(" | ");
      return [s.id, s.orderNo, s.time, `"${itemsStr}"`, s.subTotal, s.discountRp, s.discountPct, s.tax, s.serviceFee, s.total, s.paid, s.change, s.method, s.cashier, s.voided].join(",");
    });
    const blob = new Blob([header + "\n" + rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `laporan-penjualan-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const backupJSON = () => {
    const data = { settings, inventory, users, sales };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `backup-scg-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    URL.revokeObjectURL(url);
  };
  const restoreJSON = (raw) => {
    try {
      const d = JSON.parse(raw);
      if (d.settings) setSettings(d.settings);
      if (d.inventory) setInventory(d.inventory);
      if (d.users) setUsers(d.users);
      if (d.sales) setSales(d.sales);
      alert("Restore sukses");
    } catch (e) { alert("File tidak valid"); }
  };

  const uploadLogo = (file) => {
    const r = new FileReader();
    r.onload = () => setSettings((s) => ({ ...s, logoDataUrl: r.result }));
    r.readAsDataURL(file);
  };

  const adjustStock = (name, delta) => setInventory((inv) => inv.map((i) => (i.name === name ? { ...i, stock: Math.max(0, i.stock + delta) } : i)));
  const addMenuItem = (item) => setInventory((inv) => [...inv, item]);
  const updateMenuItem = (name, data) => setInventory((inv) => inv.map((i) => (i.name === name ? { ...i, ...data } : i)));
  const removeMenuItem = (name) => setInventory((inv) => inv.filter((i) => i.name !== name));

  const [page, setPage] = useState("pos");

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-900">
        <div className="w-full max-w-md bg-white dark:bg-neutral-800 p-6 rounded-2xl shadow">
          <h2 className="text-xl font-bold mb-3">Masuk ke POS - Sambelan Caping Gunung</h2>
          <input placeholder="Username" value={loginForm.username} onChange={(e)=>setLoginForm((s)=>({...s,username:e.target.value}))} className="w-full mb-2 px-3 py-2 rounded-md border" />
          <input type="password" placeholder="Password" value={loginForm.password} onChange={(e)=>setLoginForm((s)=>({...s,password:e.target.value}))} className="w-full mb-2 px-3 py-2 rounded-md border" />
          <div className="flex gap-2">
            <button onClick={()=>{ const {username,password}=loginForm; const u = users.find(x=>x.username===username && x.password===btoa(password)); if(!u) return alert('Gagal login'); setCurrentUser({ username: u.username, role: u.role }); }} className="flex-1 bg-emerald-600 text-white px-3 py-2 rounded-md">Masuk</button>
            <button onClick={()=>{ setLoginForm({ username: "", password: "" }); setCurrentUser({ username: 'guest', role: 'guest' }); }} className="px-3 py-2 rounded-md border">Tamu</button>
          </div>
          <div className="mt-4 text-sm text-neutral-500">Default: admin/admin123 | kasir/kasir123</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100">
      <header className="sticky top-0 z-10 bg-white/70 dark:bg-neutral-900/70 backdrop-blur border-b py-3">
        <div className="max-w-7xl mx-auto px-4 flex items-center gap-3">
          <div className="text-2xl font-bold">{settings.shopName} — POS</div>
          <div className="ml-auto flex items-center gap-2">
            <div className="text-sm">User: <span className="font-semibold">{currentUser.username}</span> ({currentUser.role})</div>
            <button onClick={()=>setTheme(t=>t==='dark'?'light':'dark')} className="px-3 py-1 rounded-2xl bg-neutral-100">{theme==='dark'?'🌙':'☀️'}</button>
            <button onClick={()=>{ setCurrentUser(null); localStorage.removeItem('scg_pos_current_user'); }} className="px-3 py-1 rounded-2xl border">Logout</button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-4 grid md:grid-cols-4 gap-4">
        <aside className="md:col-span-1 space-y-2">
          <nav className="bg-white dark:bg-neutral-800 p-3 rounded-2xl border">
            <div className="flex flex-col gap-2">
              <button onClick={()=>setPage('pos')} className={`text-left px-3 py-2 rounded ${page==='pos' ? 'bg-emerald-600 text-white' : ''}`}>POS</button>
              <button onClick={()=>setPage('inventory')} className={`text-left px-3 py-2 rounded ${page==='inventory' ? 'bg-emerald-600 text-white' : ''}`}>Inventory</button>
              <button onClick={()=>setPage('reports')} className={`text-left px-3 py-2 rounded ${page==='reports' ? 'bg-emerald-600 text-white' : ''}`}>Laporan</button>
              {currentUser.role==='admin' && <button onClick={()=>setPage('users')} className={`text-left px-3 py-2 rounded ${page==='users' ? 'bg-emerald-600 text-white' : ''}`}>Users</button>}
              <button onClick={()=>setPage('settings')} className={`text-left px-3 py-2 rounded ${page==='settings' ? 'bg-emerald-600 text-white' : ''}`}>Pengaturan</button>
            </div>
          </nav>

          <div className="bg-white dark:bg-neutral-800 p-3 rounded-2xl border">
            <div className="text-sm font-semibold mb-2">Ringkasan</div>
            <div className="text-sm">Stok rendah: {inventory.filter(i => i.stock <= 5).length}</div>
            <div className="text-sm">Transaksi total: {sales.length}</div>
            <div className="text-sm">Order next: <span className="font-semibold">{orderNo}</span></div>
            <div className="mt-2 flex gap-2">
              <button onClick={backupJSON} className="px-2 py-1 rounded bg-neutral-100">Backup</button>
              <label className="px-2 py-1 rounded bg-neutral-100 cursor-pointer">
                Restore
                <input type="file" accept="application/json" className="hidden" onChange={(e)=>{ const f=e.target.files?.[0]; if(f){ const r=new FileReader(); r.onload=()=>restoreJSON(r.result); r.readAsText(f); } }} />
              </label>
            </div>
          </div>

        </aside>

        <section className="md:col-span-3">
          {page==='pos' && (
            <div className="grid lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                <div className="mb-3 grid gap-2">
                  <input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Cari menu..." className="w-full rounded-2xl border px-4 py-2" />
                  <div className="flex gap-2 overflow-x-auto">
                    {categories.map(c => <button key={c} onClick={()=>setActiveCat(c)} className={`px-3 py-1 rounded ${activeCat===c ? 'bg-emerald-600 text-white' : 'bg-neutral-100'}`}>{c}</button>)}
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {items.map(it => (
                    <button key={it.name} onClick={()=>addToCart(it)} className="text-left rounded p-3 bg-white border">
                      <div className="text-sm text-neutral-500">{it.category}</div>
                      <div className="font-semibold">{it.name}</div>
                      <div className="text-emerald-600 font-bold">{IDR.format(it.price)}</div>
                      <div className="text-xs text-neutral-500">Stok: {it.stock}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="bg-white p-3 rounded-2xl border flex items-center justify-between">
                  <div className="font-semibold">Keranjang</div>
                  <div>Nota: <span className="font-semibold">{orderNo}</span></div>
                </div>
                <div className="bg-white mt-3 rounded-2xl border max-h-[420px] overflow-auto">
                  {cart.length===0 && <div className="p-4 text-sm text-neutral-500">Keranjang kosong</div>}
                  {cart.map(it => (
                    <div key={it.name} className="p-3 grid grid-cols-[1fr_auto] gap-2">
                      <div>
                        <div className="font-medium">{it.name}</div>
                        <div className="text-sm text-neutral-500">{IDR.format(it.price)} / porsi</div>
                        <input value={it.note} onChange={(e)=>setCart(c=>c.map(x=>x.name===it.name?{...x,note:e.target.value}:x))} placeholder="Catatan" className="mt-1 w-full text-sm rounded border px-2 py-1" />
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={()=>updateQty(it.name,-1)} className="px-2 py-1 rounded bg-neutral-100">−</button>
                        <div className="w-8 text-center font-semibold">{it.qty}</div>
                        <button onClick={()=>updateQty(it.name,1)} className="px-2 py-1 rounded bg-neutral-100">＋</button>
                        <button onClick={()=>removeItem(it.name)} className="ml-2 px-2 py-1 rounded bg-rose-100 text-rose-700">Hapus</button>
                      </div>
                      <div className="col-span-2 text-right font-bold text-emerald-600">{IDR.format(it.price*it.qty)}</div>
                    </div>
                  ))}
                </div>

                <div className="bg-white p-3 rounded-2xl border mt-3">
                  <div className="flex justify-between"><span>Sub total</span><span>{IDR.format(subTotal)}</span></div>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <input type="number" value={discountRp} onChange={(e)=>setDiscountRp(Number(e.target.value)||0)} placeholder="Diskon Rp" className="px-2 py-1 rounded border" />
                    <input type="number" value={discountPct} onChange={(e)=>setDiscountPct(Number(e.target.value)||0)} placeholder="Diskon %" className="px-2 py-1 rounded border" />
                    <label className="flex items-center gap-2"><input type="checkbox" checked={ppn} onChange={(e)=>setPpn(e.target.checked)} /> PPN 11%</label>
                    <input type="number" value={serviceFee} onChange={(e)=>setServiceFee(Number(e.target.value)||0)} placeholder="Biaya layanan" className="px-2 py-1 rounded border" />
                  </div>

                  <div className="flex justify-between mt-2 font-extrabold text-emerald-700"><span>Total</span><span>{IDR.format(total)}</span></div>

                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <input type="number" value={cash} onChange={(e)=>setCash(Number(e.target.value)||0)} placeholder="Masukkan jumlah tunai" className="px-2 py-1 rounded border" />
                    <select className="px-2 py-1 rounded border" defaultValue="Cash" id="pay-method">
                      <option>Cash</option>
                      <option>Transfer</option>
                      <option>QRIS</option>
                    </select>
                  </div>

                  <div className="flex justify-between mt-2"><span>Kembalian</span><span className="font-semibold">{IDR.format(change)}</span></div>

                  <div className="flex gap-2 mt-3">
                    <button onClick={()=>printReceipt({ orderNo, time: new Date().toISOString(), items: cart, subTotal, discountRp, discountPct, tax, serviceFee, total, paid: cash, method: document.getElementById('pay-method').value || 'Cash', change, cashier: currentUser.username })} className="flex-1 px-3 py-2 rounded bg-neutral-100">Preview Struk</button>
                    <button onClick={()=>payAndFinish(document.getElementById('pay-method').value || 'Cash')} className="flex-1 px-3 py-2 rounded bg-emerald-600 text-white">Bayar & Simpan</button>
                  </div>
                </div>

              </div>
            </div>
          )}

          {page==='inventory' && (
            <div className="bg-white p-3 rounded-2xl border">
              <h3 className="font-semibold mb-2">Inventory</h3>
              <div className="grid grid-cols-3 gap-2 mb-3">
                <input placeholder="Nama item" id="new-name" className="px-2 py-1 border rounded" />
                <input placeholder="Harga" id="new-price" type="number" className="px-2 py-1 border rounded" />
                <input placeholder="Stok" id="new-stock" type="number" className="px-2 py-1 border rounded" />
                <input placeholder="Kategori" id="new-cat" className="px-2 py-1 border rounded" />
                <button onClick={()=>{
                  const name = document.getElementById('new-name').value.trim();
                  const price = Number(document.getElementById('new-price').value||0);
                  const stock = Number(document.getElementById('new-stock').value||0);
                  const category = document.getElementById('new-cat').value.trim()||'Lain';
                  if(!name) return alert('Isi nama');
                  addMenuItem({name,price,stock,category});
                }} className="px-3 py-2 rounded bg-emerald-600 text-white">Tambah Item</button>
              </div>
              <div className="overflow-auto max-h-[480px]">
                <table className="w-full text-sm">
                  <thead className="text-left text-neutral-500"><tr><th>Nama</th><th>Kategori</th><th>Harga</th><th>Stok</th><th>Aksi</th></tr></thead>
                  <tbody>
                    {inventory.map(i => (
                      <tr key={i.name} className={`${i.stock<=5 ? 'bg-rose-50' : ''}`}>
                        <td>{i.name}</td>
                        <td>{i.category}</td>
                        <td>{IDR.format(i.price)}</td>
                        <td>{i.stock}</td>
                        <td>
                          <button onClick={()=>{ const delta = Number(prompt('Tambah/kurangi stok (neg untuk kurangi)', '0')||0); adjustStock(i.name, delta); }} className="px-2 py-1 rounded bg-neutral-100 mr-1">Ubah Stok</button>
                          <button onClick={()=>{ const p = Number(prompt('Harga baru', i.price)||i.price); updateMenuItem(i.name, { price: p }); }} className="px-2 py-1 rounded bg-neutral-100">Ubah Harga</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {page==='reports' && (
            <div className="bg-white p-3 rounded-2xl border">
              <h3 className="font-semibold mb-2">Laporan</h3>
              <div className="flex gap-2 mb-3">
                <input type="date" className="px-2 py-1 border rounded" />
                <input type="date" className="px-2 py-1 border rounded" />
                <button onClick={()=>exportCSV(filteredSales)} className="px-3 py-1 rounded bg-emerald-600 text-white">Export CSV</button>
              </div>
              <div className="mb-3 grid grid-cols-3 gap-2 text-sm">
                <div className="p-2 rounded border">Transaksi: <b>{filteredSales.length}</b></div>
                <div className="p-2 rounded border">Pendapatan Kotor: <b>{IDR.format(filteredSales.reduce((s,t)=>s+t.subTotal,0))}</b></div>
                <div className="p-2 rounded border">Pendapatan Bersih: <b>{IDR.format(filteredSales.reduce((s,t)=>s+t.total,0))}</b></div>
              </div>
              <div className="overflow-auto max-h-[420px]">
                <table className="w-full text-sm">
                  <thead className="text-left text-neutral-500"><tr><th>Nota</th><th>Waktu</th><th>Kasir</th><th>Total</th><th>Status</th><th>Aksi</th></tr></thead>
                  <tbody>
                    {filteredSales.map(s => (
                      <tr key={s.id} className={`${s.voided ? 'opacity-50' : ''}`}>
                        <td>{s.orderNo}</td>
                        <td>{new Date(s.time).toLocaleString()}</td>
                        <td>{s.cashier}</td>
                        <td>{IDR.format(s.total)}</td>
                        <td>{s.voided ? 'Dibatalkan' : 'Selesai'}</td>
                        <td>
                          <button onClick={()=>printReceipt(s)} className="px-2 py-1 rounded bg-neutral-100 mr-1">Print</button>
                          {!s.voided && <button onClick={()=>voidSale(s.id)} className="px-2 py-1 rounded bg-rose-100 text-rose-700">Void</button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {page==='users' && currentUser.role==='admin' && (
            <div className="bg-white p-3 rounded-2xl border">
              <h3 className="font-semibold mb-2">Manajemen Users</h3>
              <div className="grid grid-cols-3 gap-2 mb-3">
                <input id="u-user" placeholder="username" className="px-2 py-1 border rounded" />
                <input id="u-pass" placeholder="password" className="px-2 py-1 border rounded" />
                <select id="u-role" className="px-2 py-1 border rounded"><option value="kasir">kasir</option><option value="admin">admin</option></select>
                <button onClick={()=>{
                  const u=document.getElementById('u-user').value.trim(); const p=document.getElementById('u-pass').value; const r=document.getElementById('u-role').value; if(!u||!p) return alert('isi'); setUsers(s=>[{username:u,password:btoa(p),role:r},...s]); alert('User terdaftar');
                }} className="px-3 py-2 rounded bg-emerald-600 text-white">Tambah User</button>
              </div>
              <div className="overflow-auto max-h-[420px]">
                <table className="w-full text-sm">
                  <thead className="text-neutral-500 text-left"><tr><th>Username</th><th>Role</th><th>Aksi</th></tr></thead>
                  <tbody>
                    {users.map(u=> (
                      <tr key={u.username}><td>{u.username}</td><td>{u.role}</td><td>{u.username!=='admin' && <button onClick={()=>setUsers(users.filter(x=>x.username!==u.username))} className="px-2 py-1 rounded bg-rose-100 text-rose-700">Hapus</button>}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {page==='settings' && (
            <div className="bg-white p-3 rounded-2xl border">
              <h3 className="font-semibold mb-2">Pengaturan Toko</h3>
              <input placeholder="Nama Toko" value={settings.shopName} onChange={(e)=>setSettings(s=>({...s,shopName:e.target.value}))} className="w-full px-2 py-1 border rounded mb-2" />
              <input placeholder="Alamat" value={settings.address} onChange={(e)=>setSettings(s=>({...s,address:e.target.value}))} className="w-full px-2 py-1 border rounded mb-2" />
              <input placeholder="Footer struk" value={settings.footer} onChange={(e)=>setSettings(s=>({...s,footer:e.target.value}))} className="w-full px-2 py-1 border rounded mb-2" />
              <div className="mb-2">Upload logo (akan muncul di struk): <input type="file" accept="image/*" onChange={(e)=>{ const f=e.target.files?.[0]; if(f) { const r=new FileReader(); r.onload = ()=>setSettings(s=>({...s,logoDataUrl:r.result})); r.readAsDataURL(f); } }} /></div>
              <label className="flex items-center gap-2"><input type="checkbox" checked={settings.printerThermal} onChange={(e)=>setSettings(s=>({...s,printerThermal:e.target.checked}))} /> Gunakan mode printer thermal</label>
            </div>
          )}

        </section>
      </main>

      <footer className="text-center text-xs text-neutral-500 py-4">© {new Date().getFullYear()} Sambelan Caping Gunung — POS</footer>
    </div>
  );
}