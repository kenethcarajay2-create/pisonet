import { createContext, useContext, useState } from 'react';
import { api } from '../services/api.js';
const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => sessionStorage.getItem('pisonet_admin_token'));
  async function login(email, password){
    const { data } = await api.post('/auth/login', { email, password });
    sessionStorage.setItem('pisonet_admin_token', data.token);
    setToken(data.token);
  }
  function logout(){ sessionStorage.removeItem('pisonet_admin_token'); setToken(null); }
  return <AuthContext.Provider value={{ token, login, logout }}>{children}</AuthContext.Provider>;
}
export function useAuth(){ return useContext(AuthContext); }
