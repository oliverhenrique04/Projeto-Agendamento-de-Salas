import React, { useEffect, useMemo, useState } from 'react';
import { Container, Row, Col, Card, Button, Form, Navbar, Nav, Table, Alert, Modal, Badge } from 'react-bootstrap';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { api } from './api';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import bootstrap5Plugin from '@fullcalendar/bootstrap5';
import { EventClickArg } from '@fullcalendar/core';
import ptBrLocale from '@fullcalendar/core/locales/pt-br';
import './calendar.css';
import './theme.css';
import ReactDatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { addMinutes, format } from 'date-fns';
import { ptBR as dfptBR } from 'date-fns/locale';
import 'bootstrap-icons/font/bootstrap-icons.css';
import { ErrorBoundary } from './ErrorBoundary';

type Tipo = 'aluno' | 'professor' | 'coordenador' | 'admin';
type User = { id: number; email: string; nome: string; tipo: Tipo };
type Room = { id_sala: number; nome_sala: string; capacidade: number };
type Booking = {
  id_registro: number;
  id_sala: number;
  id_usuario: number;
  inicio: string;
  fim: string;
  sala: Room;
  usuario: { id_usuario: number; nome: string; tipo: string };
};

/* ================== AUTH ================== */
function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => {
    const token = localStorage.getItem('token');
    const cached = localStorage.getItem('me');
    if (token && cached) setUser(JSON.parse(cached));
  }, []);
  function login(u: User, token: string) {
    localStorage.setItem('token', token);
    localStorage.setItem('me', JSON.stringify(u));
    setUser(u);
  }
  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('me');
    setUser(null);
  }
  return { user, login, logout };
}

