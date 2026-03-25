import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import AdminApp from './AdminApp.jsx'
import './index.css'

// Chrome: extensiones (traductor, bloqueadores, etc.) a veces disparan esta promesa rechazada; no es un bug de la app.
window.addEventListener('unhandledrejection', (event) => {
  const msg = String(event.reason?.message ?? event.reason ?? '')
  if (/message channel closed|asynchronous response by returning true/i.test(msg)) {
    event.preventDefault()
  }
})

const isAdmin = window.location.pathname === '/admin'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {isAdmin ? <AdminApp /> : <App />}
  </React.StrictMode>,
)
