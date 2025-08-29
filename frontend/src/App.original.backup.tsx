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
import { addMinutes } from 'date-fns';
import { ptBR as dfptBR } from 'date-fns/locale';
import 'bootstrap-icons/font/bootstrap-icons.css';
import { ErrorBoundary } from './ErrorBoundary';

type Tipo = 'aluno'|'professor'|'coordenador'|'admin';
type User = { id: number; email: string; nome: string; tipo: Tipo };
type Room = { id_sala: number; nome_sala: string; capacidade: number };
type Booking = {
  id_registro: number;
  id_sala: number;
  id_usuario: number;
  inicio: string;
  fim: string;
  sala: Room;
  usuario: { id_usuario:number; nome:string; tipo:string };
};

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

function Login({ onLogged }: { onLogged: (u: User, token: string)=>void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setLoading(true);
    try {
      const { token, user } = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      onLogged(user, token);
    } catch (e:any) {
      setErr(e.message || 'Falha no login');
    } finally { setLoading(false); }
  }

  return (
    <Container fluid className="min-vh-100 d-flex align-items-center justify-content-center bg-light">
      <Row className="w-100" style={{maxWidth: 420}}>
        <Col>
          <Card className="shadow-lg">
            <Card.Body>
              <h4 className="mb-4 fw-bold">Agendamento de Salas</h4>
              <Form onSubmit={handleSubmit}>
                <Form.Group className="mb-3">
                  <Form.Label>Email</Form.Label>
                  <Form.Control type="email" value={email} onChange={e=>setEmail(e.target.value)} required />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Senha</Form.Label>
                  <Form.Control type="password" value={password} onChange={e=>setPassword(e.target.value)} required />
                </Form.Group>
                {err && <Alert variant="danger" className="py-2">{err}</Alert>}
                <Button type="submit" className="w-100" disabled={loading}>
                  {loading ? 'Entrando…' : 'Entrar'}
                </Button>
              </Form>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}

function UsersPanel({ canManage }: { canManage: boolean }) {
  const [users, setUsers] = useState<User[]>([]);
  const [form, setForm] = useState<{nome:string; email:string; password:string; tipo:Tipo; matricula?:string; disciplina?:string}>({
    nome:'', email:'', password:'', tipo:'aluno', matricula:'', disciplina:''
  });
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState<{nome?:string; tipo?:Tipo; password?:string; matricula?:string; disciplina?:string}>({});

  async function load() {
    try {
      const data = await api('/users');
      setUsers(data);
    } catch (e:any) { setErr(e.message); }
  }
  useEffect(() => { if (canManage) load(); }, [canManage]);

  async function createUser() {
    if (!canManage) return;
    setErr(null); setOk(null); setLoading(true);
    try {
      const body:any = { ...form };
      if (form.tipo !== 'aluno') delete body.matricula;
      if (form.tipo !== 'professor') delete body.disciplina;
      await api('/users', { method:'POST', body: JSON.stringify(body) });
      setOk('Usuário criado com sucesso.');
      setForm({nome:'',email:'',password:'',tipo:'aluno', matricula:'', disciplina:''});
      await load();
    } catch (e:any) { setErr(e.message); }
    finally { setLoading(false); }
  }

  async function doDelete(id:number) {
    if (!canManage) return;
    const confirm = window.confirm('Excluir este usuário?');
    if (!confirm) return;
    await api(`/users/${id}`, { method:'DELETE' });
    await load();
  }

  function openEdit(u:User) {
    setEditUser(u);
    setEditForm({ nome: u.nome, tipo: u.tipo });
  }

  async function saveEdit() {
    if (!editUser) return;
    const body:any = { ...editForm };
    await api(`/users/${editUser.id}`, { method: 'PUT', body: JSON.stringify(body) });
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
                <Form.Control value={form.nome} onChange={e=>setForm(f=>({...f, nome:e.target.value}))} />
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group>
                <Form.Label>Email</Form.Label>
                <Form.Control type="email" value={form.email} onChange={e=>setForm(f=>({...f, email:e.target.value}))} />
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group>
                <Form.Label>Senha</Form.Label>
                <Form.Control type="password" value={form.password} onChange={e=>setForm(f=>({...f, password:e.target.value}))} />
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group>
                <Form.Label>Tipo</Form.Label>
                <Form.Select value={form.tipo} onChange={e=>setForm(f=>({...f, tipo:e.target.value as Tipo}))}>
                  <option value="aluno">Aluno</option>
                  <option value="professor">Professor</option>
                  <option value="coordenador">Coordenador</option>
                  <option value="admin">Admin</option>
                </Form.Select>
              </Form.Group>
            </Col>
            {form.tipo==='aluno' && (
              <Col md={4}>
                <Form.Group>
                  <Form.Label>Matrícula (opcional)</Form.Label>
                  <Form.Control value={form.matricula} onChange={e=>setForm(f=>({...f, matricula:e.target.value}))} />
                </Form.Group>
              </Col>
            )}
            {form.tipo==='professor' && (
              <Col md={4}>
                <Form.Group>
                  <Form.Label>Disciplina (opcional)</Form.Label>
                  <Form.Control value={form.disciplina} onChange={e=>setForm(f=>({...f, disciplina:e.target.value}))} />
                </Form.Group>
              </Col>
            )}
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
              <tr><th>#</th><th>Nome</th><th>Email</th><th>Tipo</th><th style={{width: 200}}></th></tr>
            </thead>
            <tbody>
              {users.map(u=>(
                <tr key={u.id}>
                  <td>{u.id}</td>
                  <td>{u.nome}</td>
                  <td>{u.email}</td>
                  <td><Badge bg={u.tipo==='admin'?'dark':u.tipo==='coordenador'?'primary':'secondary'}>{u.tipo}</Badge></td>
                  <td className="text-end">
                    <Button size="sm" variant="outline-primary" className="me-2" onClick={()=>openEdit(u)}>
                      <i className="bi bi-pencil"></i> Editar
                    </Button>
                    <Button size="sm" variant="outline-danger" onClick={()=>doDelete(u.id)}>
                      <i className="bi bi-trash"></i> Excluir
                    </Button>
                  </td>
                </tr>
              ))}
              {users.length===0 && <tr><td colSpan={5} className="text-center text-muted py-4">Nenhum usuário</td></tr>}
            </tbody>
          </Table>
        </Card.Body>
      </Card>

      <Modal show={!!editUser} onHide={()=>setEditUser(null)}>
        <Modal.Header closeButton><Modal.Title>Editar usuário</Modal.Title></Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Nome</Form.Label>
              <Form.Control value={editForm.nome || ''} onChange={e=>setEditForm(f=>({...f, nome:e.target.value}))} />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Tipo</Form.Label>
              <Form.Select value={editForm.tipo || 'aluno'} onChange={e=>setEditForm(f=>({...f, tipo: e.target.value as Tipo}))}>
                <option value="aluno">Aluno</option>
                <option value="professor">Professor</option>
                <option value="coordenador">Coordenador</option>
                <option value="admin">Admin</option>
              </Form.Select>
              <div className="form-text">Para trocar a senha, preencha abaixo (opcional).</div>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Nova senha (opcional)</Form.Label>
              <Form.Control type="password" value={editForm.password || ''} onChange={e=>setEditForm(f=>({...f, password:e.target.value}))} />
            </Form.Group>
            {editForm.tipo==='aluno' && (
              <Form.Group className="mb-3">
                <Form.Label>Matrícula (opcional)</Form.Label>
                <Form.Control value={editForm.matricula || ''} onChange={e=>setEditForm(f=>({...f, matricula:e.target.value}))} />
              </Form.Group>
            )}
            {editForm.tipo==='professor' && (
              <Form.Group className="mb-3">
                <Form.Label>Disciplina (opcional)</Form.Label>
                <Form.Control value={editForm.disciplina || ''} onChange={e=>setEditForm(f=>({...f, disciplina:e.target.value}))} />
              </Form.Group>
            )}
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={()=>setEditUser(null)}>Cancelar</Button>
          <Button variant="primary" onClick={saveEdit}>Salvar</Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}

function BookingPanel({ me, canManage }: { me: User; canManage: boolean }) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selRoom, setSelRoom] = useState<number | ''>('');
  const [inicio, setInicio] = useState<string>('');      // ISO-local string para POST
  const [inicioDt, setInicioDt] = useState<Date | null>(null); // Date para DatePicker
  const [fim, setFim] = useState<string>('');
  const [fimDt, setFimDt] = useState<Date | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [forUser, setForUser] = useState<number | ''>('');

  // === CORREÇÃO: funções que faltavam (mantêm estado string + Date sincronizados)
  const toLocalInput = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth()+1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const mi = pad(d.getMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
  };
  function updateInicio(d: Date | null) {
    if (!d) { setInicio(''); setInicioDt(null); return; }
    const fixed = new Date(d); fixed.setSeconds(0,0);
    setInicio(toLocalInput(fixed));
    setInicioDt(fixed);
    // se fim é antes de início, ajusta fim para +1h
    if (!fimDt || fixed >= fimDt) {
      const nf = addMinutes(fixed, 60);
      setFim(toLocalInput(nf));
      setFimDt(nf);
    }
  }
  function updateFim(d: Date | null) {
    if (!d) { setFim(''); setFimDt(null); return; }
    const fixed = new Date(d); fixed.setSeconds(0,0);
    // garante fim > inicio
    if (inicioDt && fixed <= inicioDt) {
      const nf = addMinutes(inicioDt, 30);
      setFim(toLocalInput(nf));
      setFimDt(nf);
      return;
    }
    setFim(toLocalInput(fixed));
    setFimDt(fixed);
  }

  async function load() {
    const [r, b] = await Promise.all([api('/rooms'), api('/bookings')]);
    setRooms(r); setBookings(b);
    if (canManage) {
      try { setUsers(await api('/users')); } catch {}
    }
  }
  useEffect(() => { load(); }, []);

  async function createBooking() {
    setErr(null); setOk(null);
    try {
      const body: any = { id_sala: Number(selRoom), inicio, fim };
      if (canManage && forUser !== '') body.id_usuario = Number(forUser);
      await api('/bookings', { method:'POST', body: JSON.stringify(body) });
      setOk('Agendamento criado.');
      setSelRoom(''); setInicio(''); setFim(''); setForUser('');
      setInicioDt(null); setFimDt(null);
      await load();
    } catch (e:any) { setErr(e.message); }
  }

  const events = useMemo(() => bookings.map(b => ({
    id: String(b.id_registro),
    title: `${b.sala.nome_sala} — ${b.usuario.nome}`,
    start: b.inicio,
    end: b.fim,
    extendedProps: { userId: b.usuario.id_usuario }
  })), [bookings]);

  const handleEventClick = async (clickInfo: EventClickArg) => {
    const bookingId = clickInfo.event.id;
    const ownerId = (clickInfo.event.extendedProps as any)?.userId;
    const isOwner = String(me.id) === String(ownerId);
    const canCancel = me.tipo === 'admin' || isOwner;
    if (!canCancel) { toast.error('Sem permissão para cancelar este agendamento.'); return; }
    if (!window.confirm('Deseja cancelar esta reserva?')) return;
    try {
      await api(`/bookings/${bookingId}`, { method: 'DELETE' });
      toast.success('Reserva cancelada com sucesso.');
      setBookings(prev => prev.filter(b => String(b.id_registro) !== String(bookingId)));
    } catch (e) {
      console.error(e);
      toast.error('Erro ao cancelar a reserva.');
    }
  };

  return (
    <>
      <Card className="mb-4 shadow-sm">
        <Card.Header className="d-flex align-items-center justify-content-between">
          <strong>Nova reserva</strong>
          <small className="text-muted">Selecione sala, datas e confirme</small>
        </Card.Header>
        <Card.Body>
          <Row className="g-3 align-items-end">
            <Col md={canManage ? 3 : 4}>
              <Form.Group>
                <Form.Label>Sala</Form.Label>
                <Form.Select
                  value={selRoom}
                  onChange={e => {
                    const v = e.target.value;
                    setSelRoom(v === '' ? '' : Number(v));
                  }}
                >
                  <option value="">Selecione…</option>
                  {rooms.map(r=> <option key={r.id_sala} value={r.id_sala}>{r.nome_sala} (cap. {r.capacidade})</option>)}
                </Form.Select>
              </Form.Group>
            </Col>

            {canManage && (
              <Col md={3}>
                <Form.Group>
                  <Form.Label>Agendar para</Form.Label>
                  <Form.Select
                    value={forUser}
                    onChange={e => {
                      const v = e.target.value;
                      setForUser(v === '' ? '' : Number(v));
                    }}
                  >
                    <option value="">Selecione um usuário…</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.nome} ({u.tipo})</option>)}
                  </Form.Select>
                </Form.Group>
              </Col>
            )}

            <Col md={3}>
              <Form.Group>
                <Form.Label>Início</Form.Label>
                <div className="d-grid gap-2">
                  <ReactDatePicker
                    selected={inicioDt}
                    onChange={(d)=> updateInicio(d as Date)}
                    showTimeSelect
                    timeIntervals={15}
                    timeCaption="Hora"
                    dateFormat="Pp"
                    className="form-control"
                    locale={dfptBR}
                    placeholderText="Escolha data e hora..."
                  />
                  <div className="d-flex flex-wrap gap-2">
                    <Button size="sm" variant="outline-secondary" onClick={()=>updateInicio(new Date())}>Agora</Button>
                    <Button size="sm" variant="outline-secondary" onClick={()=>updateInicio(addMinutes(new Date(),30))}>+30 min</Button>
                    <Button size="sm" variant="outline-secondary" onClick={()=>{ const d=new Date(); d.setMinutes(0,0,0); d.setHours(d.getHours()+1); updateInicio(d); }}>Próx hora</Button>
                  </div>
                </div>
              </Form.Group>
            </Col>

            <Col md={3}>
              <Form.Group>
                <Form.Label>Fim</Form.Label>
                <div className="d-grid gap-2">
                  <ReactDatePicker
                    selected={fimDt}
                    onChange={(d)=> updateFim(d as Date)}
                    showTimeSelect
                    timeIntervals={15}
                    timeCaption="Hora"
                    dateFormat="Pp"
                    className="form-control"
                    locale={dfptBR}
                    placeholderText="Escolha data e hora..."
                  />
                  <div className="d-flex flex-wrap gap-2">
                    <Button size="sm" variant="outline-secondary" onClick={()=>{ if(!inicioDt){updateFim(addMinutes(new Date(),60));} else { updateFim(addMinutes(inicioDt,60)); } }}>+1h a partir do início</Button>
                    <Button size="sm" variant="outline-secondary" onClick={()=>{ if(!inicioDt){updateFim(addMinutes(new Date(),120));} else { updateFim(addMinutes(inicioDt,120)); } }}>+2h a partir do início</Button>
                  </div>
                </div>
              </Form.Group>
            </Col>

            <Col md={12} className="mt-2">
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
          <strong>Agenda</strong>
          <small className="text-muted">Visualize e cancele reservas</small>
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
            slotMinTime="07:00:00"
            slotMaxTime="22:00:00"
            slotDuration="00:30:00"
            slotLabelInterval="01:00"
            eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
            events={events}
            eventClick={handleEventClick}
          />
        </Card.Body>
      </Card>
    </>
  );
}