/* ================== RESET PASSWORD PAGE ================== */
/** Página exibida quando a URL é /reset-password?token=... */
function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const token = useMemo(() => {
    const sp = new URLSearchParams(window.location.search);
    return sp.get('token') ?? '';
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);

    if (!token) return setErr('Link inválido: token ausente.');
    if (!password || password.length < 8) return setErr('Defina uma senha com pelo menos 8 caracteres.');
    if (password !== confirm) return setErr('As senhas não conferem.');

    setSubmitting(true);
    try {
      await api('/auth/reset', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      });
      setMsg('Senha redefinida com sucesso! Redirecionando para o login…');
      setTimeout(() => {
        // volta para a tela de login
        window.location.replace('/');
      }, 1500);
    } catch (e: any) {
      setErr(e?.message || 'Não foi possível redefinir a senha.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Container fluid className="min-vh-100 d-flex align-items-center justify-content-center bg-light">
      <Row className="w-100" style={{ maxWidth: 420 }}>
        <Col>
          <Card className="shadow-lg">
            <Card.Body>
              <h4 className="mb-3 fw-bold text-center">Redefinir senha</h4>

              {msg && <Alert variant="success" className="py-2">{msg}</Alert>}
              {err && <Alert variant="danger" className="py-2">{err}</Alert>}
              {!token && <Alert variant="warning" className="py-2">Token ausente ou inválido.</Alert>}

              <Form onSubmit={handleSubmit}>
                <Form.Group className="mb-3">
                  <Form.Label>Nova senha</Form.Label>
                  <Form.Control
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo de 8 caracteres"
                    autoFocus
                    required
                  />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Confirmar nova senha</Form.Label>
                  <Form.Control
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                  />
                </Form.Group>
                <Button type="submit" className="w-100" disabled={submitting || !token}>
                  {submitting ? 'Enviando…' : 'Redefinir senha'}
                </Button>
              </Form>

              <Button
                variant="link"
                className="w-100 mt-3"
                onClick={() => window.location.replace('/')}
              >
                Voltar ao login
              </Button>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}

/* ================== LOGIN (+ Esqueci senha + Cadastro) ================== */
function Login({ onLogged }: { onLogged: (u: User, token: string) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Esqueci senha
  const [showForgot, setShowForgot] = useState(false);
  function theForgotInit() {} // evita reordenação do Modal em hot-reload
  theForgotInit();
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotOk, setForgotOk] = useState<string | null>(null);
  const [forgotErr, setForgotErr] = useState<string | null>(null);

  // Cadastro (aluno/professor)
  const [showRegister, setShowRegister] = useState(false);
  const [regNome, setRegNome] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regSenha, setRegSenha] = useState('');
  const [regSenha2, setRegSenha2] = useState('');
  const [regTipo, setRegTipo] = useState<'aluno' | 'professor'>('aluno'); // restrito
  const [regLoading, setRegLoading] = useState(false);
  const [regErr, setRegErr] = useState<string | null>(null);
  const [regOk, setRegOk] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const { token, user } = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      onLogged(user, token);
    } catch (e: any) {
      setErr(e.message || 'Falha no login');
    } finally {
      setLoading(false);
    }
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setForgotErr(null);
    setForgotOk(null);
    setForgotLoading(true);
    try {
      await api('/auth/forgot', { method: 'POST', body: JSON.stringify({ email: forgotEmail }) });
      setForgotOk('Se o e-mail existir, enviamos um link de redefinição.');
    } catch (e: any) {
      setForgotErr(e.message || 'Não foi possível enviar o e-mail de recuperação.');
    } finally {
      setForgotLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setRegErr(null);
    setRegOk(null);

    if (regSenha.length < 6) {
      setRegErr('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (regSenha !== regSenha2) {
      setRegErr('As senhas não conferem.');
      return;
    }

    setRegLoading(true);
    try {
      await api('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          nome: regNome.trim(),
          email: regEmail.trim(),
          password: regSenha,
          tipo: regTipo, // somente aluno/professor
        }),
      });
      setRegOk('Conta criada com sucesso! Você já pode fazer login.');
      setRegNome('');
      setRegEmail('');
      setRegSenha('');
      setRegSenha2('');
      setRegTipo('aluno');
    } catch (e: any) {
      setRegErr(e.message || 'Erro ao criar conta.');
    } finally {
      setRegLoading(false);
    }
  }

  return (
    <Container fluid className="min-vh-100 d-flex align-items-center justify-content-center bg-light">
      <Row className="w-100" style={{ maxWidth: 420 }}>
        <Col>
          <Card className="shadow-lg">
            <Card.Body>
              <h4 className="mb-4 fw-bold">Agendamento de Salas</h4>
              <Form onSubmit={handleSubmit}>
                <Form.Group className="mb-3">
                  <Form.Label>Email</Form.Label>
                  <Form.Control type="email" value={email} onChange={e => setEmail(e.target.value)} required />
                </Form.Group>
                <Form.Group className="mb-1">
                  <Form.Label>Senha</Form.Label>
                  <Form.Control type="password" value={password} onChange={e => setPassword(e.target.value)} required />
                </Form.Group>
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <Button variant="link" size="sm" className="px-0" onClick={() => setShowForgot(true)}>
                    Esqueci minha senha
                  </Button>
                  <Button variant="link" size="sm" className="px-0" onClick={() => setShowRegister(true)}>
                    Criar conta (aluno/professor)
                  </Button>
                </div>
                {err && <Alert variant="danger" className="py-2">{err}</Alert>}
                <Button type="submit" className="w-100" disabled={loading}>
                  {loading ? 'Entrando…' : 'Entrar'}
                </Button>
              </Form>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Modal Esqueci Senha */}
      <Modal show={showForgot} onHide={() => setShowForgot(false)} centered>
        <Form onSubmit={handleForgot}>
          <Modal.Header closeButton>
            <Modal.Title>Recuperar senha</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form.Group className="mb-2">
              <Form.Label>Email</Form.Label>
              <Form.Control
                type="email"
                value={forgotEmail}
                onChange={e => setForgotEmail(e.target.value)}
                placeholder="seuemail@exemplo.com"
                required
              />
            </Form.Group>
            {forgotOk && <Alert variant="success" className="py-2 mb-0">{forgotOk}</Alert>}
            {forgotErr && <Alert variant="danger" className="py-2 mb-0">{forgotErr}</Alert>}
            {!forgotOk && <div className="form-text">Você receberá um link para redefinir a senha.</div>}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowForgot(false)}>Fechar</Button>
            <Button type="submit" variant="primary" disabled={forgotLoading || !forgotEmail}>
              {forgotLoading ? 'Enviando…' : 'Enviar link'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Modal Cadastro (aluno/professor) */}
      <Modal show={showRegister} onHide={() => setShowRegister(false)} centered>
        <Form onSubmit={handleRegister}>
          <Modal.Header closeButton><Modal.Title>Criar conta</Modal.Title></Modal.Header>
          <Modal.Body>
            <Row className="g-2">
              <Col xs={12}>
                <Form.Group className="mb-2">
                  <Form.Label>Nome</Form.Label>
                  <Form.Control value={regNome} onChange={e => setRegNome(e.target.value)} required />
                </Form.Group>
              </Col>
              <Col xs={12}>
                <Form.Group className="mb-2">
                  <Form.Label>Email</Form.Label>
                  <Form.Control type="email" value={regEmail} onChange={e => setRegEmail(e.target.value)} required />
                </Form.Group>
              </Col>
              <Col xs={12} md={6}>
                <Form.Group className="mb-2">
                  <Form.Label>Senha</Form.Label>
                  <Form.Control type="password" value={regSenha} onChange={e => setRegSenha(e.target.value)} required />
                </Form.Group>
              </Col>
              <Col xs={12} md={6}>
                <Form.Group className="mb-2">
                  <Form.Label>Confirmar senha</Form.Label>
                  <Form.Control type="password" value={regSenha2} onChange={e => setRegSenha2(e.target.value)} required />
                </Form.Group>
              </Col>
              <Col xs={12}>
                <Form.Group className="mb-1">
                  <Form.Label>Tipo</Form.Label>
                  <Form.Select value={regTipo} onChange={e => setRegTipo(e.target.value as 'aluno' | 'professor')}>
                    <option value="aluno">Aluno</option>
                    <option value="professor">Professor</option>
                  </Form.Select>
                  <div className="form-text">Cadastro disponível apenas para Aluno/Professor.</div>
                </Form.Group>
              </Col>
            </Row>
            {regOk && <Alert variant="success" className="py-2 mt-2">{regOk}</Alert>}
            {regErr && <Alert variant="danger" className="py-2 mt-2">{regErr}</Alert>}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowRegister(false)}>Fechar</Button>
            <Button type="submit" variant="primary" disabled={regLoading}>
              {regLoading ? 'Salvando…' : 'Criar conta'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </Container>
  );
}

