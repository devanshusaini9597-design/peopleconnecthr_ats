import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import './i18n'
import App from './App.jsx'
import { ToastProvider } from './components/Toast.jsx'
import { registerServiceWorker } from './utils/registerSW.js'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      cacheTime: 300000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 1,
    },
  },
})

registerServiceWorker()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <App />
      </ToastProvider>
    </QueryClientProvider>
  </StrictMode>,
)
