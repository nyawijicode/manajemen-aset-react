import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { lazy, type ReactNode } from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { AppLayout } from './app/AppLayout'
import { RequireAuth, RequirePermission } from './app/guards'
import { RouteErrorBoundary } from './app/RouteErrorBoundary'
import { ApiError } from './lib/api'
import { AuthProvider } from './lib/auth'
import { ToastProvider } from './lib/toast'
import { ChangePasswordPage } from './pages/ChangePasswordPage'
import { LoginPage } from './pages/LoginPage'
import { NotFoundPage } from './pages/NotFoundPage'

// Halaman internal dimuat sesuai kebutuhan agar bundel awal tetap ringan.
const AssetDetailPage = lazy(() =>
  import('./pages/AssetDetailPage').then((module) => ({ default: module.AssetDetailPage })),
)
const AssetFormPage = lazy(() =>
  import('./pages/AssetFormPage').then((module) => ({ default: module.AssetFormPage })),
)
const AssetsPage = lazy(() =>
  import('./pages/AssetsPage').then((module) => ({ default: module.AssetsPage })),
)
const AuditPage = lazy(() =>
  import('./pages/AuditPage').then((module) => ({ default: module.AuditPage })),
)
const CategoriesPage = lazy(() =>
  import('./pages/CategoriesPage').then((module) => ({ default: module.CategoriesPage })),
)
const DashboardPage = lazy(() =>
  import('./pages/DashboardPage').then((module) => ({ default: module.DashboardPage })),
)
const ReportsPage = lazy(() =>
  import('./pages/ReportsPage').then((module) => ({ default: module.ReportsPage })),
)
const SerialNumbersPage = lazy(() =>
  import('./pages/SerialNumbersPage').then((module) => ({ default: module.SerialNumbersPage })),
)
const SettingsPage = lazy(() =>
  import('./pages/SettingsPage').then((module) => ({ default: module.SettingsPage })),
)
const StockOpnameDetailPage = lazy(() =>
  import('./pages/StockOpnameDetailPage').then((module) => ({ default: module.StockOpnameDetailPage })),
)
const StockOpnameNewPage = lazy(() =>
  import('./pages/StockOpnameNewPage').then((module) => ({ default: module.StockOpnameNewPage })),
)
const StockOpnamesPage = lazy(() =>
  import('./pages/StockOpnamesPage').then((module) => ({ default: module.StockOpnamesPage })),
)
const TransactionDetailPage = lazy(() =>
  import('./pages/TransactionDetailPage').then((module) => ({ default: module.TransactionDetailPage })),
)
const TransactionFormPage = lazy(() =>
  import('./pages/TransactionFormPage').then((module) => ({ default: module.TransactionFormPage })),
)
const TransactionListPage = lazy(() =>
  import('./pages/TransactionListPage').then((module) => ({ default: module.TransactionListPage })),
)
const UsersPage = lazy(() =>
  import('./pages/UsersPage').then((module) => ({ default: module.UsersPage })),
)

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false
        return failureCount < 1
      },
    },
    mutations: {
      retry: false,
    },
  },
})

function guard(permission: string, element: ReactNode) {
  return <RequirePermission permission={permission}>{element}</RequirePermission>
}

const router = createBrowserRouter(
  [
    {
      path: '/masuk',
      element: <LoginPage />,
      errorElement: <RouteErrorBoundary />,
    },
    {
      element: <RequireAuth />,
      errorElement: <RouteErrorBoundary />,
      children: [
        {
          path: 'ubah-sandi',
          element: <ChangePasswordPage />,
        },
        {
          element: <AppLayout />,
          errorElement: <RouteErrorBoundary />,
          children: [
            { index: true, element: guard('dashboard.view', <DashboardPage />) },

            { path: 'aset', element: guard('assets.view', <AssetsPage />) },
            { path: 'aset/baru', element: guard('assets.manage', <AssetFormPage mode="create" />) },
            { path: 'aset/:id', element: guard('assets.view', <AssetDetailPage />) },
            { path: 'aset/:id/ubah', element: guard('assets.manage', <AssetFormPage mode="edit" />) },
            { path: 'kategori', element: guard('assets.view', <CategoriesPage />) },
            { path: 'serial-number', element: guard('serial.view', <SerialNumbersPage />) },

            { path: 'transaksi/masuk', element: guard('transactions.view', <TransactionListPage kind="in" />) },
            {
              path: 'transaksi/masuk/baru',
              element: guard('transactions.create', <TransactionFormPage kind="in" />),
            },
            {
              path: 'transaksi/masuk/:id',
              element: guard('transactions.view', <TransactionDetailPage kind="in" />),
            },
            { path: 'transaksi/keluar', element: guard('transactions.view', <TransactionListPage kind="out" />) },
            {
              path: 'transaksi/keluar/baru',
              element: guard('transactions.create', <TransactionFormPage kind="out" />),
            },
            {
              path: 'transaksi/keluar/:id',
              element: guard('transactions.view', <TransactionDetailPage kind="out" />),
            },

            { path: 'stock-opname', element: guard('opname.view', <StockOpnamesPage />) },
            { path: 'stock-opname/baru', element: guard('opname.manage', <StockOpnameNewPage />) },
            { path: 'stock-opname/:id', element: guard('opname.view', <StockOpnameDetailPage />) },

            { path: 'laporan/aset', element: guard('reports.view', <ReportsPage kind="assets" />) },
            { path: 'laporan/masuk', element: guard('reports.view', <ReportsPage kind="in" />) },
            { path: 'laporan/keluar', element: guard('reports.view', <ReportsPage kind="out" />) },
            { path: 'laporan/opname', element: guard('reports.view', <ReportsPage kind="opname" />) },

            { path: 'pengguna', element: guard('users.manage', <UsersPage />) },
            { path: 'audit', element: guard('audit.view', <AuditPage />) },
            { path: 'pengaturan', element: guard('settings.manage', <SettingsPage />) },

            { path: '*', element: <NotFoundPage /> },
          ],
        },
      ],
    },
  ],
  { basename: '/app' },
)

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  )
}

export default App