/* ================== USERS ================== */
function UsersPanel({ canManage }: { canManage: boolean }) {
  const [users, setUsers] = useState<User[]>([]);
  const [form, setForm] = useState<{ nome: string; email: string; password: string; tipo: Tipo }>({
    nome: '', email: '', password: '', tipo: 'aluno',
  });
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState<{ nome?: string; tipo?: Tipo; password?: string }>({});

  async function load() {
    try {
      const data = await api('/users');
      setUsers(data);
    } catch (e: any) { setErr(e.message); }
  }
  useEffect(() => { if (canManage) load(); }, [canManage]);

  async function createUser() {
    if (!canManage) return;
    setErr(null); setOk(null); setLoading(true);
    try {
      await api('/users', { method: 'POST', body: JSON.stringify(form) });
      setOk('Usuário criado com sucesso.');
      setForm({ nome: '', email: '', password: '', tipo: 'aluno' });
      await load();
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  }

  async function doDelete(id: number) {
    if (!canManage) return;
    const confirm = window.confirm('Excluir este usuário?');
    if (!confirm) return;
    await api(`/users/${id}`, { method: 'DELETE' });
    await load();
  }

  function openEdit(u: User) {
    setEditUser(u);
    setEditForm({ nome: u.nome, tipo: u.tipo });
  }

  async function saveEdit() {
    if (!editUser) return;
    await api(`/users/${editUser.id}`, { method: 'PUT', body: JSON.stringify(editForm) });
    setEditUser(null);
    setEditForm({});
    await load();
  }

  if (!canManage) return <Alert variant="secondary">Sem permissão para gerenciar usuários.</Alert>;

  return (
    <>
      <Card className="mb-4 shadow-sm">
        <Card.Header><strong>Novo usuário</strong></Card.Header>
        <Card.Body>
          <Row className="g-3">
            <Col md={6}>
              <Form.Group>
                <Form.Label>Nome</Form.Label>
                <Form.Control value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group>
                <Form.Label>Email</Form.Label>
                <Form.Control type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group>
                <Form.Label>Senha</Form.Label>
                <Form.Control type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group>
                <Form.Label>Tipo</Form.Label>
                <Form.Select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value as Tipo }))}>
                  <option value="aluno">Aluno</option>
                  <option value="professor">Professor</option>
                  <option value="coordenador">Coordenador</option>
                  <option value="admin">Admin</option>
                </Form.Select>
              </Form.Group>
            </Col>
          </Row>
          <div className="mt-3 d-flex gap-2">
            <Button onClick={createUser} disabled={loading}>Criar usuário</Button>
            {ok && <Badge bg="success" className="align-self-center">{ok}</Badge>}
            {err && <Badge bg="danger" className="align-self-center">{err}</Badge>}
          </div>
        </Card.Body>
      </Card>

      <Card className="shadow-sm">
        <Card.Header><strong>Usuários</strong></Card.Header>
        <Card.Body className="p-0">
          <Table hover responsive className="mb-0">
            <thead>
              <tr><th>#</th><th>Nome</th><th>Email</th><th>Tipo</th><th style={{ width: 220 }}></th></tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td>{u.id}</td>
                  <td>{u.nome}</td>
                  <td>{u.email}</td>
                  <td><Badge bg={u.tipo === 'admin' ? 'dark' : u.tipo === 'coordenador' ? 'primary' : 'secondary'}>{u.tipo}</Badge></td>
                  <td className="text-end" style={{ minWidth: 220 }}>
                    <div className="d-flex justify-content-end align-items-center gap-2 flex-nowrap">
                      <Button size="sm" variant="outline-primary" onClick={() => openEdit(u)}>
                        <i className="bi bi-pencil me-1"></i>Editar
                      </Button>
                      <Button size="sm" variant="outline-danger" onClick={() => doDelete(u.id)} title="Excluir">
                        <i className="bi bi-trash"></i>
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && <tr><td colSpan={5} className="text-center text-muted py-4">Nenhum usuário</td></tr>}
            </tbody>
          </Table>
        </Card.Body>
      </Card>

      <Modal show={!!editUser} onHide={() => setEditUser(null)}>
        <Modal.Header closeButton><Modal.Title>Editar usuário</Modal.Title></Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Nome</Form.Label>
              <Form.Control value={editForm.nome || ''} onChange={e => setEditForm(f => ({ ...f, nome: e.target.value }))} />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Tipo</Form.Label>
              <Form.Select value={editForm.tipo || 'aluno'} onChange={e => setEditForm(f => ({ ...f, tipo: e.target.value as Tipo }))}>
                <option value="aluno">Aluno</option>
                <option value="professor">Professor</option>
                <option value="coordenador">Coordenador</option>
                <option value="admin">Admin</option>
              </Form.Select>
              <div className="form-text">Para trocar a senha, preencha abaixo (opcional).</div>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Nova senha (opcional)</Form.Label>
              <Form.Control type="password" value={editForm.password || ''} onChange={e => setEditForm(f => ({ ...f, password: e.target.value }))} />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setEditUser(null)}>Cancelar</Button>
          <Button variant="primary" onClick={saveEdit}>Salvar</Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}

