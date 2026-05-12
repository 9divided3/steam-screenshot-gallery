import { Outlet, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import Navbar from './Navbar';
import VideoBackground from '../VideoBackground/VideoBackground';

export default function Layout() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname]);

  return (
    <div className="flex flex-col min-h-screen grain-overlay">
      <VideoBackground />
      <Navbar />
      <main key={pathname} className="flex-1 animate-page-enter">
        <Outlet />
      </main>
      <footer className="border-t border-border py-8 text-center">
        <p className="text-xs text-text-secondary tracking-wide">
          <span className="brand-text">光匣</span> — 记录和分享游戏中的精彩瞬间
        </p>
      </footer>
    </div>
  );
}
