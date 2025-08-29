// src/components/Header.tsx
import { Navbar, Container, Nav, Button } from 'react-bootstrap'

type Props = {
  active: 'reservas' | 'salas' | 'usuarios'
  onChange: (k: 'reservas' | 'salas' | 'usuarios') => void
  onLogout?: () => void
  user?: { nome?: string; email?: string }
}

export default function Header({ active, onChange, onLogout, user }: Props) {
  return (
    <Navbar expand="lg" bg="light" data-bs-theme="light" className="shadow-sm sticky-top">
      <Container>
        <Navbar.Brand className="fw-bold">Agendamento de Salas</Navbar.Brand>
        <Navbar.Toggle aria-controls="nav" />
        <Navbar.Collapse id="nav">
          <Nav className="me-auto">
            <Nav.Link active={active === 'reservas'} onClick={() => onChange('reservas')}>Reservas</Nav.Link>
            <Nav.Link active={active === 'salas'} onClick={() => onChange('salas')}>Salas</Nav.Link>
            <Nav.Link active={active === 'usuarios'} onClick={() => onChange('usuarios')}>Usuários</Nav.Link>
          </Nav>
          <div className="d-flex align-items-center gap-3">
            {user && <small className="text-secondary">{user.nome ?? ''}{user?.email ? ` · ${user.email}` : ''}</small>}
            <Button variant="outline-primary" size="sm" onClick={onLogout}>
              <i className="bi bi-box-arrow-right me-1"></i> Sair
            </Button>
          </div>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  )
}
