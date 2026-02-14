import { Outlet } from 'react-router-dom';
import AppNav from './AppNav';

export default function AppLayout() {
  return (
    <div className="min-h-screen">
      <AppNav />
      <Outlet />
    </div>
  );
}
