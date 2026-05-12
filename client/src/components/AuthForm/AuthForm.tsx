import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

interface AuthFormProps {
  mode: 'login' | 'register';
}

export default function AuthForm({ mode }: AuthFormProps) {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isLogin = mode === 'login';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isLogin) {
        await login(username, password);
      } else {
        await register(username, password);
      }
      navigate('/');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-sm animate-fade-up glass p-8 shadow-2xl shadow-black/30">
        <h1 className="font-display text-3xl text-center text-white mb-8">{isLogin ? '登录' : '注册'}</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-white/85 mb-1.5 font-medium">用户名</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="input-field"
              minLength={isLogin ? undefined : 2}
              maxLength={isLogin ? undefined : 30}
              required
            />
          </div>
          <div>
            <label className="block text-sm text-white/85 mb-1.5 font-medium">密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field"
              minLength={isLogin ? undefined : 6}
              required
            />
          </div>
          {error && (
            <p className="text-red-300 text-sm bg-red-500/10 border border-red-400/30 backdrop-blur-md rounded-lg px-3 py-2">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-3"
          >
            {loading ? (isLogin ? '登录中...' : '注册中...') : (isLogin ? '登录' : '注册')}
          </button>
        </form>
        <p className="text-center text-sm text-white/75 mt-5">
          {isLogin ? (
            <>还没有账号？<Link to="/register" className="text-accent hover:text-accent-hover transition-colors duration-200">注册</Link></>
          ) : (
            <>已有账号？<Link to="/login" className="text-accent hover:text-accent-hover transition-colors duration-200">登录</Link></>
          )}
        </p>
      </div>
    </div>
  );
}
