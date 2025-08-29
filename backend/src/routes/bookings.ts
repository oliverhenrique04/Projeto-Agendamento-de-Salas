import { Router } from 'express';
import { prisma } from '../db';

import { requireAuth } from '../middleware/auth';
import { z } from 'zod';

export const bookingsRouter = Router();

/** Aceita "YYYY-MM-DDTHH:mm", "YYYY-MM-DDTHH:mm:ss", "DD/MM/YYYY HH:mm" e Date */
const zDateFlexible = z.preprocess((v) => {
  if (v instanceof Date) return v;
  if (typeof v === 'string') {
    const s = v.trim();

    // 2025-08-28T11:24 ou 2025-08-28T11:24:00 (padrão de <input type="datetime-local">)
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(s)) return new Date(s);

    // 28/08/2025 11:24
    const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})[ T](\d{2}):(\d{2})$/);
    if (m) {
      const [, dd, mm, yyyy, HH, MM] = m;
      return new Date(Number(yyyy), Number(mm) - 1, Number(dd), Number(HH), Number(MM));
    }

    const d = new Date(s);
    if (!isNaN(+d)) return d;
  }
  return v;
}, z.date());

/** Coerções + datas flexíveis */
const bookingSchema = z.object({
  id_sala: z.coerce.number().int().positive(),
  inicio: zDateFlexible,            // << trocamos z.string().datetime() por parser flexível
  fim: zDateFlexible,               // << idem
  id_usuario: z.coerce.number().int().positive().optional(),
});

bookingsRouter.get('/', requireAuth, async (req: any, res) => {
  const mine = req.query.mine === 'true';
  const where = mine ? { id_usuario: req.user!.id } : {};
  const bookings = await prisma.registro.findMany({
    where,
    orderBy: { inicio: 'asc' },
    include: { usuario: { select: { id_usuario: true, nome: true, tipo: true } }, sala: true },
  });
  res.json(bookings);
});

bookingsRouter.post('/', requireAuth, async (req: any, res) => {
  try {
    // aceita aliases comuns
    const raw = req.body ?? {};
    const payload = {
      id_sala: raw.id_sala ?? raw.idSala ?? raw.roomId,
      inicio: raw.inicio ?? raw.start ?? raw.dataInicio,
      fim: raw.fim ?? raw.end ?? raw.dataFim,
      id_usuario: raw.id_usuario ?? raw.idUsuario ?? raw.userId,
    };

    const parsed = bookingSchema.safeParse(payload);
    if (!parsed.success) {
      console.warn('POST /bookings invalid body:', { issues: parsed.error.flatten(), rawBody: raw });
      return res.status(400).json({ error: 'Invalid body', details: parsed.error.flatten() });
    }

    const { id_sala, inicio, fim, id_usuario } = parsed.data;

    if (fim <= inicio) return res.status(400).json({ error: 'fim deve ser após inicio' });

    // checagem de sobreposição
    const conflict = await prisma.registro.findFirst({
      where: { id_sala, AND: [{ inicio: { lt: fim } }, { fim: { gt: inicio } }] },
      select: { id_registro: true },
    });
    if (conflict) return res.status(409).json({ error: 'Conflito de horário para esta sala' });

    const canDelegate = req.user!.tipo === 'admin' ;
    const targetUserId = canDelegate && id_usuario ? id_usuario : req.user!.id;

    const created = await prisma.registro.create({
      data: { id_usuario: targetUserId, id_sala, inicio, fim },
    });

    res.status(201).json(created);
  } catch (err: any) {
    console.error('booking create error:', err);
    res.status(500).json({ error: 'Falha ao criar reserva', details: err?.message });
  }
});

bookingsRouter.delete('/:id', requireAuth, async (req: any, res) => {
  const id = Number(req.params.id);
  const booking = await prisma.registro.findUnique({ where: { id_registro: id } });
  if (!booking) return res.status(404).json({ error: 'Agendamento não encontrado' });

  if (
    booking.id_usuario !== req.user!.id &&
    req.user!.tipo !== 'admin'
  ) {
    return res.status(403).json({ error: 'Sem permissão' });
  }

  await prisma.registro.delete({ where: { id_registro: id } });
  res.status(204).send();
});
