import React from 'react'
import ReactDOM from 'react-dom/client'
import Dashboard from './Dashboard'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <Dashboard />
    </QueryClientProvider>
  </React.StrictMode>,
)
