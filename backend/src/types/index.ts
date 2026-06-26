export interface User {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  failed_attempts: number;
  locked_until: Date | null;
  is_admin: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface RefreshToken {
  id: string;
  user_id: string;
  token_hash: string;
  family: string;
  revoked: boolean;
  expires_at: Date;
  created_at: Date;
}

export interface JwtPayload {
  sub: string;
  email: string;
  name: string;
  isAdmin?: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}
