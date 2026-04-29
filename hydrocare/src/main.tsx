import React from 'react'
import ReactDOM from 'react-dom/client'
import App, { AuthProvider, Router } from './App.tsx'
import './index.css' 

const root = ReactDOM.createRoot(document.getElementById('root')!);

root.render(
  <React.StrictMode>
    {/* On enveloppe l'App avec les Contextes ici pour qu'ils soient globaux */}
    <AuthProvider> 
      <Router>
        <App />
      </Router>
    </AuthProvider>
  </React.StrictMode>
);