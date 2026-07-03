import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';

export function AppLayout() {
  return (
    <div className="app-shell flex min-h-dvh bg-doqyn-bg">
      <Sidebar />
      <main className="main-content flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto scrollbar-thin">
        <div className="page-outlet flex min-h-full flex-1 flex-col px-4 py-6 sm:px-6 sm:py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
