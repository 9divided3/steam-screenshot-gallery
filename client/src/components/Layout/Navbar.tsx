import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useScrollPosition } from '../../hooks/useScrollPosition';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const scrollY = useScrollPosition();
  const scrolled = scrollY > 20;

  const isActive = (path: string) => location.pathname === path;
  const handleLogout = () => { logout(); navigate('/'); };

  return (
    <nav
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-black/40 backdrop-blur-xl border-b border-white/[0.06] shadow-lg shadow-black/20'
          : 'bg-transparent backdrop-blur-sm border-b border-transparent'
      }`}
    >
      <div className={`max-w-7xl mx-auto px-6 flex items-center justify-between transition-all duration-300 ${
        scrolled ? 'h-12' : 'h-14'
      }`}>
        <div className="flex items-center gap-8">
          <Link
            to="/"
            className={`font-display tracking-tight brand-text transition-all duration-300 ${
              scrolled ? 'text-lg' : 'text-xl'
            }`}
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
        <div className="flex items-center gap-2">
          {user ? (
            <>
              <Link to="/profile" className="text-sm text-text-secondary font-medium hover:text-accent transition-colors duration-200">{user.display_name || user.username}</Link>
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary hover:bg-white/5 rounded-lg transition-all duration-200"
              >
                退出
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary rounded-lg transition-all duration-200">
                登录
              </Link>
              <Link
                to="/register"
                className="btn-primary text-sm !px-4 !py-1.5"
              >
                注册
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

function NavLink({ to, active, children }: { to: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className={`relative px-3 py-2 rounded-lg transition-all duration-200 ${
        active
          ? 'text-accent font-medium'
          : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
      }`}
    >
      {children}
      {active && (
        <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-accent rounded-full" />
      )}
    </Link>
  );
}
