
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import AdminLayout from '../components/layout/AdminLayout.jsx';
import Login from '../pages/Login.jsx';
import Dashboard from '../pages/Dashboard.jsx';
import Vouchers from '../pages/Vouchers.jsx';
import Computers from '../pages/Computers.jsx';

function Protected({ children }) {
  const { token } = useAuth();

  return token
    ? children
    : <Navigate to="/login" replace />;
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        element={
          <Protected>
            <AdminLayout />
          </Protected>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/vouchers" element={<Vouchers />} />
        <Route path="/computers" element={<Computers />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
