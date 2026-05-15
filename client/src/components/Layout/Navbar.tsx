import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useScrollPosition } from '../../hooks/useScrollPosition';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const scrollY = useScrollPosition();
  const scrolled = scrollY > 20;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (path: string) => location.pathname === path;
  const handleLogout = () => { logout(); navigate('/'); };

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Close mobile menu on window resize to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 640) setMobileMenuOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileMenuOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen]);

  return (
    <>
    {mobileMenuOpen && createPortal(
      <div
        className="fixed inset-0 z-40 bg-black/35 backdrop-blur-sm sm:hidden"
        onClick={() => setMobileMenuOpen(false)}
        style={{ animation: 'fadeIn 0.18s ease-out forwards' }}
      />,
      document.body
    )}
    <nav
      className={`sticky top-0 z-50 transition-colors duration-300 ${
        scrolled || mobileMenuOpen
          ? 'bg-black/55 backdrop-blur-xl border-b border-white/[0.08] shadow-lg shadow-black/20'
          : 'bg-transparent backdrop-blur-sm border-b border-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex h-14 items-center justify-between">
        <div className="flex items-center gap-4 sm:gap-8">
          <Link
            to="/"
            className="font-display text-xl tracking-tight brand-text transition-colors duration-300 shrink-0"
          >
            光匣
          </Link>
          {/* Desktop nav links */}
          <div className="hidden sm:flex items-center gap-1 text-sm">
            <NavLink to="/explore" active={isActive('/explore')}>
              探索
            </NavLink>
            {user && (
              <>
                <NavLink to="/gallery" active={isActive('/gallery')}>
                  我的图库
                </NavLink>
                <NavLink to="/import" active={isActive('/import')}>
                  导入
                </NavLink>
                <NavLink to="/profile" active={isActive('/profile')}>
                  个人主页
                </NavLink>
              </>
            )}
          </div>
        </div>

        {/* Desktop auth buttons */}
        <div className="hidden sm:flex items-center gap-2">
          {user ? (
            <>
              <Link to="/profile" className="text-sm text-text-secondary font-medium hover:text-cyan-100 transition-colors duration-200">{user.display_name || user.username}</Link>
              <button
                onClick={handleLogout}
                className="btn-profile-quiet min-h-9 px-3 py-1.5 text-sm"
              >
                退出
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn-profile-quiet min-h-9 px-4 py-1.5 text-sm">
                登录
              </Link>
              <Link
                to="/register"
                className="btn-register min-h-9 px-4 py-1.5 text-sm"
              >
                注册
              </Link>
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className={`btn-icon sm:hidden h-9 w-9 rounded-lg ${mobileMenuOpen ? 'btn-close-red' : ''}`}
          aria-expanded={mobileMenuOpen}
          aria-label={mobileMenuOpen ? '关闭菜单' : '打开菜单'}
        >
          {mobileMenuOpen ? (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile menu drawer */}
      {mobileMenuOpen && (
        <div
          className="sm:hidden border-t border-white/[0.08] bg-black/80 backdrop-blur-2xl shadow-2xl shadow-black/50"
          style={{ animation: 'slideDown 0.2s ease-out forwards' }}
        >
          <div className="px-4 py-3 space-y-1">
            <MobileNavLink to="/explore" active={isActive('/explore')} onClick={() => setMobileMenuOpen(false)}>
              探索
            </MobileNavLink>
            {user ? (
              <>
                <MobileNavLink to="/gallery" active={isActive('/gallery')} onClick={() => setMobileMenuOpen(false)}>
                  我的图库
                </MobileNavLink>
                <MobileNavLink to="/import" active={isActive('/import')} onClick={() => setMobileMenuOpen(false)}>
                  导入
                </MobileNavLink>
                <MobileNavLink to="/profile" active={isActive('/profile')} onClick={() => setMobileMenuOpen(false)}>
                  个人主页
                </MobileNavLink>
                <div className="pt-2 border-t border-white/[0.06] mt-2 flex items-center justify-between">
                  <Link to="/profile" onClick={() => setMobileMenuOpen(false)} className="text-sm text-text-secondary font-medium hover:text-cyan-100 transition-colors duration-200">
                    {user.display_name || user.username}
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="btn-profile-quiet min-h-9 px-3 py-1.5 text-sm"
                  >
                    退出
                  </button>
                </div>
              </>
            ) : (
              <div className="pt-2 border-t border-white/[0.06] mt-2 flex items-center gap-2">
                <Link to="/login" onClick={() => setMobileMenuOpen(false)} className="btn-profile-quiet min-h-10 flex-1 px-4 py-2 text-center text-sm">
                  登录
                </Link>
                <Link
                  to="/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="btn-register min-h-10 flex-1 px-4 py-2 text-center text-sm"
                >
                  注册
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
    </>
  );
}

function NavLink({ to, active, children }: { to: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className={`relative px-3 py-2 rounded-lg transition-all duration-200 ${
        active
          ? 'text-[#f0d4b0] font-medium'
          : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
      }`}
    >
      {children}
      {active && (
        <span className="absolute bottom-0 left-1/2 h-0.5 w-5 -translate-x-1/2 rounded-full bg-[linear-gradient(90deg,transparent_0%,#e8c49a_45%,#f0d4b0_55%,transparent_100%)] shadow-[0_0_12px_rgba(232,196,154,0.55)]" />
      )}
    </Link>
  );
}

function MobileNavLink({ to, active, onClick, children }: { to: string; active: boolean; onClick?: () => void; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={`block px-3 py-2.5 rounded-lg text-sm transition-all duration-200 ${
        active
          ? 'bg-[#e8c49a]/[0.14] text-[#f0d4b0] font-medium'
          : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
      }`}
    >
      {children}
    </Link>
  );
}
