import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { profile as profileApi, follows as followsApi } from '../api/client';
import { useLightbox } from '../hooks/useLightbox';
import FollowButton from '../components/FollowButton/FollowButton';
import Lightbox from '../components/Lightbox/Lightbox';
import { screenshotUrl, thumbnailUrl } from '../utils/media';

interface ProfileData {
  id: number;
  username: string;
  display_name: string;
  bio: string;
  avatar_url: string;
  created_at: string;
  followers_count: number;
  following_count: number;
  is_following?: boolean;
  stats: {
    screenshots: number;
    games: number;
    public: number;
    storageBytes: number;
  };
}

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function Profile() {
  const { userId: userIdParam } = useParams<{ userId?: string }>();
  const { user: myUser } = useAuth();
  const targetUserId = userIdParam ? parseInt(userIdParam) : undefined;
  const isOwnProfile = !targetUserId || targetUserId === myUser?.id;

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ display_name: '', bio: '' });
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarFileRef = useRef<File | null>(null);

  // Followers/following list modal
  const [listModal, setListModal] = useState<'followers' | 'following' | null>(null);
  const [listUsers, setListUsers] = useState<Array<{ id: number; username: string; display_name: string; avatar_url: string }>>([]);
  const [listLoading, setListLoading] = useState(false);

  const openList = async (type: 'followers' | 'following') => {
    setListModal(type);
    setListLoading(true);
    const uid = targetUserId || myUser?.id;
    try {
      const data = type === 'followers'
        ? await followsApi.followers(uid)
        : await followsApi.following(uid);
      setListUsers(data.users || []);
    } catch (err) {
      console.error('Failed to load list:', err);
      setListUsers([]);
    } finally {
      setListLoading(false);
    }
  };

  const fetchProfile = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const data = isOwnProfile
        ? await profileApi.get()
        : await profileApi.getUser(targetUserId!);
      setProfile(data.profile);
      setForm({ display_name: data.profile.display_name || '', bio: data.profile.bio || '' });
      setAvatarPreview(null);
      avatarFileRef.current = null;
    } catch (err: any) {
      setError(err.message || '加载失败');
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [isOwnProfile, targetUserId]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    if (!listModal) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setListModal(null);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [listModal]);

  // Showcase
  const [showcased, setShowcased] = useState<Array<{ id: number; file_path: string; thumbnail_path: string | null; title: string; width: number | null; height: number | null; game_name?: string }>>([]);
  const [removingShowcaseIds, setRemovingShowcaseIds] = useState<Set<number>>(new Set());
  const showcaseLightboxImages = showcased.map((s) => ({
    id: s.id,
    file_path: s.file_path,
    title: s.title,
    game_name: s.game_name,
    width: s.width ?? undefined,
    height: s.height ?? undefined,
  }));

  const showcaseLightbox = useLightbox(showcaseLightboxImages);

  const fetchShowcase = useCallback(async () => {
    const uid = targetUserId || myUser?.id;
    if (!uid) return;
    try {
      const data = await profileApi.showcase(uid);
      setShowcased(data.screenshots || []);
    } catch { /* ignore */ }
  }, [targetUserId, myUser?.id]);

  useEffect(() => {
    fetchShowcase();
  }, [fetchShowcase]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2800);
  };

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      showToast('请选择图片文件');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('图片大小不能超过 5MB');
      return;
    }
    avatarFileRef.current = file;
    const reader = new FileReader();
    reader.onload = () => setAvatarPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const fd = new FormData();
      if (form.display_name !== (profile?.display_name || '')) {
        fd.append('display_name', form.display_name);
      }
      if (form.bio !== (profile?.bio || '')) {
        fd.append('bio', form.bio);
      }
      if (avatarFileRef.current) {
        fd.append('avatar', avatarFileRef.current);
      }

      const data = await profileApi.update(fd);

      // Re-fetch to get full profile with stats
      await fetchProfile(false);
      setEditing(false);
      showToast('保存成功');
    } catch (err: any) {
      showToast(err.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = () => {
    setForm({ display_name: profile?.display_name || '', bio: profile?.bio || '' });
    setAvatarPreview(null);
    avatarFileRef.current = null;
    setEditing(true);
  };

  const handleCancel = () => {
    setEditing(false);
    setForm({ display_name: profile?.display_name || '', bio: profile?.bio || '' });
    setAvatarPreview(null);
    avatarFileRef.current = null;
  };

  const handleRemoveShowcase = (screenshotId: number) => {
    setRemovingShowcaseIds((prev) => new Set(prev).add(screenshotId));
    const ids = showcased.map((x) => x.id).filter((id) => id !== screenshotId);

    window.setTimeout(async () => {
      try {
        await profileApi.updateShowcase(ids);
        setShowcased((prev) => prev.filter((x) => x.id !== screenshotId));
        showToast('已从展示中移除');
      } catch (err: any) {
        setRemovingShowcaseIds((prev) => {
          const next = new Set(prev);
          next.delete(screenshotId);
          return next;
        });
        showToast(err?.message || '移除失败');
      }
    }, 520);
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-20">
        <div className="flex flex-col items-center gap-8">
          <div className="skeleton w-32 h-32 rounded-full" />
          <div className="skeleton w-48 h-6" />
          <div className="skeleton w-72 h-4" />
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 w-full mt-8">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="skeleton h-28 rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-20 text-center">
        <p className="text-white/80 text-lg">{error}</p>
        <button onClick={() => fetchProfile()} className="btn-primary mt-6">重试</button>
      </div>
    );
  }

  const avatarSrc = avatarPreview || profile?.avatar_url || undefined;
  const displayName = profile?.display_name || profile?.username || '';

  return (
    <>
    <div className="profile-page-shell max-w-6xl mx-auto px-4 sm:px-6 py-7 sm:py-10">
      {/* Toast */}
      {toast && (
        <div className="fixed top-20 right-6 z-[100] animate-toast-in">
          <div className="glass rounded-xl px-5 py-3 text-sm text-text-primary shadow-xl shadow-black/30">
            {toast}
          </div>
        </div>
      )}

      {/* Hero Section: Avatar + Identity */}
      <div className="profile-hero-panel mb-6 sm:mb-8">
        <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start gap-5 md:gap-10">
          {/* Avatar */}
          <div className="relative isolate shrink-0">
            <div
              className={`profile-avatar-frame relative z-10 w-32 h-32 sm:w-40 sm:h-40 transition-all duration-500 border-2 ${
                dragOver ? 'border-cyan-300 scale-105 shadow-xl shadow-cyan-300/30' : 'border-white/25 hover:border-cyan-300/60'
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => editing && fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (editing && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              role={editing ? 'button' : undefined}
              tabIndex={editing ? 0 : undefined}
              title={editing ? '点击或拖放上传头像' : undefined}
            >
              {avatarSrc ? (
                <img
                  src={avatarSrc}
                  alt="头像"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-white/10 backdrop-blur-md flex items-center justify-center">
                  <span className="text-4xl sm:text-5xl text-white/65 font-display select-none">
                    {(displayName[0] || profile?.username?.[0] || '?').toUpperCase()}
                  </span>
                </div>
              )}

              {/* Upload overlay */}
              {editing && (
                <div className={`absolute inset-0 flex items-center justify-center transition-all duration-300 rounded-full ${
                  dragOver
                    ? 'bg-cyan-400/[0.28] backdrop-blur-sm'
                    : 'bg-black/20 hover:bg-black/40 hover:backdrop-blur-sm'
                }`}>
                  <svg
                    className={`w-8 h-8 transition-all duration-300 ${
                      dragOver ? 'text-white scale-110' : 'text-white/80'
                    }`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3" />
                  </svg>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                }}
              />
            </div>
          </div>

          {/* Identity + Actions grouped */}
          <div className="flex-1 flex flex-col items-center md:items-start text-center md:text-left pt-1 w-full min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between w-full gap-4">
              <div className="flex-1 min-w-0">
                {editing ? (
                  <input
                    className="input-field text-2xl font-display mb-2 max-w-xs mx-auto md:mx-0"
                    placeholder="显示名称"
                    value={form.display_name}
                    onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
                    maxLength={50}
                    autoFocus
                  />
                ) : (
                  <h1 className="text-3xl sm:text-4xl md:text-5xl font-display text-white tracking-tight leading-tight">
                    {displayName}
                  </h1>
                )}
                <p className="text-white/80 text-sm mt-1 font-mono">
                  @{profile?.username}
                </p>
                <div className="flex items-center justify-center md:justify-start gap-3 mt-4 text-sm">
                  <button
                    onClick={() => openList('followers')}
                    className="profile-social-summary-button"
                  >
                    <span className="profile-social-summary-item">
                      <span className="font-semibold text-white text-lg tabular-nums">{profile?.followers_count ?? 0}</span>
                      <span className="text-white/80">粉丝</span>
                    </span>
                    <span className="profile-social-summary-divider" />
                    <span className="profile-social-summary-item">
                      <span className="font-semibold text-white text-lg tabular-nums">{profile?.following_count ?? 0}</span>
                      <span className="text-white/80">关注</span>
                    </span>
                  </button>
                </div>
                <div className="flex items-center justify-center md:justify-start gap-2 mt-2.5">
                  <span className="text-xs px-2.5 py-1 rounded-full bg-white/[0.10] border border-white/[0.14] text-white/[0.78] backdrop-blur-sm">
                    加入于 {profile?.created_at ? formatDate(profile.created_at) : '-'}
                  </span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-center md:justify-end gap-2 shrink-0">
                {isOwnProfile ? (
                  editing ? (
                    <>
                      <button onClick={handleSave} disabled={saving} className="btn-profile text-sm !px-6">
                        {saving ? '保存中...' : '保存'}
                      </button>
                      <button onClick={handleCancel} className="btn-profile-quiet text-sm">
                        取消
                      </button>
                    </>
                  ) : (
                    <button onClick={handleEdit} className="btn-profile text-sm !px-5">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                      </svg>
                      编辑资料
                    </button>
                  )
                ) : (
                  profile && (
                    <FollowButton
                      userId={profile.id}
                      initialIsFollowing={profile.is_following}
                      className="btn-profile"
                    />
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bio Section */}
      <div className="mb-6 sm:mb-8">
        <div className="profile-section-panel">
          <h3 className="text-xs font-medium text-white/65 uppercase tracking-wider mb-3">个人简介</h3>
          {isOwnProfile && editing ? (
            <div className="relative">
              <textarea
                className="input-field min-h-[80px] resize-none"
                placeholder="写一段个人简介..."
                value={form.bio}
                onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                maxLength={30}
              />
              <span className="absolute bottom-2 right-3 text-[11px] text-white/75">
                {form.bio.length}/30
              </span>
            </div>
          ) : (
            <p className={`text-white/80 leading-relaxed text-sm ${!profile?.bio && 'italic text-white/65'}`}>
              {profile?.bio || '暂无个人简介。点击“编辑资料”来介绍一下自己吧。'}
            </p>
          )}
        </div>
      </div>

      {/* Showcased Screenshots */}
      <div className="mb-7 sm:mb-9">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-display text-lg text-white">精选展示</h2>
            <p className="text-xs text-white/65 mt-0.5">共 {showcased.length} 张</p>
          </div>
        </div>
        {showcased.length > 0 ? (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {showcased.map((s, i) => (
              <div
                key={s.id}
                className={`profile-showcase-card group cursor-pointer hover-lift ${
                  removingShowcaseIds.has(s.id) ? 'profile-showcase-removing pointer-events-none' : ''
                }`}
                onClick={() => showcaseLightbox.open(i)}
              >
                <div className="aspect-[16/10] img-hover-zoom">
                  <img
                    src={s.thumbnail_path ? thumbnailUrl(s.id) : screenshotUrl(s.id)}
                    alt={s.title || ''}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
                {(s.game_name || s.title) && (
                  <p className="px-3 py-2 text-xs text-white/80 truncate font-medium">{s.game_name || s.title}</p>
                )}
                {isOwnProfile && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveShowcase(s.id);
                    }}
                    className="btn-icon-round btn-close-red absolute top-2 right-2 z-10 h-7 w-7 text-sm opacity-0 group-hover:opacity-100"
                    title="从展示中移除"
                  >
                    &times;
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="profile-empty-panel">
            <svg className="w-10 h-10 text-white/20 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
            </svg>
            <p className="text-white/80 text-sm">
              {isOwnProfile
                ? '还没有精选展示。在图库中点开图片，点击“展示”按钮即可添加到主页。'
                : '该用户还没有精选展示。'}
            </p>
            {isOwnProfile && (
              <p className="text-white/55 text-xs mt-2">最多可选择 6 张截图展示在个人主页</p>
            )}
          </div>
        )}
      </div>

      {/* Stats Grid */}
      <h2 className="font-display text-lg text-white mb-4">数据统计</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          label="截图总数"
          value={profile?.stats.screenshots ?? 0}
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
            </svg>
          }
        />
        <StatCard
          label="游戏数量"
          value={profile?.stats.games ?? 0}
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
            </svg>
          }
        />
        <StatCard
          label="公开截图"
          value={profile?.stats.public ?? 0}
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          }
        />
        <StatCard
          label="存储空间"
          value={formatBytes(profile?.stats.storageBytes ?? 0)}
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125v-3.75" />
            </svg>
          }
        />
      </div>
    </div>

    {/* Followers / Following list modal: outside animated container so fixed covers full viewport */}
    {listModal && createPortal(
      <div
        className="profile-modal-backdrop"
        style={{ animation: 'fadeIn 0.2s ease-out forwards' }}
        onClick={() => setListModal(null)}
      >
        <div
          className="profile-modal-panel"
          style={{ animation: 'scaleIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="profile-modal-header">
            <div className="flex items-start justify-between gap-4 px-5 pt-5">
              <div className="min-w-0">
                <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-cyan-100/75">Social</p>
                <h2 className="mt-1 font-display text-2xl text-white">
                  {listModal === 'followers' ? '粉丝' : '关注'}
                </h2>
                <p className="mt-1 truncate text-xs text-white/60">{displayName}</p>
              </div>
              <button
                onClick={() => setListModal(null)}
                className="btn-icon btn-close-red h-8 w-8 rounded-lg shrink-0"
                aria-label="关闭"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="profile-social-tabs mx-5 mt-4 mb-4">
              <button
                type="button"
                onClick={() => listModal !== 'followers' && openList('followers')}
                className={`profile-social-tab ${listModal === 'followers' ? 'profile-social-tab-active' : ''}`}
              >
                <span className="tabular-nums">{profile?.followers_count ?? 0}</span>
                <span>粉丝</span>
              </button>
              <button
                type="button"
                onClick={() => listModal !== 'following' && openList('following')}
                className={`profile-social-tab ${listModal === 'following' ? 'profile-social-tab-active' : ''}`}
              >
                <span className="tabular-nums">{profile?.following_count ?? 0}</span>
                <span>关注</span>
              </button>
            </div>
          </div>
          <div className="profile-modal-list flex-1 overflow-y-auto px-3 py-3">
            <div className="mb-3 flex items-center justify-between px-2 text-xs text-white/60">
              <span>{listModal === 'followers' ? '关注你的人' : '你关注的人'}</span>
              <span>{listUsers.length} 位</span>
            </div>
            {listLoading ? (
              <div className="space-y-2 p-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="profile-modal-user-row">
                    <div className="skeleton w-12 h-12 rounded-full shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="skeleton h-4 w-32" />
                      <div className="skeleton h-3 w-20" />
                    </div>
                  </div>
                ))}
              </div>
            ) : listUsers.length === 0 ? (
              <div className="profile-social-empty">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/[0.12] bg-white/[0.06]">
                  <svg className="h-6 w-6 text-white/35" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.1 9.1 0 0 0 3.75.78 6.75 6.75 0 0 0-13.5 0 9.1 9.1 0 0 0 3.75-.78m6 0a9.08 9.08 0 0 1-6 0m6 0a6.75 6.75 0 1 0-6 0M15 8.25a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                  </svg>
                </div>
                <p className="text-sm text-white/75">
                  {listModal === 'followers' ? '还没有粉丝' : '还没有关注任何人'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {listUsers.map((u) => (
                  <Link
                    key={u.id}
                    to={`/profile/${u.id}`}
                    onClick={() => setListModal(null)}
                    className="profile-modal-user-row group"
                  >
                    {u.avatar_url ? (
                      <img
                        src={u.avatar_url}
                        alt=""
                        className="w-12 h-12 rounded-full object-cover shrink-0 ring-1 ring-white/[0.16]"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-white/[0.08] flex items-center justify-center shrink-0 ring-1 ring-white/[0.16]">
                        <span className="text-base text-white/70 font-display">
                          {(u.display_name?.[0] || u.username[0]).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white font-semibold truncate group-hover:text-cyan-100 transition-colors">
                        {u.display_name || u.username}
                      </p>
                      <p className="text-xs text-white/55 truncate">@{u.username}</p>
                    </div>
                    <span className="profile-social-open">主页</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>,
      document.body
    )}

    {/* Showcase Lightbox: outside animated container so fixed positioning works */}
    {showcaseLightbox.isOpen && (
      <Lightbox
        images={showcaseLightboxImages}
        currentIndex={showcaseLightbox.currentIndex!}
        onClose={showcaseLightbox.close}
        onPrev={showcaseLightbox.prev}
        onNext={showcaseLightbox.next}
      />
    )}
    </>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
}) {
  return (
    <div className="profile-stat-card">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-white/75 uppercase tracking-wider">{label}</span>
        <span className="text-cyan-100 group-hover:text-white transition-colors duration-300">{icon}</span>
      </div>
      <p className="text-2xl font-display text-white tracking-tight tabular-nums">
        {value}
      </p>
    </div>
  );
}
