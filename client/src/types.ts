export interface Screenshot {
  id: number;
  user_id: number;
  game_id: number | null;
  title: string;
  file_path: string;
  thumbnail_path: string | null;
  source: string;
  steam_file_id: string | null;
  is_public: number;
  width: number | null;
  height: number | null;
  file_size: number | null;
  taken_at: string | null;
  created_at: string;
  game_name?: string;
  steam_app_id?: number;
  username?: string;
  display_name?: string;
  likes_count?: number;
}

export interface Game {
  id: number;
  name: string;
  steam_app_id: number | null;
  screenshot_count?: number;
}

export interface Stats {
  totalScreenshots: number;
  totalUsers?: number;
  totalGames?: number;
  publicCount?: number;
  latestImport?: string | null;
}

export interface ImportResponse {
  started?: boolean;
  message?: string;
}
