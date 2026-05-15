import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useScrollPosition } from '../../hooks/useScrollPosition';

type NavUser = {
  id: number;
  username: string;
  display_name?: string;
  avatar_url?: string;
};

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const scrollY = useScrollPosition();
  const scrolled = scrollY > 20;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (path: string) => location.pathname === path;
  const handleLogout = () => {
    logout();
    setMobileMenuOpen(false);
    navigate('/');
  };

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

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
          className="fixed inset-0 z-40 bg-black/25 backdrop-blur-md sm:hidden"
          onClick={() => setMobileMenuOpen(false)}
          style={{ animation: 'fadeIn 0.18s ease-out forwards' }}
        />,
        document.body
      )}

      <nav className={`site-nav ${scrolled || mobileMenuOpen ? 'site-nav-sunk' : 'site-nav-top'}`}>
        <div className="site-nav-panel">
        <div className="site-nav-inner">
          <div className="flex items-center gap-4 sm:gap-8">
            <Link
              to="/"
              className="font-display text-xl tracking-tight brand-text transition-colors duration-300 shrink-0"
            >
              光匣
            </Link>

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

          <div className="hidden sm:flex items-center gap-2">
            {user ? (
              <>
                <Link to="/profile" className="text-sm text-text-secondary font-medium hover:text-cyan-100 transition-colors duration-200">
                  {user.display_name || user.username}
                </Link>
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

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className={`btn-icon sm:hidden h-9 w-9 rounded-full ${mobileMenuOpen ? 'btn-close-red' : ''}`}
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? '关闭菜单' : '打开菜单'}
          >
            {mobileMenuOpen ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            )}
          </button>
        </div>
        </div>

        {mobileMenuOpen && (
          <div className="sm:hidden px-3 pb-3">
            <div className="mobile-nav-sheet">
              <div className="mobile-nav-account">
                <div className="min-w-0">
                  <div className="mobile-nav-eyebrow">
                    {user ? 'Signed in' : 'Welcome'}
                  </div>
                  {user && (
                    <div className="mobile-nav-user-name">
                      {user.display_name || user.username}
                    </div>
                  )}
                </div>
                <MobileAvatar user={user} />
              </div>

              <div className="mobile-nav-list">
                <MobileNavLink to="/explore" active={isActive('/explore')} onClick={() => setMobileMenuOpen(false)}>
                  探索
                </MobileNavLink>
                {user && (
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
                  </>
                )}
              </div>

              {user ? (
                <div className="mobile-nav-auth-row">
                  <Link to="/profile" onClick={() => setMobileMenuOpen(false)} className="mobile-nav-auth-name">
                    {user.display_name || user.username}
                  </Link>
                  <button onClick={handleLogout} className="mobile-nav-auth-button">
                    退出
                  </button>
                </div>
              ) : (
                <div className="mobile-nav-auth-actions">
                  <Link to="/login" onClick={() => setMobileMenuOpen(false)} className="mobile-nav-auth-action">
                    登录
                  </Link>
                  <Link to="/register" onClick={() => setMobileMenuOpen(false)} className="mobile-nav-auth-action mobile-nav-auth-action-primary">
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

function MobileAvatar({ user }: { user: NavUser | null }) {
  return (
    <div className="mobile-nav-avatar">
      {user?.avatar_url ? (
        <img src={user.avatar_url} alt="" className="h-full w-full object-cover" />
      ) : (
        <span dir="ltr" className="mobile-nav-avatar-fallback">
          (^-^)
        </span>
      )}
    </div>
  );
}

function MobileNavLink({ to, active, onClick, children }: { to: string; active: boolean; onClick?: () => void; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={`mobile-nav-link ${active ? 'mobile-nav-link-active' : ''}`}
    >
      <span>{children}</span>
      <ChevronIcon />
    </Link>
  );
}

function ChevronIcon() {
  return (
    <svg className="mobile-nav-chevron" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}
