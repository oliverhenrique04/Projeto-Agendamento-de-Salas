// backend/src/middleware/auth.ts
import type { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';

export type Tipo = 'aluno' | 'professor' | 'coordenador' | 'admin';

export interface AuthUser {
  id: number;
  email: string;
  nome: string;
  tipo: Tipo;
}

interface AuthClaims extends JwtPayload {
  sub: string | number;
  email: string;
  nome: string;
  tipo: Tipo;
  typ?: 'auth' | 'reset' | string; // exigiremos 'auth' nas rotas protegidas
}

function getAuthSecret(): string {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET não configurado');
  return s;
}

/** Autenticação via JWT (Bearer <token>) */
export function requireAuth(req: Request & { user?: AuthUser }, res: Response, next: NextFunction) {
  const header = req.headers.authorization || '';
  const m = header.match(/^Bearer\s+(.+)$/i);
  const token = m?.[1];
  if (!token) return res.status(401).json({ error: 'Missing or invalid Authorization header' });

  try {
    const payload = jwt.verify(token, getAuthSecret()) as AuthClaims;

    // Evita usar token de reset nas rotas protegidas
    if (payload.typ && payload.typ !== 'auth') {
      return res.status(401).json({ error: 'Invalid token type' });
    }

    const id = typeof payload.sub === 'string' ? Number(payload.sub) : payload.sub;
    if (!id || !payload.email || !payload.nome || !payload.tipo) {
      return res.status(401).json({ error: 'Invalid token payload' });
    }

    req.user = { id, email: payload.email, nome: payload.nome, tipo: payload.tipo };
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

/** Autorização por papel (RBAC) */
export function requireRole(roles: Tipo[]) {
  return (req: Request & { user?: AuthUser }, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    if (!roles.includes(req.user.tipo)) return res.status(403).json({ error: 'Insufficient permissions' });
    next();
  };
}
