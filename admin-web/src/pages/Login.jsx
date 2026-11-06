import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { LockKeyhole } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { errorMessage } from '../services/api.js';
export default function Login(){ const {token,login}=useAuth(); const navigate=useNavigate(); const [email,setEmail]=useState(''); const [password,setPassword]=useState(''); const [error,setError]=useState(''); const [busy,setBusy]=useState(false);
if(token) return <Navigate to="/" replace/>;
async function submit(e){e.preventDefault();setBusy(true);setError('');try{await login(email,password);navigate('/');}catch(err){setError(errorMessage(err));}finally{setBusy(false);}}
return <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-4"><form onSubmit={submit} className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-800 p-7 space-y-5"><LockKeyhole className="text-sky-400" size={32}/><div><h1 className="text-2xl font-bold">Admin login</h1><p className="text-slate-400 text-sm mt-1">PisoNet Cloud control panel</p></div><label className="block text-sm">Email<input className="field mt-2" type="email" required value={email} onChange={e=>setEmail(e.target.value)} autoComplete="username"/></label><label className="block text-sm">Password<input className="field mt-2" type="password" required value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password"/></label>{error&&<p role="alert" className="text-rose-400 text-sm">{error}</p>}<button disabled={busy} className="primary w-full">{busy?'Signing in…':'Sign in'}</button></form></main>;
}
