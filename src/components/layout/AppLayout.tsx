import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';

export function AppLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-doqyn-bg">
      <Sidebar />
      <main className="flex h-screen min-w-0 flex-1 flex-col overflow-y-auto scrollbar-thin">
        <div className="h-auto w-full px-4 py-6 sm:px-6 sm:py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
