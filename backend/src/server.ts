import 'dotenv/config';

/**
 * PASSO 2 — Injetar certificados raiz do Windows no TLS do Node (corrige inspeção TLS de antivírus/proxy).
 * Implementação robusta para ESM/TypeScript: tenta CJS (require) e, em fallback, dynamic import.
 */
import { createRequire } from 'module';
(function injectWinCA() {
  const tag = '[TLS] win-ca';
  try {
    const require = createRequire(import.meta.url);
    // Tenta carregar como módulo CommonJS
    const mod: any = require('win-ca');
    if (mod?.inject) {
      mod.inject('+'); // carrega roots + intermediários para https/tls/smtp
    } else if (typeof mod === 'function') {
      mod('+');        // fallback para versões que exportam função direta
    }
    console.log(`${tag}: Windows Root CAs injetados (require)`);
  } catch (errRequire) {
    // Fallback: tenta como módulo ESM
    import('win-ca').then((mod: any) => {
      const injector = mod?.inject || mod?.default || mod;
      if (typeof injector === 'function') {
        injector('+');
        console.log('[TLS] win-ca: Windows Root CAs injetados (dynamic import)');
      } else {
        console.warn('[TLS] win-ca: módulo importado sem função inject/default');
      }
    }).catch((errImport) => {
      console.warn('[TLS] win-ca falhou ao carregar', { errRequire, errImport });
    });
  }
})();

import express from 'express';
import cors from 'cors';
import { authRouter } from './routes/auth';
import { roomsRouter } from './routes/rooms';
import { bookingsRouter } from './routes/bookings';
import { usersRouter } from './routes/users';

console.log('[BOOT] DATABASE_URL =', (process.env.DATABASE_URL || 'undefined')
  .replace(/:\/\/([^:]+):([^@]+)@/, '://$1:*****@'));

const app = express();
app.set('trust proxy', true);
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));

app.use('/auth', authRouter);
app.use('/rooms', roomsRouter);
app.use('/bookings', bookingsRouter);
app.use('/users', usersRouter);

const port = process.env.PORT ? Number(process.env.PORT) : 4000;
app.listen(port, () => {
  console.log(`API running on http://localhost:${port}`);
});
