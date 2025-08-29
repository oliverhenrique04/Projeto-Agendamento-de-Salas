// src/main.tsx (ou src/index.tsx)
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

// === Estilo principal via Bootswatch (tema Lux) ===
import 'bootswatch/dist/lux/bootstrap.min.css'
// Ícones (opcional)
import 'bootstrap-icons/font/bootstrap-icons.css'
// Seus ajustes finos (deve vir por último)
import './theme.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
