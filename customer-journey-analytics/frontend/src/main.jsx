import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import { SiteProvider } from './context/SiteContext'
import './index.css'
import './App.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <AuthProvider>
    <SiteProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </SiteProvider>
  </AuthProvider>
)
