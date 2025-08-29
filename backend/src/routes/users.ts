import { Router } from 'express';
import { prisma } from '../db';

import { requireAuth, requireRole } from '../middleware/auth';
import { z } from 'zod';
import { hashPassword } from '../utils/crypto';

export const usersRouter = Router();

usersRouter.get('/', requireAuth, requireRole(['admin']), async (_req, res) => {
  const users = await prisma.usuario.findMany({
    orderBy: { id_usuario: 'asc' },
    select: { id_usuario: true, nome: true, email: true, tipo: true }
  });
  res.json(users.map(u=>({ id: u.id_usuario, nome: u.nome, email: u.email, tipo: u.tipo })));
});

const createUserSchema = z.object({
  nome: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  tipo: z.enum(['aluno', 'professor', 'coordenador', 'admin']),
  matricula: z.string().optional(),
  disciplina: z.string().optional()
});

usersRouter.post('/', requireAuth, requireRole(['admin']), async (req, res) => {
  const parse = createUserSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'Invalid body', details: parse.error.flatten() });
  const { nome, email, password, tipo, matricula, disciplina } = parse.data;
  const senha = await hashPassword(password);
  const created = await prisma.$transaction(async (tx) => {
    const u = await tx.usuario.create({ data: { nome, email, senha, tipo: tipo as any } });
    if (tipo === 'aluno' && matricula) {
      await tx.aluno.create({ data: { id_aluno: u.id_usuario, matricula } });
    }
    if (tipo === 'professor' && disciplina) {
      await tx.professor.create({ data: { id_professor: u.id_usuario, disciplina } });
    }
    return u;
  });
  res.status(201).json({ id: created.id_usuario, email: created.email, tipo: created.tipo });
});

// EDIT user
const updateUserSchema = z.object({
  nome: z.string().min(2).optional(),
  tipo: z.enum(['aluno', 'professor', 'coordenador', 'admin']).optional(),
  password: z.string().min(6).optional(),
  matricula: z.string().nullable().optional(),
  disciplina: z.string().nullable().optional()
});

usersRouter.put('/:id', requireAuth, requireRole(['admin']), async (req, res) => {
  const id = Number(req.params.id);
  const parse = updateUserSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'Invalid body', details: parse.error.flatten() });
  const { nome, tipo, password, matricula, disciplina } = parse.data;

  const updated = await prisma.$transaction(async (tx) => {
    const current = await tx.usuario.findUnique({ where: { id_usuario: id }, include: { aluno: true, professor: true } });
    if (!current) return null;

    let senha: string | undefined;
    if (password) senha = await hashPassword(password);

    if (tipo && tipo !== (current.tipo as any)) {
      if (current.aluno) await tx.aluno.delete({ where: { id_aluno: id } });
      if (current.professor) await tx.professor.delete({ where: { id_professor: id } });
    }

    const u = await tx.usuario.update({
      where: { id_usuario: id },
      data: { ...(nome?{nome}:{}), ...(tipo?{tipo: tipo as any}:{}), ...(senha?{senha}:{}) }
    });

    const effectiveTipo = (tipo ?? (current.tipo as any)) as any;
    if (effectiveTipo === 'aluno') {
      const mat = (matricula ?? undefined) as string | undefined;
      if (await tx.aluno.findUnique({ where: { id_aluno: id } })) {
        await tx.aluno.update({ where: { id_aluno: id }, data: { matricula: mat ?? '' } });
      } else {
        await tx.aluno.create({ data: { id_aluno: id, matricula: mat ?? '' } });
      }
    } else if (effectiveTipo === 'professor') {
      const disc = (disciplina ?? undefined) as string | undefined;
      if (await tx.professor.findUnique({ where: { id_professor: id } })) {
        await tx.professor.update({ where: { id_professor: id }, data: { disciplina: disc ?? '' } });
      } else {
        await tx.professor.create({ data: { id_professor: id, disciplina: disc ?? '' } });
      }
    }

    return u;
  });

  if (!updated) return res.status(404).json({ error: 'Usuário não encontrado' });
  res.json({ id: updated.id_usuario, nome: updated.nome, email: updated.email, tipo: updated.tipo });
});

usersRouter.delete('/:id', requireAuth, requireRole(['admin']), async (req, res) => {
  const id = Number(req.params.id);
  await prisma.usuario.delete({ where: { id_usuario: id } });
  res.status(204).send();
});
