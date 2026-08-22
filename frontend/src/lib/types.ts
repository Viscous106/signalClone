export type User = {
  id: number;
  phone: string;
  username: string | null;
  display_name: string;
  avatar_url: string | null;
  avatar_color: string;
  about: string | null;
  last_seen_at: string | null;
  created_at: string;
};
