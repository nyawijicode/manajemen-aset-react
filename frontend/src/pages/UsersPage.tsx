import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  KeyRound,
  Pencil,
  Plus,
  Power,
  PowerOff,
  ShieldCheck,
  UserPlus,
  UserRound,
  Users,
} from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Alert, EmptyState, ErrorState } from '../components/ui/Feedback'
import { FilterBar, SearchField } from '../components/ui/Filters'
import { Field, Input, Select } from '../components/ui/Form'
import { ConfirmDialog, Modal } from '../components/ui/Modal'
import { PageHeader } from '../components/ui/PageHeader'
import { Pagination } from '../components/ui/Pagination'
import { TBody, TD, TH, THead, TR, Table, TableEmpty, TableScrollHint } from '../components/ui/Table'
import { ApiError, api, buildQuery, getErrorMessage } from '../lib/api'
import { useAuth } from '../lib/auth'
import { formatDateTime, formatNumber } from '../lib/format'
import { useDebouncedValue, useDocumentTitle } from '../lib/hooks'
import { useToast } from '../lib/toast'
import type { Paginated, ResourceResponse, Role, User } from '../types/api'

type FormMode = 'create' | 'edit'
type FormTarget = { mode: 'create' } | { mode: 'edit'; user: User }

const passwordSchema = z
  .string()
  .min(12, 'Kata sandi minimal 12 karakter.')
  .regex(/[a-z]/, 'Kata sandi harus memuat huruf kecil.')
  .regex(/[A-Z]/, 'Kata sandi harus memuat huruf besar.')
  .regex(/[0-9]/, 'Kata sandi harus memuat angka.')
  .regex(/[^A-Za-z0-9]/, 'Kata sandi harus memuat simbol.')

const userSchema = z
  .object({
    name: z.string().trim().min(1, 'Nama wajib diisi.').max(120, 'Nama maksimal 120 karakter.'),
    email: z
      .string()
      .trim()
      .min(1, 'Email wajib diisi.')
      .email('Format email tidak valid.')
      .max(190, 'Email maksimal 190 karakter.'),
    role: z.enum(['pimpinan', 'admin']),
    password: z.string(),
    password_confirmation: z.string(),
  })
  .superRefine((values, context) => {
    if (values.password === '' && values.password_confirmation === '') return

    const result = passwordSchema.safeParse(values.password)
    if (!result.success) {
      context.addIssue({
        code: 'custom',
        path: ['password'],
        message: result.error.issues[0]?.message ?? 'Kata sandi belum memenuhi syarat.',
      })
    }

    if (values.password !== values.password_confirmation) {
      context.addIssue({
        code: 'custom',
        path: ['password_confirmation'],
        message: 'Konfirmasi kata sandi belum sama.',
      })
    }
  })

type UserFormValues = z.infer<typeof userSchema>

const resetSchema = z
  .object({
    password: passwordSchema,
    password_confirmation: z.string().min(1, 'Konfirmasi kata sandi wajib diisi.'),
  })
  .refine((values) => values.password === values.password_confirmation, {
    path: ['password_confirmation'],
    message: 'Konfirmasi kata sandi belum sama.',
  })

type ResetValues = z.infer<typeof resetSchema>

