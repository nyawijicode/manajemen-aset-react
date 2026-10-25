import { isRouteErrorResponse, Link, useRouteError } from 'react-router-dom'

export function RouteErrorBoundary() {
  const error = useRouteError()
  const notFound = isRouteErrorResponse(error) && error.status === 404

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-card sm:p-10">
        <p className="font-mono text-sm font-semibold tracking-widest text-primary-700">
          {notFound ? '404' : '500'}
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
          {notFound ? 'Halaman tidak ditemukan' : 'Terjadi kendala'}
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {notFound
            ? 'Alamat yang Anda buka tidak tersedia atau sudah dipindahkan.'
            : 'Halaman belum dapat ditampilkan. Muat ulang halaman atau kembali ke dashboard. Kami tidak menampilkan detail teknis untuk menjaga keamanan sistem.'}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Muat ulang
          </button>
          <Link
            to="/"
            className="inline-flex min-h-11 items-center rounded-lg bg-primary-700 px-4 text-sm font-semibold text-white hover:bg-primary-800"
          >
            Kembali ke dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
