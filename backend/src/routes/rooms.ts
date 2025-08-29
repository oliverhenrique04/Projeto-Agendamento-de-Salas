// backend/src/routes/rooms.ts
import { Router } from 'express';
import { prisma } from '../prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { z } from 'zod';

export const roomsRouter = Router();

roomsRouter.get('/', requireAuth, async (_req, res) => {
  const rooms = await prisma.sala.findMany({ orderBy: { id_sala: 'asc' } });
  res.json(rooms);
});

const roomSchema = z.object({
  nome_sala: z.string().min(1),
  capacidade: z.number().int().min(1)
});

// CREATE: admin ou coordenador
roomsRouter.post('/', requireAuth, requireRole(['admin', 'coordenador']), async (req, res) => {
  const parse = roomSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'Invalid body', details: parse.error.flatten() });
  const room = await prisma.sala.create({ data: parse.data });
  res.status(201).json(room);
});

// UPDATE: admin ou coordenador
roomsRouter.put('/:id', requireAuth, requireRole(['admin', 'coordenador']), async (req, res) => {
  const id = Number(req.params.id);
  const parse = roomSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'Invalid body', details: parse.error.flatten() });
  const room = await prisma.sala.update({ where: { id_sala: id }, data: parse.data });
  res.json(room);
});

// DELETE: somente admin
roomsRouter.delete('/:id', requireAuth, requireRole(['admin']), async (req, res) => {
  const id = Number(req.params.id);
  await prisma.sala.delete({ where: { id_sala: id } });
  res.status(204).send();
});