/* ================== BOOKINGS (cancelamento só ADMIN + DatePicker com regras) ================== */
function BookingPanel({ me, canManage }: { me: User; canManage: boolean }) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selRoom, setSelRoom] = useState<number | ''>('');
  const [inicio, setInicio] = useState<string>('');
  const [inicioDt, setInicioDt] = useState<Date | null>(null);
  const [fim, setFim] = useState<string>('');
  const [fimDt, setFimDt] = useState<Date | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [forUser, setForUser] = useState<number | ''>('');

  // Modal de confirmação de cancelamento
  const [confirm, setConfirm] = useState<{ show: boolean; id?: string; title?: string; start?: Date | null; end?: Date | null }>({ show: false });

  // Constantes de horário de funcionamento
  const BUSINESS_START = 8;
  const BUSINESS_END = 22;
  const INTERVAL = 15;

  // Helpers
  const startOfToday = () => { const t = new Date(); t.setHours(0, 0, 0, 0); return t; };
  const isSameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const roundUp = (d: Date, minutes: number) => {
    const r = new Date(d); r.setSeconds(0, 0);
    const m = r.getMinutes(); const add = (minutes - (m % minutes)) % minutes;
    r.setMinutes(m + add); return r;
  };
  const withTime = (d: Date, h: number, m = 0) => { const x = new Date(d); x.setHours(h, m, 0, 0); return x; };

  // DatePicker INÍCIO
  const getMinTimeForStart = (date: Date | null) => {
    const base = date ?? new Date();
    const now = new Date();
    const businessStart = withTime(base, BUSINESS_START, 0);
    if (isSameDay(base, now)) {
      const n = roundUp(now, INTERVAL);
      return n > businessStart ? n : businessStart;
    }
    return businessStart;
  };
  const getMaxTime = (date: Date | null) => withTime(date ?? new Date(), BUSINESS_END, 0);

  // DatePicker FIM
  const getMinTimeForEnd = (date: Date | null) => {
    const base = date ?? new Date();
    const now = new Date();
    const fromBusiness = getMinTimeForStart(base);
    let candidate = fromBusiness;
    if (inicioDt && isSameDay(base, inicioDt)) {
      const afterStart = addMinutes(inicioDt, INTERVAL);
      if (afterStart > candidate) candidate = afterStart;
    }
    if (isSameDay(base, now)) {
      const n = roundUp(now, INTERVAL);
      if (n > candidate) candidate = n;
    }
    return candidate;
  };

  const toLocalInput = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const mi = pad(d.getMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
  };

  function updateInicio(d: Date | null) {
    if (!d) { setInicio(''); setInicioDt(null); return; }
    const fixed = roundUp(new Date(d), INTERVAL);
    const min = getMinTimeForStart(fixed);
    const max = getMaxTime(fixed);
    if (fixed < min) fixed.setTime(min.getTime());
    if (fixed > max) fixed.setTime(max.getTime());
    setInicio(toLocalInput(fixed));
    setInicioDt(fixed);

    if (!fimDt || fixed >= fimDt) {
      let nf = addMinutes(fixed, 60);
      const maxEnd = getMaxTime(fixed);
      if (nf > maxEnd) nf = maxEnd;
      setFim(toLocalInput(nf));
      setFimDt(nf);
    }
  }

  function updateFim(d: Date | null) {
    if (!d) { setFim(''); setFimDt(null); return; }
    const fixed = roundUp(new Date(d), INTERVAL);
    const min = getMinTimeForEnd(fixed);
    const max = getMaxTime(fixed);
    if (fixed < min) fixed.setTime(min.getTime());
    if (fixed > max) fixed.setTime(max.getTime());
    setFim(toLocalInput(fixed));
    setFimDt(fixed);
  }

  async function load() {
    const [r, b] = await Promise.all([api('/rooms'), api('/bookings')]);
    setRooms(r); setBookings(b);
    if (canManage) {
      try { setUsers(await api('/users')); } catch { }
    }
  }
  useEffect(() => { load(); }, []);

  async function createBooking() {
    setErr(null); setOk(null);
    try {
      if (!inicioDt || !fimDt) throw new Error('Informe início e fim.');
      const now = new Date();
      if (inicioDt < now) throw new Error('O início não pode estar no passado.');
      if (inicioDt >= fimDt) throw new Error('O fim deve ser após o início.');
      const startHour = inicioDt.getHours();
      const endHour = fimDt.getHours() + (fimDt.getMinutes() > 0 ? 1 : 0);
      if (startHour < BUSINESS_START || endHour > BUSINESS_END)
        throw new Error(`Agendamentos permitidos somente entre ${String(BUSINESS_START).padStart(2, '0')}:00 e ${String(BUSINESS_END).padStart(2, '0')}:00.`);

      const body: any = { id_sala: Number(selRoom), inicio, fim };
      if (canManage && forUser !== '') body.id_usuario = Number(forUser);
      await api('/bookings', { method: 'POST', body: JSON.stringify(body) });
      setOk('Agendamento criado.');
      setSelRoom(''); setInicio(''); setFim(''); setForUser('');
      setInicioDt(null); setFimDt(null);
      await load();
    } catch (e: any) { setErr(e.message); }
  }

  const events = useMemo(() => bookings.map(b => ({
    id: String(b.id_registro),
    title: `${b.sala.nome_sala} — ${b.usuario.nome}`,
    start: b.inicio,
    end: b.fim,
    extendedProps: { userId: b.usuario.id_usuario }
  })), [bookings]);

  const canCancelBookings = me.tipo === 'admin';

  const handleEventClick = (clickInfo: EventClickArg) => {
    if (!canCancelBookings) {
      toast.error('Somente o administrador pode cancelar reservas.');
      return;
    }
    setConfirm({
      show: true,
      id: clickInfo.event.id,
      title: clickInfo.event.title,
      start: clickInfo.event.start,
      end: clickInfo.event.end
    });
  };

  async function confirmDelete() {
    if (!confirm.id) return;
    try {
      await api(`/bookings/${confirm.id}`, { method: 'DELETE' });
      toast.success('Reserva cancelada com sucesso.');
      setBookings(prev => prev.filter(b => String(b.id_registro) !== String(confirm.id)));
    } catch (e) {
      console.error(e);
      toast.error('Erro ao cancelar a reserva.');
    } finally {
      setConfirm({ show: false });
    }
  }

  const colPropsCommon = canManage
    ? { xs: 12, md: 6, lg: 3 }
    : { xs: 12, md: 4, lg: 4 };

  const fmt = (d?: Date | null) => d ? format(d, "dd/MM 'às' HH:mm", { locale: dfptBR }) : '';

  return (
    <>
      <Card className="mb-4 shadow-sm">
        <Card.Header className="d-flex align-items-center justify-content-between">
          <strong>Nova reserva</strong>
          <small className="text-muted">Selecione sala, datas e confirme</small>
        </Card.Header>

        <Card.Body>
          <Row className="g-3 align-items-start">
            <Col {...colPropsCommon}>
              <Form.Group className="mb-0">
                <Form.Label>Sala</Form.Label>
                <Form.Select
                  value={selRoom}
                  onChange={e => setSelRoom(e.target.value === '' ? '' : Number(e.target.value))}
                >
                  <option value="">Selecione…</option>
                  {rooms.map(r => <option key={r.id_sala} value={r.id_sala}>{r.nome_sala} (cap. {r.capacidade})</option>)}
                </Form.Select>
              </Form.Group>
            </Col>

            {canManage && (
              <Col {...colPropsCommon}>
                <Form.Group className="mb-0">
                  <Form.Label>Agendar para</Form.Label>
                  <Form.Select
                    value={forUser}
                    onChange={e => setForUser(e.target.value === '' ? '' : Number(e.target.value))}
                  >
                    <option value="">Selecione um usuário…</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.nome} ({u.tipo})</option>)}
                  </Form.Select>
                </Form.Group>
              </Col>
            )}

            <Col {...colPropsCommon}>
              <Form.Group className="mb-0">
                <Form.Label>Início</Form.Label>
                <div className="vstack gap-2">
                  <ReactDatePicker
                    selected={inicioDt}
                    onChange={(d) => updateInicio(d as Date)}
                    showTimeSelect
                    timeIntervals={INTERVAL}
                    timeCaption="Hora"
                    dateFormat="Pp"
                    className="form-control"
                    locale={dfptBR}
                    placeholderText="Escolha data e hora..."
                    minDate={startOfToday()}
                    minTime={getMinTimeForStart(inicioDt ?? new Date())}
                    maxTime={getMaxTime(inicioDt ?? new Date())}
                  />
                  <div className="d-flex flex-wrap gap-2">
                    <Button size="sm" variant="outline-secondary" onClick={() => updateInicio(new Date())}>Agora</Button>
                    <Button size="sm" variant="outline-secondary" onClick={() => updateInicio(addMinutes(new Date(), 30))}>+30 min</Button>
                    <Button size="sm" variant="outline-secondary" onClick={() => { const d = new Date(); d.setMinutes(0, 0, 0); d.setHours(d.getHours() + 1); updateInicio(d); }}>Próx hora</Button>
                  </div>
                </div>
              </Form.Group>
            </Col>

            <Col {...colPropsCommon}>
              <Form.Group className="mb-0">
                <Form.Label>Fim</Form.Label>
                <div className="vstack gap-2">
                  <ReactDatePicker
                    selected={fimDt}
                    onChange={(d) => updateFim(d as Date)}
                    showTimeSelect
                    timeIntervals={INTERVAL}
                    timeCaption="Hora"
                    dateFormat="Pp"
                    className="form-control"
                    locale={dfptBR}
                    placeholderText="Escolha data e hora..."
                    minDate={startOfToday()}
                    minTime={getMinTimeForEnd(fimDt ?? new Date())}
                    maxTime={getMaxTime(fimDt ?? new Date())}
                  />
                  <div className="d-flex flex-wrap gap-2">
                    <Button size="sm" variant="outline-secondary" onClick={() => { if (!inicioDt) { updateFim(addMinutes(new Date(), 60)); } else { updateFim(addMinutes(inicioDt, 60)); } }}>+1h a partir do início</Button>
                    <Button size="sm" variant="outline-secondary" onClick={() => { if (!inicioDt) { updateFim(addMinutes(new Date(), 120)); } else { updateFim(addMinutes(inicioDt, 120)); } }}>+2h a partir do início</Button>
                  </div>
                </div>
              </Form.Group>
            </Col>
          </Row>

          <Row className="g-2 mt-3">
            <Col xs={12}>
              <Button
                variant="primary"
                onClick={createBooking}
                disabled={!selRoom || !inicio || !fim || (canManage && !forUser)}
              >
                Agendar
              </Button>
              <div className="mt-2 d-flex gap-2">
                {ok && <Badge bg="success">{ok}</Badge>}
                {err && <Badge bg="danger">{err}</Badge>}
              </div>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      <Card className="shadow-sm">
        <Card.Header className="d-flex align-items-center justify-content-between">
          <strong>Agenda</strong><small className="text-muted">Visualize e cancele reservas</small>
        </Card.Header>
        <Card.Body>
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, bootstrap5Plugin]}
            locales={[ptBrLocale]} themeSystem="bootstrap5"
            locale="pt-br"
            initialView="timeGridWeek"
            firstDay={1}
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: 'dayGridMonth,timeGridWeek,timeGridDay',
            }}
            height="auto"
            expandRows
            nowIndicator
            allDaySlot={false}
            slotMinTime="08:00:00"
            slotMaxTime="22:00:00"
            slotDuration="00:30:00"
            slotLabelInterval="01:00"
            eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
            events={events}
            eventClick={handleEventClick}
          />
        </Card.Body>
      </Card>

      {/* Modal de confirmação */}
      <Modal show={confirm.show} onHide={() => setConfirm({ show: false })} centered>
        <Modal.Header closeButton>
          <Modal.Title>Cancelar reserva</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>Tem certeza que deseja cancelar esta reserva?</p>
          {confirm.title && (
            <div className="small text-muted">
              <div><strong>{confirm.title}</strong></div>
              <div>{fmt(confirm.start)} — {fmt(confirm.end)}</div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setConfirm({ show: false })}>Voltar</Button>
          <Button variant="danger" onClick={confirmDelete}>
            <i className="bi bi-trash me-1"></i> Cancelar reserva
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}

