// Carrega .env
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';


const prisma = new PrismaClient();

// Uso: npx tsx scripts/reset-admin.ts <email> <NovaSenha>
async function main() {
  const [email, newPass] = process.argv.slice(2);
  console.log('DATABASE_URL =', process.env.DATABASE_URL ?? '(vazia)');
  if (!email || !newPass) {
    console.error('Uso: npx tsx scripts/reset-admin.ts <email> <NovaSenha>');
    process.exit(1);
  }

  console.log('Procurando usuário:', email);
  const found = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id_usuario, email FROM public.usuario WHERE email = $1`,
    email
  );
  console.log('Encontrados:', found.length);

  if (found.length === 0) {
    console.error('Usuário não encontrado.');
    process.exit(2);
  }

  const hashed = await bcrypt.hash(newPass, 10);
  const updated = await prisma.$executeRawUnsafe(
    `UPDATE public.usuario SET senha = $1 WHERE email = $2`,
    hashed,
    email
  );
  console.log('Linhas atualizadas:', Number(updated));
  console.log(`Senha redefinida para ${email}.`);
}

main()
  .catch((e) => { console.error('Erro no reset:', e); process.exit(99); })
  .finally(async () => { await prisma.$disconnect(); });