function RoomsPanel({ canManage }: { canManage: boolean }) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [novo, setNovo] = useState<{nome_sala:string;capacidade:number}>({nome_sala:'',capacidade:10});
  const [edit, setEdit] = useState<Room|null>(null);

  async function load() { setRooms(await api('/rooms')); }
  useEffect(()=>{ load(); }, []);

  async function addRoom() {
    if (!canManage) return;
    await api('/rooms', { method:'POST', body: JSON.stringify(novo) });
    setNovo({nome_sala:'',capacidade:10});
    await load();
  }
  async function saveRoom(r:Room) {
    if (!canManage) return;
    await api(`/rooms/${r.id_sala}`, { method:'PUT', body: JSON.stringify({ nome_sala:r.nome_sala, capacidade:r.capacidade }) });
    setEdit(null);
    await load();
  }
  async function deleteRoom(id:number) {
    if (!canManage) return;
    const ok = window.confirm('Excluir esta sala?'); if (!ok) return;
    await api(`/rooms/${id}`, { method:'DELETE' });
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
                <Form.Control value={novo.nome_sala} onChange={e=>setNovo(v=>({...v, nome_sala:e.target.value}))}/>
              </Form.Group>
            </Col>
            <Col md={3}>
              <Form.Group>
                <Form.Label>Capacidade</Form.Label>
                <Form.Control
                  type="number" min={1} value={novo.capacidade}
                  onChange={e=>setNovo(v=>({...v, capacidade:Number(e.target.value)}))}
                />
              </Form.Group>
            </Col>
            <Col md={3} className="d-flex align-items-end">
              <Button onClick={addRoom} disabled={!canManage}>Adicionar</Button>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      <Card className="shadow-sm">
        <Card.Header><strong>Salas</strong></Card.Header>
        <Card.Body className="p-0">
          <Table hover responsive className="mb-0">
            <thead><tr><th>#</th><th>Nome</th><th>Capacidade</th><th style={{width:180}}></th></tr></thead>
            <tbody>
              {rooms.map(r=>(
                <tr key={r.id_sala}>
                  <td>{r.id_sala}</td>
                  <td>
                    {edit?.id_sala===r.id_sala
                      ? <Form.Control value={edit.nome_sala} onChange={e=>setEdit({...edit!, nome_sala:e.target.value})}/>
                      : r.nome_sala}
                  </td>
                  <td>
                    {edit?.id_sala===r.id_sala
                      ? <Form.Control type="number" value={edit.capacidade} onChange={e=>setEdit({...edit!, capacidade:Number(e.target.value)})}/>
                      : r.capacidade}
                  </td>
                  <td className="text-end">
                    {edit?.id_sala===r.id_sala ? (
                      <>
                        <Button size="sm" variant="success" className="me-2" onClick={()=>saveRoom(edit!)}><i className="bi bi-check2"></i></Button>
                        <Button size="sm" variant="secondary" onClick={()=>setEdit(null)}><i className="bi bi-x-lg"></i></Button>
                      </>
                    ) : (
                      <>
                        <Button size="sm" variant="outline-primary" className="me-2" onClick={()=>setEdit(r)}><i className="bi bi-pencil"></i> Editar</Button>
                        <Button size="sm" variant="outline-danger" onClick={()=>deleteRoom(r.id_sala)}><i className="bi bi-trash"></i></Button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {rooms.length===0 && <tr><td colSpan={4} className="text-center text-muted py-4">Nenhuma sala</td></tr>}
            </tbody>
          </Table>
        </Card.Body>
      </Card>
    </>
  );
}

function Dashboard({ user, onLogout }: { user: User, onLogout: ()=>void }) {
  const [tab, setTab] = useState<'reservas'|'salas'|'usuarios'>('reservas');
  const canManage = user.tipo === 'admin' || user.tipo === 'coordenador';

  return (
    <>
      {/* Navbar clara + Bootswatch-friendly */}
      <Navbar bg="light" data-bs-theme="light" expand="lg" className="mb-4 shadow-sm">
        <Container>
          <Navbar.Brand className="fw-bold">Agendamento de Salas</Navbar.Brand>
          <Navbar.Toggle />
          <Navbar.Collapse>
            <Nav className="me-auto">
              <Nav.Link active={tab==='reservas'} onClick={()=>setTab('reservas')}>Reservas</Nav.Link>
              <Nav.Link active={tab==='salas'} onClick={()=>setTab('salas')}>Salas</Nav.Link>
              <Nav.Link active={tab==='usuarios'} onClick={()=>setTab('usuarios')}>Usuários</Nav.Link>
              {/* REMOVIDOS: "Início" e "Calendário" + setActivePage inexistente */}
            </Nav>
            <span className="text-secondary me-3">{user.nome} · {user.email}</span>
            <Button size="sm" variant="outline-primary" onClick={onLogout}>
              <i className="bi bi-box-arrow-right"></i> Sair
            </Button>
          </Navbar.Collapse>
        </Container>
      </Navbar>

      <Container className="pb-5">
        {tab==='reservas' && <BookingPanel me={user} canManage={canManage} />}
        {tab==='salas' && <RoomsPanel canManage={canManage} />}
        {tab==='usuarios' && <UsersPanel canManage={canManage} />}
      </Container>
    </>
  );
}

export default function App() {
  const { user, login, logout } = useAuth();
  return (
    <ErrorBoundary>
      {user ? <Dashboard user={user} onLogout={logout} /> : <Login onLogged={login} />}
      <ToastContainer position="bottom-right" />
    </ErrorBoundary>
  );
}
