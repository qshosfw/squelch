import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { ThemeProvider } from "@/components/theme-provider"

import { PreferencesProvider } from "@/contexts/PreferencesContext"

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <ThemeProvider defaultTheme="dark" storageKey="squelch-theme">
            <PreferencesProvider>
                <App />
            </PreferencesProvider>
        </ThemeProvider>
    </React.StrictMode>,
)
