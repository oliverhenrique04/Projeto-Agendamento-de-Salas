// backend/src/routes/auth.ts
import { Router, type Request } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../db';

import { sendMail } from '../utils/mailer';
import { requireAuth } from '../middleware/auth';

export const authRouter = Router();

/* ===========================
   Helpers para schema variável
   =========================== */
function pickId(u: any) {
  return u?.id ?? u?.id_usuario ?? u?.user_id ?? null;
}
// senha pode estar em senha_hash, senha ou password
function pickSenha(u: any) {
  return u?.senha_hash ?? u?.senha ?? u?.password ?? null;
}
function mapUser(u: any) {
  return {
    id: pickId(u),
    email: u?.email,
    nome: u?.nome,
    tipo: u?.tipo,
  };
}

/**
 * Atualiza a senha tentando múltiplas combinações (where + coluna).
 * Retorna qual where/coluna funcionou.
 */
async function updateSenhaByAnyId(
  uid: number,
  hash: string
): Promise<{ whereField: 'id_usuario' | 'id'; col: 'senha_hash' | 'senha' | 'password' }> {
  const whereFields: Array<'id_usuario' | 'id'> = ['id_usuario', 'id'];
  const cols: Array<'senha_hash' | 'senha' | 'password'> = ['senha_hash', 'senha', 'password'];

  for (const whereField of whereFields) {
    for (const col of cols) {
      try {
        await prisma.usuario.update({
          where: { [whereField]: uid } as any,
          data: { [col]: hash } as any,
        });
        return { whereField, col };
      } catch {
        // tenta próxima combinação
      }
    }
  }
  throw new Error('Nenhuma combinação de where/coluna funcionou');
}

/**
 * Busca usuário por id tentando campos diferentes (id_usuario → id).
 */
async function findUserByAnyId(uid: number): Promise<any | null> {
  // tente por id_usuario
  try {
    const u = await prisma.usuario.findUnique({ where: { id_usuario: uid } as any });
    if (u) return u;
  } catch { /* ignore */ }
  // tente por id
  try {
    const u = await prisma.usuario.findUnique({ where: { id: uid } as any });
    if (u) return u;
  } catch { /* ignore */ }
  return null;
}

/* ===========================
   Descobrir APP URL em runtime
   =========================== */
function inferAppUrl(req: Request): string | null {
  const origin = req.get('origin');
  if (origin) return origin.replace(/\/+$/, '');
  const xfProto = (req.get('x-forwarded-proto') || '').split(',')[0]?.trim();
  const xfHost  = (req.get('x-forwarded-host')  || '').split(',')[0]?.trim();
  if (xfProto && xfHost) return `${xfProto}://${xfHost}`;
  const host = req.get('host');
  if (host) return `${req.protocol}://${host}`;
  return null;
}

/* ===========================
   JWT
   =========================== */
function getAuthSecret() {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET não configurado');
  return s;
}
function getResetSecret() {
  const s = process.env.JWT_RESET_SECRET || process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_RESET_SECRET não configurado');
  return s;
}
function signToken(user: any) {
  const payload = {
    sub: pickId(user),
    email: user?.email,
    nome: user?.nome,
    tipo: user?.tipo,
    typ: 'auth' as const,
  };
  return jwt.sign(payload, getAuthSecret(), { expiresIn: '8h' });
}

/* ===========================
   Zod Schemas
   =========================== */
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
const registerSchema = z.object({
  nome: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  // só aluno/professor via UI
  tipo: z.enum(['aluno', 'professor']),
});
const forgotSchema = z.object({
  email: z.string().email(),
});
const resetSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(6),
});
const changePwdSchema = z.object({
  current: z.string().min(1),
  next: z.string().min(6),
});

/* ===========================
   /auth/register
   =========================== */
authRouter.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid body', details: parsed.error.flatten() });

  const { nome, email, password, tipo } = parsed.data;

  const exists = await prisma.usuario.findUnique({ where: { email } as any }).catch(() => null);
  if (exists) return res.status(409).json({ error: 'E-mail já cadastrado.' });

  const hash = await bcrypt.hash(password, 10);

  // cria usuário lidando com nomes de campos diferentes
  try {
    const created = await prisma.usuario.create({ data: { nome, email, senha_hash: hash, tipo } as any });
    return res.status(201).json(mapUser(created));
  } catch {
    try {
      const created = await prisma.usuario.create({ data: { nome, email, senha: hash, tipo } as any });
      return res.status(201).json(mapUser(created));
    } catch {
      const created = await prisma.usuario.create({ data: { nome, email, password: hash, tipo } as any });
      return res.status(201).json(mapUser(created));
    }
  }
});

/* ===========================
   /auth/login
   =========================== */
