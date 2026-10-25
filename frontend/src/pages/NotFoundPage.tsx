import { Link } from 'react-router-dom'
import { ErrorPanel } from '../app/guards'
import { buttonStyles } from '../components/ui/Button'
import { useDocumentTitle } from '../lib/hooks'

export function NotFoundPage() {
  useDocumentTitle('Halaman tidak ditemukan')

  return (
    <ErrorPanel
      code="404"
      title="Halaman tidak ditemukan"
      description="Alamat yang Anda buka tidak tersedia, sudah dipindahkan, atau bukan bagian dari modul yang dapat Anda akses."
      action={
        <>
          <Link to="/" className={buttonStyles('primary', 'md')}>
            Kembali ke dashboard
          </Link>
          <button
            type="button"
            onClick={() => window.history.back()}
            className={buttonStyles('secondary', 'md')}
          >
            Kembali ke halaman sebelumnya
          </button>
        </>
      }
    />
  )
}
