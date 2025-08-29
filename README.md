# Agendamento de Salas — README

Sistema completo (frontend + backend + banco) para **reservas de salas** com RBAC (aluno/professor/coordenador/admin), calendário, CRUD e fluxo de **“Esqueci minha senha”** via e-mail.

## Sumário

- [Arquitetura & Stack](#arquitetura--stack)
- [Pré-requisitos](#pré-requisitos)
- [Clonar o projeto](#clonar-o-projeto)
- [Instalação do PostgreSQL (Windows/macOS/Linux)](#instalação-do-postgresql-windowsmacoslinux)
  - [Criar banco e usuário](#criar-banco-e-usuário)
  - [Importar o SQL do GitHub](#importar-o-sql-do-github)
- [Configurar variáveis de ambiente](#configurar-variáveis-de-ambiente)
  - [.env do Backend](#env-do-backend)
  - [.env do Frontend](#env-do-frontend)
  - [Gmail (App Password) e TLS no Windows](#gmail-app-password-e-tls-no-windows)
- [Instalar dependências](#instalar-dependências)
- [Rodar localmente](#rodar-localmente)
- [Fluxo de Reset de Senha](#fluxo-de-reset-de-senha)
- [Usuário Admin inicial (opcional)](#usuário-admin-inicial-opcional)
- [Estrutura de pastas](#estrutura-de-pastas)
- [Endpoints principais](#endpoints-principais)
- [Dicas de produção](#dicas-de-produção)
- [Troubleshooting (erros comuns)](#troubleshooting-erros-comuns)
- [Backup & Restore do banco](#backup--restore-do-banco)
- [Docker (opcional)](#docker-opcional)

---

## Arquitetura & Stack

- **Frontend**: React + Vite, React-Bootstrap, FullCalendar, React-Toastify, React-Datepicker, Date-fns, Bootstrap Icons.  
- **Backend**: Node.js + Express (TypeScript), Zod, JWT, Bcrypt, Nodemailer, Prisma Client.  
- **Banco**: PostgreSQL (schema `public`).  
- **Autenticação**: JWT (`typ: 'auth'` para sessão; `typ: 'reset'` para reset).  
- **E-mail**: SMTP (Gmail com App Password recomendado).  
- **RBAC**: aluno / professor / coordenador / admin.

---

## Pré-requisitos

- **Node.js** ≥ 18 (testado com 22.x)
- **npm** ≥ 9 (ou **pnpm**/**yarn**, se preferir)
- **PostgreSQL** ≥ 13
- (Windows) **PowerShell** / **cmd**
- (Opcional) **pgAdmin** (GUI do Postgres)

---

## Clonar o projeto

```bash
git clone https://github.com/<sua-org>/<seu-repo>.git
cd <seu-repo>
```

> Substitua `<sua-org>/<seu-repo>` pelo caminho real do seu GitHub.

---

## Instalação do PostgreSQL (Windows/macOS/Linux)

### Windows

1. Baixe o instalador em: https://www.postgresql.org/download/windows/
2. Durante a instalação:
   - Guarde a **senha do usuário `postgres`**.
   - Instale também **psql** e **pgAdmin** (opcionais mas úteis).

### macOS

- Via Homebrew:
  ```bash
  brew install postgresql@14
  brew services start postgresql@14
  ```
- Alternativa: baixar o instalador no site do Postgres.

### Linux (Debian/Ubuntu)

```bash
sudo apt update
sudo apt install -y postgresql postgresql-contrib
sudo service postgresql start
```

> Verifique o serviço: `sudo service postgresql status`.

---

### Criar banco e usuário

Abra um terminal/PowerShell e execute:

```bash
# entrar no psql (ajuste se pedir senha)
psql -U postgres

-- dentro do psql:
CREATE DATABASE reserva_salas;
CREATE USER app_user WITH ENCRYPTED PASSWORD 'app_password';
GRANT ALL PRIVILEGES ON DATABASE reserva_salas TO app_user;

\c reserva_salas

-- garantir permissões no schema public
GRANT ALL ON SCHEMA public TO app_user;
ALTER DATABASE reserva_salas OWNER TO app_user;

-- (opcional) permitir criação futura de tabelas
ALTER ROLE app_user WITH LOGIN;
```

> Guarde: **banco** `reserva_salas`, **user** `app_user`, **senha** `app_password`.  
> Ajuste conforme sua política.

---

### Importar o SQL do GitHub

Se o repositório tem um arquivo SQL (ex.: `sql/schema.sql` e/ou `sql/seed.sql`):

1. Baixe/clone o projeto (já feito).
2. Rode (ajuste caminho):

```bash
# macOS/Linux:
psql -U app_user -d reserva_salas -f sql/schema.sql
psql -U app_user -d reserva_salas -f sql/seed.sql   # se existir

# Windows (PowerShell), apontando para psql.exe se necessário:
"c:\Program Files\PostgreSQL\15\bin\psql.exe" -U app_user -d reserva_salas -f sql\schema.sql
"c:\Program Files\PostgreSQL\15\bin\psql.exe" -U app_user -d reserva_salas -f sql\seed.sql
```

> Se você usa **Prisma** e o projeto já traz migrations, pode preferir rodar **migrations** em vez do SQL cru. Mas como você pediu **“puxar o SQL do GitHub”**, o bloco acima cobre isso.

---

## Configurar variáveis de ambiente

Crie o arquivo `.env` **dentro de `backend/`** e outro **dentro de `frontend/`** (quando aplicável).

### .env do Backend

Crie `backend/.env`:

```env
# Porta do backend
PORT=4000

# Postgres (ajuste user/senha/host/porta)
DATABASE_URL=postgresql://app_user:app_password@localhost:5432/reserva_salas?schema=public

# JWT (obrigatórios; use chaves fortes)
JWT_SECRET=coloque_uma_chave_grande_e_aleatoria_para_auth
JWT_RESET_SECRET=dsugtvercduhlahgxhsieqerfbvcsdejxighskxwoysjkhrbjuadltddjsylwkglgjnunerrjqrgnbydoooznpuefk

# URL pública do frontend (usada como fallback para links de e-mail)
# Em dev local, Vite fica em 5173; em produção, coloque seu domínio HTTPS
APP_URL=http://localhost:5173

# SMTP (Gmail com App Password)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=seu-email@gmail.com
SMTP_PASS=sua_senha_de_app # NÃO é sua senha normal; veja abaixo
MAIL_FROM=Agendamento <seu-email@gmail.com>

# (opcional) Desabilitar logs muito verbosos de nodemailer em produção
# DEBUG=
```

> **Importante**: `JWT_SECRET` e `JWT_RESET_SECRET` **não podem** ficar vazios.

### .env do Frontend

Crie `frontend/.env`:

```env
# Base URL do backend
VITE_API_BASE=http://localhost:4000
```

> Se você expôs o backend externamente (túnel/dev/prod), ajuste para a URL pública.

### Gmail (App Password) e TLS no Windows

- Ative **2FA** na sua conta Google e crie um **App Password** (Senhas de App) para “Mail”.
- Use esse **App Password** em `SMTP_PASS`.
- **Windows + rede corporativa**: instale **win-ca** (backend) para evitar “self-signed certificate in certificate chain”.

No backend, já temos a injeção:

```ts
// server.ts (já implementado no projeto)
// Injeção dos certificados raiz do Windows (TLS para SMTP/HTTPS)
try {
  require('win-ca').inject('+');
  console.log('[TLS] win-ca: Windows Root CAs injetados');
} catch {
  console.warn('[TLS] win-ca não disponível (npm i win-ca)');
}
```

E instale a dependência:

```bash
cd backend
npm i win-ca
```

---

## Instalar dependências

**Backend**:

```bash
cd backend
npm install
# se usar Prisma:
npm i @prisma/client
# (se o projeto tem schema.prisma)
npx prisma generate
```

**Frontend**:

```bash
cd ../frontend
npm install
```

> Caso esteja usando **pnpm**: `pnpm install` nos dois diretórios.

---

## Rodar localmente

**1) Suba o PostgreSQL** (serviço rodando).

**2) Inicie o backend**:

```bash
cd backend
npm run dev
# Deve logar algo como: API running on http://localhost:4000
```

**3) Inicie o frontend (Vite)**:

```bash
cd ../frontend
npm run dev
# Deve abrir em http://localhost:5173
```

> Se você usar túnel (ex.: `devtunnels`/`ngrok`) o **link do e-mail** usa a **URL do request** automaticamente (via `Origin`/`X-Forwarded-*`/`Host`).  
> Em produção, fixe `APP_URL=https://seu-dominio`.

---

## Fluxo de Reset de Senha

1. Na tela de login, clique em **“Esqueci minha senha”** e informe seu e-mail.
2. O backend envia um link para `/reset-password?token=...` com validade de **30 min**.
3. A página `/reset-password` lê o `token` e envia `POST /auth/reset` com `{ token, password }`.
4. O backend valida o JWT (`typ: 'reset'`), grava o **hash** da nova senha no banco e retorna `ok: true`.
5. O frontend confirma e redireciona ao **login**.

**Observações técnicas:**
- O backend aceita schemas com `id` ou `id_usuario`, e colunas de senha `senha_hash`/`senha`/`password`.  
- Para produção, padronize o schema (recomendado: `id` + `senha_hash`) e remova fallbacks.

---

## Usuário Admin inicial (opcional)

Se você não tem um admin, gere um hash e insira manualmente:

```bash
# Gerar hash bcrypt no Node:
node -e "console.log(require('bcryptjs').hashSync('SenhaF0rte!', 10))"
# copie a saída (começa com $2a$10$...)

# SQL (ajuste nome da tabela/colunas conforme seu schema)
psql -U app_user -d reserva_salas

INSERT INTO usuario (nome, email, tipo, senha_hash)
VALUES ('Admin', 'admin@exemplo.com', 'admin', '<COLE_O_HASH_AQUI>');
```

---

## Estrutura de pastas

```
.
├─ backend/
│  ├─ src/
│  │  ├─ server.ts                 # Express + CORS + win-ca + rotas
│  │  ├─ db.ts                     # PrismaClient singleton
│  │  ├─ middleware/
│  │  │  └─ auth.ts                # requireAuth / requireRole (JWT ‘auth’)
│  │  ├─ routes/
│  │  │  └─ auth.ts                # login/register/forgot/reset/change-password
│  │  ├─ utils/
│  │  │  └─ mailer.ts              # Nodemailer (SMTP)
│  │  └─ ...                       # rooms, bookings, users etc.
│  ├─ package.json
│  └─ .env
└─ frontend/
   ├─ src/
   │  └─ App.tsx                   # Login, Dashboard, Calendário etc.
   ├─ package.json
   └─ .env
```

---

## Endpoints principais

- `POST /auth/register` — cria aluno/professor (front restringe)
- `POST /auth/login` — `{ email, password }` → `{ token, user }`
- `GET  /auth/me` — usuário da sessão (Bearer token)
- `POST /auth/forgot` — envia link de reset
- `POST /auth/reset` — `{ token, password }` (token do e-mail)
- `POST /auth/change-password` — `{ current, next }` (rota autenticada)
- `GET/POST/PUT/DELETE /rooms` — CRUD de salas (RBAC)
- `GET/POST/DELETE /bookings` — reservas (RBAC)
- `GET/POST/PUT/DELETE /users` — gestão de usuários (admin)

> RBAC: **admin** tem tudo; **coordenador** gerencia salas/reservas; **professor/aluno** fazem reservas com restrições.

---

## Dicas de produção

- **HTTPS** sempre (TLS) e **domínio** fixo em `APP_URL`.
- **trust proxy** no Express:
  ```ts
  app.set('trust proxy', true);
  ```
- **Senhas de App** (Gmail) ou provedor SMTP próprio (SendGrid/Mailgun/etc).
- **Logs**: nivele `RESET_OK`, `RESET_VERIFY_FAILED`, `RESET_UPDATE_FAILED`.
- **Rate limit**:
  - `/auth/forgot`: 5 requisições / 15 min por IP/e-mail.
  - `/auth/login`: 10 requisições / 5 min por IP.
- **Segurança de senha**: mínimo 8–10 chars; exigir mistura de tipos; validar no front e no back.
- **Tokens de reset de uso único** (opcional avançado): salve `jti` ou hash do token em tabela e invalide após uso.

---

## Troubleshooting (erros comuns)

### 1) `self-signed certificate in certificate chain` (Windows/SMTP)
- Instale **win-ca**: `npm i win-ca` no `backend/`.
- Confirme que o `server.ts` tem a injeção `require('win-ca').inject('+')`.
- Remova variáveis como `NODE_EXTRA_CA_CERTS` apontando para arquivos inexistentes.

### 2) `Token inválido ou expirado` no reset
- Garante que `JWT_RESET_SECRET` está **definido** e **igual** entre gerar/validar.
- Relógio do sistema atualizado.
- Gere **novo e-mail** após qualquer troca de segredo.
- Verifique logs `RESET_VERIFY_FAILED`.

### 3) Prisma reclamando de campo (`Unknown argument 'id'`)
- Seu model pode usar `id_usuario` em vez de `id`. O código já tenta ambos em **ordem**; se personalizar o schema, ajuste em definitivo.

### 4) Login falha mesmo após reset
- Verifique logs:
  - `LOGIN_NO_PASSWORD_FIELD` → coluna de senha ausente; padronize.
  - `LOGIN_PLAINTEXT_PASSWORD_IN_DB` → há senhas sem hash; normalize (migração).

### 5) SMTP/Gmail não envia
- Use **App Password** (não a senha normal).
- Porta 465 + `secure=true`.
- Veja se firewall/antivírus bloqueiam.

---

## Backup & Restore do banco

**Backup (dump)**

```bash
pg_dump -U app_user -d reserva_salas -F c -f backup.dump
```

**Restore**

```bash
pg_restore -U app_user -d reserva_salas -c backup.dump
```

> Em produção, faça backups automáticos e teste restores periodicamente.

---

## Docker (opcional)

Exemplo básico para banco + pgAdmin (arquivo `docker-compose.yml`):

```yaml
services:
  db:
    image: postgres:14
    environment:
      POSTGRES_DB: reserva_salas
      POSTGRES_USER: app_user
      POSTGRES_PASSWORD: app_password
    ports: ["5432:5432"]
    volumes:
      - ./data/postgres:/var/lib/postgresql/data

  pgadmin:
    image: dpage/pgadmin4
    environment:
      PGADMIN_DEFAULT_EMAIL: admin@local
      PGADMIN_DEFAULT_PASSWORD: admin
    ports: ["5050:80"]
    depends_on: [db]
```

Subir:

```bash
docker compose up -d
```

> A aplicação (backend/frontend) pode ser conteinerizada depois; em prod use **reverse proxy** (Nginx/Caddy), HTTPS, variáveis `.env` seguras e imagens multistage.

---

**Pronto.** Esse README cobre do zero à produção. Se quiser, podemos gerar uma versão específica para o seu schema final (p. ex. fixando `usuario(id, senha_hash)`), assim você remove os fallbacks do backend e deixa tudo 100% tipado no Prisma.