authRouter.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid body', details: parsed.error.flatten() });
  const { email, password } = parsed.data;

  const user: any = await prisma.usuario.findUnique({ where: { email } as any }).catch(() => null);
  if (!user) return res.status(401).json({ error: 'Credenciais inválidas' });

  const hash = pickSenha(user);
  if (!hash || typeof hash !== 'string') {
    console.warn('LOGIN_NO_PASSWORD_FIELD', { userId: pickId(user), email: user?.email });
    return res.status(500).json({ error: 'Configuração de senha ausente para este usuário' });
  }

  const looksHashed = /^\$2[aby]\$/.test(hash);
  if (!looksHashed) {
    console.warn('LOGIN_PLAINTEXT_PASSWORD_IN_DB', { userId: pickId(user) });
    return res.status(500).json({ error: 'Senha no banco não está com hash. Normalize os dados.' });
  }

  const ok = await bcrypt.compare(password, hash);
  if (!ok) return res.status(401).json({ error: 'Credenciais inválidas' });

  const token = signToken(user);
  return res.json({ token, user: mapUser(user) });
});

/* ===========================
   /auth/me
   =========================== */
authRouter.get('/me', requireAuth, async (req: any, res) => {
  return res.json(req.user);
});

/* ===========================
   /auth/change-password
   =========================== */
authRouter.post('/change-password', requireAuth, async (req: any, res) => {
  const parsed = changePwdSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid body', details: parsed.error.flatten() });
  const { current, next } = parsed.data;

  const meId = Number(req.user?.id);
  if (!meId) return res.status(401).json({ error: 'Not authenticated' });

  // busca por id_usuario → id (sem OR com campo inexistente)
  const user: any = await findUserByAnyId(meId);
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

  const currentHash = pickSenha(user);
  if (!currentHash || typeof currentHash !== 'string') {
    return res.status(500).json({ error: 'Campo de senha não encontrado no schema.' });
  }

  if (!/^\$2[aby]\$/.test(currentHash)) {
    console.warn('CHANGE_PASSWORD_PLAINTEXT_IN_DB', { userId: pickId(user) });
    return res.status(500).json({ error: 'Senha atual no banco não está com hash. Normalize os dados.' });
  }

  const ok = await bcrypt.compare(current, currentHash);
  if (!ok) return res.status(400).json({ error: 'Senha atual inválida' });

  const newHash = await bcrypt.hash(next, 10);
  const info = await updateSenhaByAnyId(pickId(user), newHash);
  console.log('CHANGE_PASSWORD_OK', { userId: pickId(user), ...info });

  return res.json({ ok: true });
});

/* ===========================
   /auth/forgot  (envia e-mail)
   =========================== */
authRouter.post('/forgot', async (req, res) => {
  const parsed = forgotSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid body', details: parsed.error.flatten() });
  const { email } = parsed.data;

  const user: any = await prisma.usuario.findUnique({ where: { email } as any }).catch(() => null);
  // Por segurança, sempre responde 200
  if (!user) return res.json({ ok: true });

  // Gera token curto de reset (typ: 'reset')
  const token = jwt.sign(
    { uid: pickId(user), typ: 'reset' as const },
    getResetSecret(),
    { expiresIn: '30m' }
  );

  // Descobre a URL do app em runtime (com fallbacks)
  const appUrl = inferAppUrl(req) || process.env.APP_URL || 'http://localhost:5173';
  const resetUrl = new URL('/reset-password', appUrl);
  resetUrl.searchParams.set('token', token);

  try {
    await sendMail({
      to: email,
      subject: 'Redefinição de senha',
      html: `
        <p>Olá ${user?.nome || ''},</p>
        <p>Para redefinir sua senha, clique no link abaixo (válido por 30 minutos):</p>
        <p><a href="${resetUrl.toString()}" target="_blank">${resetUrl.toString()}</a></p>
      `,
    });
  } catch (e) {
    console.error('Erro ao enviar e-mail de reset:', e);
  }

  return res.json({ ok: true });
});

/* ===========================
   /auth/reset  (reseta via token)
   =========================== */
authRouter.post('/reset', async (req, res) => {
  const parsed = resetSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid body', details: parsed.error.flatten() });
  const { token, password } = parsed.data;

  // 1) validar token
  let decoded: any;
  try {
    decoded = jwt.verify(token, getResetSecret());
  } catch (e: any) {
    console.warn('RESET_VERIFY_FAILED', { msg: e?.message });
    return res.status(400).json({ error: 'Token inválido ou expirado' });
  }
  if (decoded?.typ && decoded.typ !== 'reset') {
    return res.status(400).json({ error: 'Token inválido para reset' });
  }

  const uid = Number(decoded?.uid ?? decoded?.sub);
  if (!uid) return res.status(400).json({ error: 'Token inválido' });

  // 2) gerar hash e tentar atualizar direto (evita where com campo inexistente)
  const newHash = await bcrypt.hash(password, 10);
  try {
    const info = await updateSenhaByAnyId(uid, newHash);
    console.log('RESET_OK', { uid, ...info });

    // 3) pós-checagem: reler e garantir que está com hash
    const reloaded: any = await findUserByAnyId(uid);
    const stored = pickSenha(reloaded);
    if (!stored || !/^\$2[aby]\$/.test(stored)) {
      console.warn('RESET_POSTCHECK_FAILED', { uid, storedPreview: typeof stored === 'string' ? stored.slice(0, 10) : stored });
    }

    return res.json({ ok: true });
  } catch (e: any) {
    console.warn('RESET_UPDATE_FAILED', { uid, msg: e?.message });
    // se nada bateu, provavelmente o usuário não existe com esse id
    return res.status(404).json({ error: 'Usuário não encontrado' });
  }
});
