import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import AppLayout from './layouts/AppLayout'
import Dashboard from './pages/Dashboard'
import Employees from './pages/Employees'
import Onboarding from './pages/Onboarding'
import Assets from './pages/Assets'
import Reports from './pages/Reports'
import WorkspaceProvider from './state/WorkspaceProvider'
import './App.css'
const router = createBrowserRouter([{ element: <WorkspaceProvider><AppLayout /></WorkspaceProvider>, children: [
  { index: true, element: <Dashboard /> }, { path: 'employees', element: <Employees /> },
  { path: 'onboarding', element: <Onboarding /> }, { path: 'assets', element: <Assets /> },
  { path: 'reports', element: <Reports /> }, { path: '*', element: <Navigate to="/" replace /> },
] }])
export default function App() { return <RouterProvider router={router} /> }