export function UsersPage() {
  useDocumentTitle('Pengguna')
  const { user: currentUser } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [query, setQuery] = useState('')
  const debouncedQuery = useDebouncedValue(query, 350)
  const [roleFilter, setRoleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [formTarget, setFormTarget] = useState<FormTarget | null>(null)
  const [statusTarget, setStatusTarget] = useState<User | null>(null)
  const [resetTarget, setResetTarget] = useState<User | null>(null)

  const users = useQuery({
    queryKey: ['users', debouncedQuery, roleFilter, statusFilter, page],
    queryFn: () =>
      api<Paginated<User>>(
        `/users${buildQuery({
          q: debouncedQuery,
          role: roleFilter,
          status: statusFilter,
          page,
          per_page: 20,
        })}`,
      ),
  })

  const statusMutation = useMutation({
    mutationFn: (target: User) =>
      api<ResourceResponse<User>>(`/users/${target.id}/status`, {
        method: 'PATCH',
        body: { is_active: !target.is_active },
      }),
    onSuccess: (response, target) => {
      toast(
        'success',
        target.is_active ? 'Akun dinonaktifkan' : 'Akun diaktifkan',
        response.message ?? 'Status akun berhasil diperbarui.',
      )
      setStatusTarget(null)
      void queryClient.invalidateQueries({ queryKey: ['users'] })
      void queryClient.invalidateQueries({ queryKey: ['audit-logs'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onError: (error) => {
      toast('error', 'Status akun belum berubah', getErrorMessage(error))
    },
  })

  const resetFilters = () => {
    setQuery('')
    setRoleFilter('all')
    setStatusFilter('all')
    setPage(1)
  }

  const meta = users.data?.meta
  const rows = users.data?.data ?? []

  return (
    <>
      <PageHeader
        title="Pengguna"
        description="Kelola akun, peran, dan status akses. Setiap perubahan peran atau kata sandi dicatat pada audit trail."
        actions={
          <Button onClick={() => setFormTarget({ mode: 'create' })}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Tambah pengguna
          </Button>
        }
      />

      <div className="no-print mb-4">
        <FilterBar>
          <div className="sm:col-span-2">
            <label htmlFor="user-search" className="mb-1 block text-xs font-semibold text-slate-600">
              Pencarian
            </label>
            <SearchField
              value={query}
              onChange={(value) => {
                setQuery(value)
                setPage(1)
              }}
              placeholder="Cari nama atau email pengguna…"
              label="Cari pengguna berdasarkan nama atau email"
            />
          </div>

          <div>
            <label htmlFor="user-role" className="mb-1 block text-xs font-semibold text-slate-600">
              Peran
            </label>
            <Select
              id="user-role"
              value={roleFilter}
              onChange={(event) => {
                setRoleFilter(event.target.value)
                setPage(1)
              }}
            >
              <option value="all">Semua peran</option>
              <option value="pimpinan">Manajer</option>
              <option value="admin">Admin</option>
            </Select>
          </div>

          <div>
            <label htmlFor="user-status" className="mb-1 block text-xs font-semibold text-slate-600">
              Status
            </label>
            <Select
              id="user-status"
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value)
                setPage(1)
              }}
            >
              <option value="all">Semua status</option>
              <option value="active">Aktif</option>
              <option value="inactive">Nonaktif</option>
            </Select>
          </div>

          <div className="flex items-end sm:col-span-2">
            <Button variant="secondary" className="w-full sm:w-auto" onClick={resetFilters}>
              Reset filter
            </Button>
          </div>
        </FilterBar>
      </div>

      <Card>
        {users.isError ? (
          <ErrorState
            title="Daftar pengguna belum dapat dimuat"
            description={getErrorMessage(users.error)}
            onRetry={() => void users.refetch()}
          />
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
              <p className="text-sm text-slate-600" aria-live="polite">
                {users.isLoading
                  ? 'Memuat pengguna…'
                  : `${formatNumber(meta?.total ?? 0)} akun sesuai filter`}
              </p>
              <p className="text-xs text-slate-500">Minimal satu akun Manajer harus tetap aktif.</p>
            </div>

            <Table caption="Daftar akun pengguna aplikasi" minWidth="min-w-[980px]">
              <THead>
                <TR>
                  <TH>Pengguna</TH>
                  <TH>Peran</TH>
                  <TH>Status</TH>
                  <TH>Keamanan akun</TH>
                  <TH>Terakhir masuk</TH>
                  <TH className="text-right">Tindakan</TH>
                </TR>
              </THead>
              <TBody>
                {users.isLoading ? (
                  Array.from({ length: 6 }).map((_, index) => (
                    <TR key={`skeleton-${index}`}>
                      <TD colSpan={6}>
                        <span className="block h-5 animate-pulse rounded bg-slate-100" />
                      </TD>
                    </TR>
                  ))
                ) : rows.length === 0 ? (
                  <TableEmpty colSpan={6}>
                    <EmptyState
                      icon={<Users className="h-6 w-6" aria-hidden="true" />}
                      title="Tidak ada akun yang sesuai"
                      description="Ubah kata kunci atau filter. Tambahkan akun baru bila akses diperlukan."
                      action={
                        <Button onClick={() => setFormTarget({ mode: 'create' })}>
                          <UserPlus className="h-4 w-4" aria-hidden="true" />
                          Tambah pengguna
                        </Button>
                      }
                    />
                  </TableEmpty>
                ) : (
                  rows.map((user) => {
                    const isSelf = currentUser?.id === user.id

                    return (
                      <TR key={user.id}>
                        <TD>
                          <div className="flex items-start gap-2">
                            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                              <UserRound className="h-4 w-4" aria-hidden="true" />
                            </span>
                            <span className="min-w-0">
                              <span className="flex flex-wrap items-center gap-1.5 font-medium text-slate-900">
                                {user.name}
                                {isSelf ? <Badge tone="info">Akun saya</Badge> : null}
                              </span>
                              <span className="block truncate text-xs text-slate-500">{user.email}</span>
                            </span>
                          </div>
                        </TD>
                        <TD>
                          <Badge tone={user.role === 'pimpinan' ? 'primary' : 'neutral'}>
                            {user.role_label}
                          </Badge>
                        </TD>
                        <TD>
                          <Badge tone={user.is_active ? 'success' : 'neutral'} dot>
                            {user.is_active ? 'Aktif' : 'Nonaktif'}
                          </Badge>
                          {!user.is_active && user.deactivated_at ? (
                            <span className="mt-1 block text-xs text-slate-500">
                              Sejak {formatDateTime(user.deactivated_at)}
                            </span>
                          ) : null}
                        </TD>
                        <TD>
                          {user.must_change_password ? (
                            <Badge tone="warning">Wajib ganti kata sandi</Badge>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700">
                              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                              Kata sandi aktif
                            </span>
                          )}
                          <span className="mt-1 block text-xs text-slate-500">
                            Dibuat {formatDateTime(user.created_at)}
                          </span>
                        </TD>
                        <TD className="text-sm text-slate-600">
                          {user.last_login_at ? formatDateTime(user.last_login_at) : 'Belum pernah'}
                        </TD>
                        <TD>
                          <div className="flex justify-end gap-0.5">
                            <button
                              type="button"
                              onClick={() => setFormTarget({ mode: 'edit', user })}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                              aria-label={`Ubah akun ${user.name}`}
                              title="Ubah data pengguna"
                            >
                              <Pencil className="h-4 w-4" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setResetTarget(user)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                              aria-label={`Atur ulang kata sandi ${user.name}`}
                              title="Atur ulang kata sandi"
                            >
                              <KeyRound className="h-4 w-4" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setStatusTarget(user)}
                              disabled={isSelf && user.is_active}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
                              aria-label={
                                user.is_active ? `Nonaktifkan ${user.name}` : `Aktifkan ${user.name}`
                              }
                              title={
                                isSelf && user.is_active
                                  ? 'Anda tidak dapat menonaktifkan akun sendiri'
                                  : user.is_active
                                    ? 'Nonaktifkan akun'
                                    : 'Aktifkan akun'
                              }
                            >
                              {user.is_active ? (
                                <PowerOff className="h-4 w-4" aria-hidden="true" />
                              ) : (
                                <Power className="h-4 w-4" aria-hidden="true" />
                              )}
                            </button>
                          </div>
                        </TD>
                      </TR>
                    )
                  })
                )}
              </TBody>
            </Table>
            <TableScrollHint />
            {meta ? <Pagination meta={meta} onChange={setPage} itemLabel="akun" /> : null}
          </>
        )}
      </Card>

      {formTarget ? (
        <UserFormModal
          key={formTarget.mode === 'edit' ? `edit-${formTarget.user.id}` : 'create'}
          mode={formTarget.mode}
          user={formTarget.mode === 'edit' ? formTarget.user : undefined}
          isSelf={formTarget.mode === 'edit' && formTarget.user.id === currentUser?.id}
          onClose={() => setFormTarget(null)}
        />
      ) : null}

      {resetTarget ? (
        <ResetPasswordModal user={resetTarget} onClose={() => setResetTarget(null)} />
      ) : null}

      <ConfirmDialog
        open={statusTarget !== null}
        onClose={() => setStatusTarget(null)}
        onConfirm={() => {
          if (statusTarget) statusMutation.mutate(statusTarget)
        }}
        loading={statusMutation.isPending}
        title={statusTarget?.is_active ? 'Nonaktifkan akun pengguna?' : 'Aktifkan kembali akun?'}
        description={
          statusTarget?.is_active
            ? `Akun ${statusTarget.name} (${statusTarget.email}) tidak dapat masuk lagi. Seluruh sesi aktif akan diakhiri. Riwayat aktivitas tetap tersimpan.`
            : `Akun ${statusTarget?.name ?? ''} (${statusTarget?.email ?? ''}) akan dapat masuk kembali dengan kata sandi yang berlaku.`
        }
        confirmLabel={statusTarget?.is_active ? 'Nonaktifkan akun' : 'Aktifkan akun'}
        tone={statusTarget?.is_active ? 'danger' : 'primary'}
      />
    </>
  )
}

function UserFormModal({
  mode,
  user,
  isSelf,
  onClose,
}: {
  mode: FormMode
  user?: User
  isSelf: boolean
  onClose: () => void
}) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [formError, setFormError] = useState<string | null>(null)
  const isCreate = mode === 'create'

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      name: user?.name ?? '',
      email: user?.email ?? '',
      role: (user?.role ?? 'admin') as Role,
      password: '',
      password_confirmation: '',
    },
  })

  const mutation = useMutation({
    mutationFn: (values: UserFormValues) => {
      const payload = {
        name: values.name.trim(),
        email: values.email.trim(),
        role: values.role,
        ...(values.password
          ? {
              password: values.password,
              password_confirmation: values.password_confirmation,
            }
          : {}),
      }

      return api<ResourceResponse<User>>(
        isCreate ? '/users' : `/users/${user?.id}`,
        { method: isCreate ? 'POST' : 'PUT', body: payload },
      )
    },
    onSuccess: (response) => {
      toast(
        'success',
        isCreate ? 'Pengguna ditambahkan' : 'Data pengguna diperbarui',
        response.message ?? 'Perubahan akun berhasil disimpan.',
      )
      void queryClient.invalidateQueries({ queryKey: ['users'] })
      void queryClient.invalidateQueries({ queryKey: ['audit-logs'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      onClose()
    },
    onError: (error) => {
      if (error instanceof ApiError && error.errors) {
        for (const [field, messages] of Object.entries(error.errors)) {
          if (
            field === 'name' ||
            field === 'email' ||
            field === 'role' ||
            field === 'password' ||
            field === 'password_confirmation'
          ) {
            setError(field, { type: 'server', message: messages[0] })
          }
        }
      }
      setFormError(getErrorMessage(error))
    },
  })

  const onSubmit = (values: UserFormValues) => {
    setFormError(null)

    if (isCreate && values.password === '') {
      setError('password', { type: 'manual', message: 'Kata sandi awal wajib diisi.' })
      return
    }

    mutation.mutate(values)
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={isCreate ? 'Tambah pengguna' : 'Ubah data pengguna'}
      description={
        isCreate
          ? 'Akun baru wajib mengganti kata sandi awal saat pertama kali masuk.'
          : 'Biarkan kolom kata sandi kosong apabila tidak ingin menggantinya.'
      }
      size="md"
      preventClose={mutation.isPending}
    >
      {formError ? (
        <div className="mb-4">
          <Alert tone="danger" title="Data belum dapat disimpan">
            {formError}
          </Alert>
        </div>
      ) : null}

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nama lengkap" htmlFor="user-name" required error={errors.name?.message}>
            <Input
              id="user-name"
              autoComplete="off"
              aria-invalid={errors.name ? true : undefined}
              {...register('name')}
            />
          </Field>

          <Field label="Email pengguna" htmlFor="user-email" required error={errors.email?.message}>
            <Input
              id="user-email"
              type="email"
              autoComplete="off"
              placeholder="nama@example.com"
              aria-invalid={errors.email ? true : undefined}
              {...register('email')}
            />
          </Field>
        </div>

        <Field
          label="Peran"
          htmlFor="user-form-role"
          required
          error={errors.role?.message}
          hint={
            isSelf
              ? 'Peran akun sendiri tidak dapat diubah.'
              : 'Manajer memiliki akses penuh; Admin menangani operasional harian.'
          }
        >
          <Select
            id="user-form-role"
            disabled={isSelf}
            aria-invalid={errors.role ? true : undefined}
            {...register('role')}
          >
            <option value="admin">Admin — operasional</option>
            <option value="pimpinan">Manajer - akses penuh</option>
          </Select>
        </Field>

        <div className="grid gap-4 border-t border-slate-200 pt-4 sm:grid-cols-2">
          <Field
            label={isCreate ? 'Kata sandi awal' : 'Kata sandi baru'}
            htmlFor="user-password"
            required={isCreate}
            error={errors.password?.message}
            hint={
              isCreate
                ? 'Minimal 12 karakter, kombinasi huruf besar-kecil, angka, dan simbol.'
                : 'Kosongkan bila kata sandi tidak diubah.'
            }
          >
            <Input
              id="user-password"
              type="password"
              autoComplete="new-password"
              aria-invalid={errors.password ? true : undefined}
              {...register('password')}
            />
          </Field>

          <Field
            label="Ulangi kata sandi"
            htmlFor="user-password-confirmation"
            required={isCreate}
            error={errors.password_confirmation?.message}
          >
            <Input
              id="user-password-confirmation"
              type="password"
              autoComplete="new-password"
              aria-invalid={errors.password_confirmation ? true : undefined}
              {...register('password_confirmation')}
            />
          </Field>
        </div>

        {!isCreate && user ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-600">
            Akun dibuat {formatDateTime(user.created_at)}.
            {user.must_change_password
              ? ' Pengguna ini masih wajib mengganti kata sandi.'
              : ' Kata sandi terakhir tidak ditampilkan demi keamanan.'}
          </div>
        ) : null}

        <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Batal
          </Button>
          <Button type="submit" loading={mutation.isPending || isSubmitting}>
            {isCreate ? 'Simpan pengguna' : 'Simpan perubahan'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function ResetPasswordModal({ user, onClose }: { user: User; onClose: () => void }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ResetValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: { password: '', password_confirmation: '' },
  })

  const mutation = useMutation({
    mutationFn: (values: ResetValues) =>
      api(`/users/${user.id}/reset-password`, {
        method: 'POST',
        body: values,
      }),
    onSuccess: () => {
      toast(
        'success',
        'Kata sandi diatur ulang',
        `${user.name} wajib mengganti kata sandi saat masuk berikutnya.`,
      )
      void queryClient.invalidateQueries({ queryKey: ['users'] })
      void queryClient.invalidateQueries({ queryKey: ['audit-logs'] })
      onClose()
    },
    onError: (error) => {
      if (error instanceof ApiError && error.errors) {
        for (const [field, messages] of Object.entries(error.errors)) {
          if (field === 'password' || field === 'password_confirmation') {
            setError(field, { type: 'server', message: messages[0] })
          }
        }
      }
      setFormError(getErrorMessage(error))
    },
  })

  return (
    <Modal
      open
      onClose={onClose}
      title="Atur ulang kata sandi"
      description={`Tetapkan kata sandi sementara untuk ${user.name}. Sesi aktif pengguna akan diakhiri.`}
      size="sm"
      preventClose={mutation.isPending}
    >
      {formError ? (
        <div className="mb-4">
          <Alert tone="danger" title="Kata sandi belum dapat diubah">
            {formError}
          </Alert>
        </div>
      ) : null}

      <form onSubmit={handleSubmit((values) => mutation.mutate(values))} noValidate className="space-y-4">
        <Field
          label="Kata sandi baru"
          htmlFor="reset-password"
          required
          error={errors.password?.message}
          hint="Minimal 12 karakter, kombinasi huruf besar-kecil, angka, dan simbol."
        >
          <Input
            id="reset-password"
            type="password"
            autoComplete="new-password"
            aria-invalid={errors.password ? true : undefined}
            {...register('password')}
          />
        </Field>

        <Field
          label="Ulangi kata sandi"
          htmlFor="reset-password-confirmation"
          required
          error={errors.password_confirmation?.message}
        >
          <Input
            id="reset-password-confirmation"
            type="password"
            autoComplete="new-password"
            aria-invalid={errors.password_confirmation ? true : undefined}
            {...register('password_confirmation')}
          />
        </Field>

        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
          Sampaikan kata sandi sementara melalui saluran yang aman. Pengguna wajib menggantinya saat
          masuk.
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Batal
          </Button>
          <Button type="submit" loading={mutation.isPending || isSubmitting}>
            Atur ulang kata sandi
          </Button>
        </div>
      </form>
    </Modal>
  )
}