/* ================== ROOMS (coord cria/edita; admin exclui) ================== */
function RoomsPanel({ canCreateEdit, canDelete }: { canCreateEdit: boolean; canDelete: boolean }) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [novo, setNovo] = useState<{ nome_sala: string; capacidade: number }>({ nome_sala: '', capacidade: 10 });
  const [edit, setEdit] = useState<Room | null>(null);

  async function load() { setRooms(await api('/rooms')); }
  useEffect(() => { load(); }, []);

  async function addRoom() {
    if (!canCreateEdit) return;
    await api('/rooms', { method: 'POST', body: JSON.stringify(novo) });
    setNovo({ nome_sala: '', capacidade: 10 });
    await load();
  }
  async function saveRoom(r: Room) {
    if (!canCreateEdit) return;
    await api(`/rooms/${r.id_sala}`, { method: 'PUT', body: JSON.stringify({ nome_sala: r.nome_sala, capacidade: r.capacidade }) });
    setEdit(null);
    await load();
  }
  async function deleteRoom(id: number) {
    if (!canDelete) return;
    const ok = window.confirm('Excluir esta sala?'); if (!ok) return;
    await api(`/rooms/${id}`, { method: 'DELETE' });
    await load();
  }

  return (
    <>
      <Card className="mb-4 shadow-sm">
        <Card.Header><strong>Nova sala</strong></Card.Header>
        <Card.Body>
          <Row className="g-3">
            <Col md={6}>
              <Form.Group>
                <Form.Label>Nome da sala</Form.Label>
                <Form.Control value={novo.nome_sala} onChange={e => setNovo(v => ({ ...v, nome_sala: e.target.value }))} disabled={!canCreateEdit} />
              </Form.Group>
            </Col>
            <Col md={3}>
              <Form.Group>
                <Form.Label>Capacidade</Form.Label>
                <Form.Control type="number" min={1} value={novo.capacidade}
                  onChange={e => setNovo(v => ({ ...v, capacidade: Number(e.target.value) }))} disabled={!canCreateEdit} />
              </Form.Group>
            </Col>
            <Col md={3} className="d-flex align-items-end">
              <Button onClick={addRoom} disabled={!canCreateEdit}>Adicionar</Button>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      <Card className="shadow-sm">
        <Card.Header><strong>Salas</strong></Card.Header>
        <Card.Body className="p-0">
          <Table hover responsive className="mb-0">
            <thead><tr><th>#</th><th>Nome</th><th>Capacidade</th><th style={{ width: 220 }}></th></tr></thead>
            <tbody>
              {rooms.map(r => (
                <tr key={r.id_sala}>
                  <td>{r.id_sala}</td>
                  <td>
                    {edit?.id_sala === r.id_sala
                      ? <Form.Control value={edit.nome_sala} onChange={e => setEdit({ ...edit!, nome_sala: e.target.value })} disabled={!canCreateEdit} />
                      : r.nome_sala}
                  </td>
                  <td>
                    {edit?.id_sala === r.id_sala
                      ? <Form.Control type="number" value={edit.capacidade} onChange={e => setEdit({ ...edit!, capacidade: Number(e.target.value) })} disabled={!canCreateEdit} />
                      : r.capacidade}
                  </td>
                  <td className="text-end" style={{ minWidth: 220 }}>
                    <div className="d-flex justify-content-end align-items-center gap-2 flex-nowrap">
                      {edit?.id_sala === r.id_sala ? (
                        <>
                          <Button size="sm" variant="success" onClick={() => saveRoom(edit!)} title="Salvar" disabled={!canCreateEdit}>
                            <i className="bi bi-check2"></i>
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => setEdit(null)} title="Cancelar">
                            <i className="bi bi-x-lg"></i>
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button size="sm" variant="outline-primary" onClick={() => setEdit(r)} disabled={!canCreateEdit}>
                            <i className="bi bi-pencil me-1"></i>Editar
                          </Button>
                          {canDelete && (
                            <Button size="sm" variant="outline-danger" onClick={() => deleteRoom(r.id_sala)} title="Excluir">
                              <i className="bi bi-trash"></i>
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {rooms.length === 0 && <tr><td colSpan={4} className="text-center text-muted py-4">Nenhuma sala</td></tr>}
            </tbody>
          </Table>
        </Card.Body>
      </Card>
    </>
  );
}

/* ================== DASHBOARD (RBAC) ================== */
function Dashboard({ user, onLogout }: { user: User, onLogout: () => void }) {
  const [tab, setTab] = useState<'reservas' | 'salas' | 'usuarios'>('reservas');

  // Visibilidade
  const showRoomsTab = user.tipo === 'admin' || user.tipo === 'coordenador';
  const showUsersTab = user.tipo === 'admin';

  // Permissões
  const canCreateEditRooms = user.tipo === 'admin' || user.tipo === 'coordenador';
  const canDeleteRooms = user.tipo === 'admin';
  const canManageUsers = user.tipo === 'admin';

  // Trocar senha (modal)
  const [showChangePwd, setShowChangePwd] = useState(false);
  const [cpCurrent, setCpCurrent] = useState('');
  const [cpNext, setCpNext] = useState('');
  const [cpNext2, setCpNext2] = useState('');
  const [cpLoading, setCpLoading] = useState(false);
  const [cpErr, setCpErr] = useState<string | null>(null);
  const [cpOk, setCpOk] = useState<string | null>(null);

  async function submitChangePwd(e: React.FormEvent) {
    e.preventDefault();
    setCpErr(null); setCpOk(null);
    if (cpNext !== cpNext2) {
      setCpErr('As senhas novas não conferem.');
      return;
    }
    try {
      setCpLoading(true);
      await api('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ current: cpCurrent, next: cpNext })
      });
      setCpOk('Senha atualizada com sucesso.');
      setCpCurrent(''); setCpNext(''); setCpNext2('');
    } catch (e: any) {
      setCpErr(e.message || 'Não foi possível trocar a senha.');
    } finally {
      setCpLoading(false);
    }
  }

  return (
    <>
      <Navbar bg="dark" variant="dark" expand="lg" className="mb-4 shadow-sm">
        <Container>
          <Navbar.Brand>Agendamento de Salas</Navbar.Brand>
          <Navbar.Toggle />
          <Navbar.Collapse>
            <Nav className="me-auto">
              <Nav.Link active={tab === 'reservas'} onClick={() => setTab('reservas')}>Reservas</Nav.Link>
              {showRoomsTab && <Nav.Link active={tab === 'salas'} onClick={() => setTab('salas')}>Salas</Nav.Link>}
              {showUsersTab && <Nav.Link active={tab === 'usuarios'} onClick={() => setTab('usuarios')}>Usuários</Nav.Link>}
            </Nav>
            <span className="text-secondary me-3">{user.nome} · {user.email}</span>
            <div className="d-flex gap-2">
              <Button size="sm" variant="outline-light" onClick={() => setShowChangePwd(true)}>
                <i className="bi bi-key me-1"></i> Trocar senha
              </Button>
              <Button size="sm" variant="outline-warning" onClick={onLogout}><i className="bi bi-box-arrow-right"></i> Sair</Button>
            </div>
          </Navbar.Collapse>
        </Container>
      </Navbar>

      <Container className="pb-5">
        {tab === 'reservas' && <BookingPanel me={user} canManage={canCreateEditRooms || canManageUsers} />}
        {tab === 'salas' && showRoomsTab && <RoomsPanel canCreateEdit={canCreateEditRooms} canDelete={canDeleteRooms} />}
        {tab === 'usuarios' && showUsersTab && <UsersPanel canManage={canManageUsers} />}
      </Container>

      {/* Modal Trocar senha */}
      <Modal show={showChangePwd} onHide={() => setShowChangePwd(false)} centered>
        <Form onSubmit={submitChangePwd}>
          <Modal.Header closeButton><Modal.Title>Trocar senha</Modal.Title></Modal.Header>
          <Modal.Body>
            <Form.Group className="mb-2">
              <Form.Label>Senha atual</Form.Label>
              <Form.Control type="password" value={cpCurrent} onChange={e => setCpCurrent(e.target.value)} required />
            </Form.Group>
            <Row className="g-2">
              <Col md={6}>
                <Form.Group className="mb-2">
                  <Form.Label>Nova senha</Form.Label>
                  <Form.Control type="password" value={cpNext} onChange={e => setCpNext(e.target.value)} required />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-2">
                  <Form.Label>Confirmar nova senha</Form.Label>
                  <Form.Control type="password" value={cpNext2} onChange={e => setCpNext2(e.target.value)} required />
                </Form.Group>
              </Col>
            </Row>
            {cpOk && <Alert variant="success" className="py-2 mt-2">{cpOk}</Alert>}
            {cpErr && <Alert variant="danger" className="py-2 mt-2">{cpErr}</Alert>}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowChangePwd(false)}>Fechar</Button>
            <Button type="submit" variant="primary" disabled={cpLoading}>
              {cpLoading ? 'Salvando…' : 'Salvar'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </>
  );
}

/* ================== APP ROOT ================== */
export default function App() {
  const { user, login, logout } = useAuth();

  // Detecta a rota de reset sem precisar de React Router
  const isResetRoute = typeof window !== 'undefined'
    && window.location.pathname.replace(/\/+$/, '') === '/reset-password';

  return (
    <ErrorBoundary>
      {isResetRoute
        ? <ResetPassword />
        : (user ? <Dashboard user={user} onLogout={logout} /> : <Login onLogged={login} />)}
      <ToastContainer position="bottom-right" />
    </ErrorBoundary>
  );
}
