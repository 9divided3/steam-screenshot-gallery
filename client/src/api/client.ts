const BASE = '/api';

async function request(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  // Don't set Content-Type for FormData (browser sets it with boundary)
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${BASE}${path}`, { ...options, headers });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: '请求失败' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return res.json();
}

// Auth
export const auth = {
  register: (username: string, password: string) =>
    request('/auth/register', { method: 'POST', body: JSON.stringify({ username, password }) }),
  login: (username: string, password: string) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  me: () => request('/auth/me'),
};

// Screenshots
export const screenshots = {
  list: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request(`/screenshots${qs}`);
  },
  ids: (params?: Record<string, string>) => {
    const merged = { ids_only: '1', ...params };
    const qs = '?' + new URLSearchParams(merged).toString();
    return request(`/screenshots${qs}`);
  },
  get: (id: number) => request(`/screenshots/${id}`),
  delete: (id: number) => request(`/screenshots/${id}`, { method: 'DELETE' }),
  togglePublic: (id: number, isPublic: boolean) =>
    request(`/screenshots/${id}/public`, { method: 'PUT', body: JSON.stringify({ is_public: isPublic }) }),
  batchPublic: (ids: number[], isPublic: boolean) =>
    request(`/screenshots/batch-public`, { method: 'PUT', body: JSON.stringify({ ids, is_public: isPublic }) }),
  batchGame: (ids: number[], gameId: number) =>
    request(`/screenshots/batch-game`, { method: 'PUT', body: JSON.stringify({ ids, game_id: gameId }) }),
  importSteamApi: (steamId: string) =>
    request('/screenshots/import/steam-api', { method: 'POST', body: JSON.stringify({ steam_id: steamId }) }),
  importProgress: () =>
    request('/screenshots/import/progress'),
  retrySteamFailed: () =>
    request('/screenshots/import/steam-retry-failed', { method: 'POST' }),
  cancelImport: () =>
    request('/screenshots/import/cancel', { method: 'POST' }),
  clearImportProgress: () =>
    request('/screenshots/import/progress', { method: 'DELETE' }),
  importSteamImage: (formData: FormData) =>
    request('/screenshots/import/steam-image', { method: 'POST', body: formData }),
  importFolder: (formData: FormData) =>
    request('/screenshots/import/folder', { method: 'POST', body: formData }),
  deleteUserAll: () =>
    request('/screenshots/user-all', { method: 'DELETE' }),
  batchDelete: (ids: number[]) =>
    request('/screenshots/batch', { method: 'DELETE', body: JSON.stringify({ ids }) }),
};

// Games
export const games = {
  list: () => request('/games'),
  get: (id: number) => request(`/games/${id}`),
  search: (q: string) => request(`/games/search?q=${encodeURIComponent(q)}`),
};

// Stats & Config
export const stats = {
  my: () => request('/stats'),
  public: () => request('/public/stats'),
};

export const config = {
  get: () => request('/config'),
  update: (data: { steam_api_key?: string; steam_id?: string }) =>
    request('/config', { method: 'PUT', body: JSON.stringify(data) }),
};

// Profile
export const profile = {
  get: () => request('/profile'),
  getUser: (userId: number) => request(`/profile/${userId}`),
  update: (data: FormData) => request('/profile', { method: 'PUT', body: data }),
  showcase: (userId?: number) => {
    const path = userId ? `/profile/showcase/${userId}` : '/profile/showcase';
    return request(path);
  },
  updateShowcase: (ids: number[]) =>
    request('/profile/showcase', { method: 'PUT', body: JSON.stringify({ ids }) }),
};

// Follows
export const follows = {
  follow: (userId: number) => request(`/follows/${userId}`, { method: 'POST' }),
  unfollow: (userId: number) => request(`/follows/${userId}`, { method: 'DELETE' }),
  status: (userId: number) => request(`/follows/status/${userId}`),
  following: (userId?: number) => {
    const qs = userId ? `?userId=${userId}` : '';
    return request(`/follows/following${qs}`);
  },
  followers: (userId?: number) => {
    const qs = userId ? `?userId=${userId}` : '';
    return request(`/follows/followers${qs}`);
  },
  feed: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request(`/follows/feed${qs}`);
  },
};

// Public
export const pub = {
  screenshots: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request(`/public/screenshots${qs}`);
  },
  games: () => request('/public/games'),
};

// Likes
export const likes = {
  like: (screenshotId: number) =>
    request(`/likes/${screenshotId}`, { method: 'POST' }),
  unlike: (screenshotId: number) =>
    request(`/likes/${screenshotId}`, { method: 'DELETE' }),
  status: (screenshotId: number) =>
    request(`/likes/status/${screenshotId}`),
  myLikes: () => request('/likes/mylikes'),
  top: (limit?: number) => {
    const qs = limit ? `?limit=${limit}` : '';
    return request(`/likes/top${qs}`);
  },
};
