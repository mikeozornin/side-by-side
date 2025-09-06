import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App.tsx'
import './index.css'
import './i18n'
import i18n from './i18n'

// Устанавливаем заголовок страницы из локализации
const updatePageTitle = () => {
  document.title = i18n.t('appTitle')
}

// Обновляем заголовок при изменении языка
i18n.on('languageChanged', updatePageTitle)

// Устанавливаем заголовок при инициализации
updatePageTitle()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>,
)
