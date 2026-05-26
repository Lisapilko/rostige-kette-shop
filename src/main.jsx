import React, {useEffect, useMemo, useState} from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import { Bike, Shield, LogIn, LogOut, Plus, Trash2, Edit, Upload, ShoppingBag, Users, BarChart3, Search } from 'lucide-react';
import './style.css';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const emptyItem = { name:'', category:'Sportbike', type:'Supersportler Helm', price:'', stock:'1', image_url:'', description:'', active:true };
const fmt = n => new Intl.NumberFormat('de-DE', {style:'currency', currency:'EUR'}).format(Number(n || 0));

function App(){
  const [tab,setTab]=useState('shop');
  const [session,setSession]=useState(null);
  const [role,setRole]=useState('kunde');
  const [bikes,setBikes]=useState([]); const [helmets,setHelmets]=useState([]); const [sales,setSales]=useState([]);
  const [loading,setLoading]=useState(false); const [error,setError]=useState(''); const [query,setQuery]=useState('');
  const [login,setLogin]=useState({email:'',password:''});
  const [modal,setModal]=useState(null); const [sale,setSale]=useState({customer_name:'', item_type:'bike', item_id:''});

  useEffect(()=>{ if(!supabase) return; supabase.auth.getSession().then(({data})=>setSession(data.session)); const {data:{subscription}}=supabase.auth.onAuthStateChange((_e,s)=>setSession(s)); return()=>subscription.unsubscribe();},[]);
  useEffect(()=>{ loadAll(); },[session]);
  useEffect(()=>{ if(!supabase) return; const ch=supabase.channel('rk-live').on('postgres_changes',{event:'*',schema:'public',table:'bikes'},loadAll).on('postgres_changes',{event:'*',schema:'public',table:'helmets'},loadAll).on('postgres_changes',{event:'*',schema:'public',table:'sales'},loadAll).subscribe(); return()=>supabase.removeChannel(ch);},[session]);

  async function loadAll(){
    if(!supabase) return;
    setLoading(true); setError('');
    try{
      const [{data:b, error:be},{data:h,error:he}] = await Promise.all([
        supabase.from('bikes').select('*').order('created_at',{ascending:false}),
        supabase.from('helmets').select('*').order('created_at',{ascending:false})
      ]);
      if(be) throw be; if(he) throw he;
      setBikes(b||[]); setHelmets(h||[]);
      if(session?.user){
        const {data:p}= await supabase.from('profiles').select('role').eq('id',session.user.id).maybeSingle();
        setRole(p?.role || 'kunde');
        const {data:s}= await supabase.from('sales').select('*').order('created_at',{ascending:false});
        setSales(s||[]);
      } else { setRole('kunde'); setSales([]); }
    }catch(e){ setError(e.message); } finally { setLoading(false); }
  }

  async function signIn(e){ e.preventDefault(); setError(''); const {error}=await supabase.auth.signInWithPassword(login); if(error) setError(error.message); else setLogin({email:'',password:''}); }
  async function signOut(){ await supabase.auth.signOut(); setTab('shop'); }

  const items = useMemo(()=>[...bikes.map(x=>({...x,item_type:'bike'})),...helmets.map(x=>({...x,item_type:'helmet'}))].filter(x=> (x.name||'').toLowerCase().includes(query.toLowerCase())),[bikes,helmets,query]);
  const isAdmin = role==='admin'; const isStaff = role==='admin'||role==='mitarbeiter';

  async function uploadFile(file,bucket){
    const path = `${Date.now()}-${file.name.replaceAll(' ','-')}`;
    const {error}=await supabase.storage.from(bucket).upload(path,file,{upsert:false}); if(error) throw error;
    const {data}=supabase.storage.from(bucket).getPublicUrl(path); return data.publicUrl;
  }

  async function saveProduct(e){
    e.preventDefault(); setError('');
    const isBike = modal.kind==='bike'; const table=isBike?'bikes':'helmets'; const form = new FormData(e.currentTarget);
    let image_url=form.get('image_url') || '';
    const file=form.get('file');
    try{
      if(file && file.size) image_url=await uploadFile(file,isBike?'bike-images':'helmet-images');
      const payload={name:form.get('name'), price:Number(form.get('price')), stock:Number(form.get('stock')), image_url, active:form.get('active')==='on'};
      if(isBike){ payload.category=form.get('category'); payload.description=form.get('description'); }
      else { payload.type=form.get('type'); }
      const req = modal.item?.id ? supabase.from(table).update(payload).eq('id',modal.item.id) : supabase.from(table).insert(payload);
      const {error}= await req; if(error) throw error; setModal(null); loadAll();
    }catch(err){ setError(err.message); }
  }

  async function deleteProduct(kind,id){ if(!confirm('Wirklich löschen?')) return; const {error}=await supabase.from(kind==='bike'?'bikes':'helmets').delete().eq('id',id); if(error) setError(error.message); else loadAll(); }

  async function createSale(e){
    e.preventDefault(); setError(''); const collection=sale.item_type==='bike'?bikes:helmets; const item=collection.find(x=>x.id===sale.item_id);
    if(!item) return setError('Bitte Artikel auswählen.'); if(Number(item.stock)<=0) return setError('Kein Bestand verfügbar.');
    try{
      const {error:se}=await supabase.from('sales').insert({customer_name:sale.customer_name, seller_id:session.user.id, item_type:sale.item_type, item_id:item.id, item_name:item.name, price:item.price}); if(se) throw se;
      const {error:ue}=await supabase.from(sale.item_type==='bike'?'bikes':'helmets').update({stock:Number(item.stock)-1}).eq('id',item.id); if(ue) throw ue;
      setSale({customer_name:'', item_type:'bike', item_id:''}); loadAll();
    }catch(err){ setError(err.message); }
  }

  function ProductCard({item}){ const kind=item.item_type; return <div className="card product"><div className="imgwrap">{item.image_url?<img src={item.image_url}/>:<div className="placeholder">{kind==='bike'?<Bike/>:<Shield/>}</div>}</div><div className="cardbody"><span className="badge">{kind==='bike'?item.category:item.type}</span><h3>{item.name}</h3><p>{item.description || 'Zur Rostigen Kette Modell'}</p><div className="row"><strong>{fmt(item.price)}</strong><span>Bestand: {item.stock}</span></div>{isAdmin&&<div className="actions"><button onClick={()=>setModal({kind,item})}><Edit size={16}/> Bearbeiten</button><button onClick={()=>deleteProduct(kind,item.id)}><Trash2 size={16}/> Löschen</button></div>}</div></div> }

  if(!supabase) return <div className="fatal"><img src="/logo.png"/><h1>Supabase fehlt</h1><p>Bitte VITE_SUPABASE_URL und VITE_SUPABASE_ANON_KEY in Vercel eintragen.</p></div>;

  return <>
    <header><div className="brand"><img src="/logo.png"/><div><h1>Zur Rostigen Kette</h1><span>Bike Shop & Verkaufssystem</span></div></div><nav><button className={tab==='shop'?'active':''} onClick={()=>setTab('shop')}>Kundenansicht</button>{isStaff&&<button className={tab==='sales'?'active':''} onClick={()=>setTab('sales')}>Verkauf</button>}{isAdmin&&<button className={tab==='admin'?'active':''} onClick={()=>setTab('admin')}>Admin</button>}</nav><div>{session?<button onClick={signOut}><LogOut size={16}/> Logout</button>:<button onClick={()=>setTab('login')}><LogIn size={16}/> Login</button>}</div></header>
    <main>
      {error&&<div className="error">{error}</div>}{loading&&<div className="hint">Lade Daten...</div>}
      {tab==='shop'&&<section><div className="hero"><img src="/logo.png"/><div><h2>Modelle anschauen</h2><p>Kunden können nur Bikes und Helme anschauen. Verkäufe werden nur durch Mitarbeiter eingetragen.</p></div></div><div className="toolbar"><Search size={18}/><input placeholder="Modelle suchen..." value={query} onChange={e=>setQuery(e.target.value)}/></div><div className="grid">{items.map(i=><ProductCard key={i.item_type+i.id} item={i}/>)}</div></section>}
      {tab==='login'&&!session&&<section className="auth"><h2>Mitarbeiter / Admin Login</h2><form onSubmit={signIn}><input type="email" placeholder="E-Mail" value={login.email} onChange={e=>setLogin({...login,email:e.target.value})}/><input type="password" placeholder="Passwort" value={login.password} onChange={e=>setLogin({...login,password:e.target.value})}/><button><LogIn size={16}/> Einloggen</button></form></section>}
      {tab==='sales'&&isStaff&&<section><h2><ShoppingBag/> Verkauf eintragen</h2><form className="panel" onSubmit={createSale}><input required placeholder="Kundenname" value={sale.customer_name} onChange={e=>setSale({...sale,customer_name:e.target.value})}/><select value={sale.item_type} onChange={e=>setSale({...sale,item_type:e.target.value,item_id:''})}><option value="bike">Bike</option><option value="helmet">Helm</option></select><select required value={sale.item_id} onChange={e=>setSale({...sale,item_id:e.target.value})}><option value="">Artikel auswählen</option>{(sale.item_type==='bike'?bikes:helmets).map(x=><option key={x.id} value={x.id}>{x.name} — Bestand {x.stock}</option>)}</select><button>Verkauf speichern</button></form><SalesTable sales={sales}/></section>}
      {tab==='admin'&&isAdmin&&<section><div className="stats"><Stat icon={<Bike/>} label="Bikes" value={bikes.length}/><Stat icon={<Shield/>} label="Helme" value={helmets.length}/><Stat icon={<Users/>} label="Verkäufe" value={sales.length}/><Stat icon={<BarChart3/>} label="Umsatz" value={fmt(sales.reduce((a,b)=>a+Number(b.price||0),0))}/></div><div className="admin-actions"><button onClick={()=>setModal({kind:'bike',item:null})}><Plus/> Bike hinzufügen</button><button onClick={()=>setModal({kind:'helmet',item:null})}><Plus/> Helm hinzufügen</button><UploadCanvas/></div><h2>Produkte verwalten</h2><div className="grid">{items.map(i=><ProductCard key={i.item_type+i.id} item={i}/>)}</div><SalesTable sales={sales}/></section>}
    </main>{modal&&<ProductModal modal={modal} saveProduct={saveProduct} close={()=>setModal(null)}/>}<footer>© Zur Rostigen Kette</footer>
  </>;
}
function Stat({icon,label,value}){return <div className="stat">{icon}<span>{label}</span><strong>{value}</strong></div>}
function SalesTable({sales}){return <div className="panel"><h2>Verkäufe</h2><table><thead><tr><th>Datum</th><th>Kunde</th><th>Artikel</th><th>Preis</th></tr></thead><tbody>{sales.map(s=><tr key={s.id}><td>{new Date(s.created_at).toLocaleString('de-DE')}</td><td>{s.customer_name}</td><td>{s.item_name}</td><td>{fmt(s.price)}</td></tr>)}</tbody></table>{!sales.length&&<p className="hint">Noch keine Verkäufe.</p>}</div>}
function ProductModal({modal,saveProduct,close}){ const it=modal.item||emptyItem; const bike=modal.kind==='bike'; return <div className="overlay"><form className="modal" onSubmit={saveProduct}><h2>{bike?'Bike':'Helm'} {modal.item?'bearbeiten':'hinzufügen'}</h2><input name="name" required placeholder="Name" defaultValue={it.name}/>{bike?<select name="category" defaultValue={it.category||'Sportbike'}><option>Sportbike</option><option>Naked Bike</option><option>Cruiser</option><option>Enduro</option><option>Roller</option><option>Touring</option></select>:<select name="type" defaultValue={it.type||'Supersportler Helm'}><option>Supersportler Helm</option><option>Motorcross Helm</option><option>Halbschalen Helm</option></select>}<input name="price" type="number" step="0.01" required placeholder="Preis" defaultValue={it.price}/><input name="stock" type="number" required placeholder="Bestand" defaultValue={it.stock}/><input name="image_url" placeholder="Bild URL oder Datei hochladen" defaultValue={it.image_url}/><input name="file" type="file" accept="image/*"/>{bike&&<textarea name="description" placeholder="Beschreibung" defaultValue={it.description}/>}<label className="check"><input name="active" type="checkbox" defaultChecked={it.active!==false}/> Aktiv sichtbar</label><div className="actions"><button type="button" onClick={close}>Abbrechen</button><button>Speichern</button></div></form></div>}
function UploadCanvas(){ const [msg,setMsg]=useState(''); async function up(e){const f=e.target.files[0]; if(!f)return; const path=`${Date.now()}-${f.name}`; const {error}=await supabase.storage.from('canvas-uploads').upload(path,f); setMsg(error?error.message:'Canvas Datei hochgeladen');} return <label className="upload"><Upload/> Canvas hochladen<input type="file" onChange={up}/><small>{msg}</small></label>}

createRoot(document.getElementById('root')).render(<App/>);
