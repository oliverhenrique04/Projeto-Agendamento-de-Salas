# UI Redesign — Agosto/2025

## O que foi feito
- **Removidos os links "Início" e "Calendário"** do topo (Navbar) — além de não serem necessários, geravam erro (`setActivePage` inexistente).
- **Navbar com efeito *glass/blur* e gradiente**, sombra suave e borda inferior translúcida (`.app-navbar.glassy`).
- **Cards e tabelas modernizados**: bordas arredondadas, sombras suaves, cabeçalho com leve gradiente.
- **Calendário (FullCalendar) refinado**: eventos com borda lateral colorida, cantos arredondados e sombra, linhas mais espaçadas e tipografia mais forte no título.
- **Botões e *badges* com tipografia mais forte e bordas mais arredondadas.**

## Correções
- Removidas referências ao estado inexistente `setActivePage('home' | 'calendar')` do `Dashboard` que causavam erro em tempo de execução.

## Como testar
1. No **backend**: `npm i && npx prisma generate && npm run dev`.
2. No **frontend**: `npm i && npm run dev`.
3. A interface atualizada estará disponível em `http://localhost:5173` (Vite).

## Observações
- Mantive a navegação entre **Reservas, Salas e Usuários**; os itens "Início" e "Calendário" foram retirados conforme solicitado.
- O calendário continua na tela de **Reservas** com visual mais moderno.