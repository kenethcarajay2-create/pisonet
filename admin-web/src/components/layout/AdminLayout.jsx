import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Ticket, LogOut, Monitor } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
export default function AdminLayout(){ const {logout}=useAuth(); const navigate=useNavigate(); return <div className="min-h-screen bg-slate-950 text-slate-100">
<header className="border-b border-slate-800 bg-slate-900/70"><div className="mx-auto max-w-5xl px-4 py-4 flex justify-between items-center"><div className="flex gap-2 items-center font-bold"><Monitor className="text-sky-400"/> PisoNet Cloud</div><button className="text-sm text-slate-300 flex gap-2 items-center" onClick={()=>{logout();navigate('/login')}}><LogOut size={16}/> Logout</button></div></header>
<div className="mx-auto max-w-5xl px-4 py-6"><nav className="flex gap-2 mb-6">{[["/",LayoutDashboard,"Dashboard"],["/vouchers",Ticket,"Vouchers"]].map(([to,Icon,label])=><NavLink key={to} end to={to} className={({isActive})=>`flex gap-2 items-center rounded-xl px-4 py-2 text-sm ${isActive?'bg-sky-600 text-white':'bg-slate-800 text-slate-300'}`}><Icon size={16}/>{label}</NavLink>)}</nav><Outlet/></div></div>; }
