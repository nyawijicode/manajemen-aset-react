import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Tags, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { EmptyState, ErrorState } from '../components/ui/Feedback'
import { FilterBar, SearchField } from '../components/ui/Filters'
import { Field, Input, Textarea } from '../components/ui/Form'
import { ConfirmDialog, Modal } from '../components/ui/Modal'
import { PageHeader } from '../components/ui/PageHeader'
import { Pagination } from '../components/ui/Pagination'
import { TBody, TD, TH, THead, TR, Table, TableEmpty, TableScrollHint } from '../components/ui/Table'
import { ApiError, api, buildQuery, getErrorMessage } from '../lib/api'
import { useAuth } from '../lib/auth'
import { formatDateTime, formatNumber } from '../lib/format'
import { useDebouncedValue, useDocumentTitle } from '../lib/hooks'
import { useToast } from '../lib/toast'
import type { Category, Paginated } from '../types/api'

const schema = z.object({
  name: z.string().min(1, 'Nama kategori wajib diisi.').max(120, 'Nama maksimal 120 karakter.'),
  description: z.string().max(1000, 'Keterangan maksimal 1.000 karakter.').optional(),
})

type CategoryValues = z.infer<typeof schema>

export function CategoriesPage() {
  useDocumentTitle('Kategori Aset')
  const { has } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const canManage = has('categories.manage')

  const [query, setQuery] = useState('')
  const debouncedQuery = useDebouncedValue(query, 350)
  const [page, setPage] = useState(1)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Category | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<CategoryValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', description: '' },
  })

  const categories = useQuery({
    queryKey: ['categories', debouncedQuery, page],
    queryFn: () =>
      api<Paginated<Category>>(`/categories${buildQuery({ q: debouncedQuery, page, per_page: 25 })}`),
  })

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['categories'] })
    void queryClient.invalidateQueries({ queryKey: ['assets'] })
    void queryClient.invalidateQueries({ queryKey: ['asset'] })
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  }

  const saveMutation = useMutation({
    mutationFn: (values: CategoryValues) => {
      const body = {
        name: values.name.trim(),
        description: values.description?.trim() ? values.description.trim() : null,
      }

      return editing
        ? api(`/categories/${editing.id}`, { method: 'PUT', body })
        : api('/categories', { method: 'POST', body })
    },
    onSuccess: () => {
      toast(
        'success',
        editing ? 'Kategori diperbarui' : 'Kategori ditambahkan',
        editing ? 'Perubahan nama dan keterangan telah disimpan.' : 'Kategori baru siap dipakai pada data aset.',
      )
      setFormOpen(false)
      setEditing(null)
      invalidate()
    },
    onError: (error) => {
      if (error instanceof ApiError && error.errors) {
        for (const [field, messages] of Object.entries(error.errors)) {
          if (field === 'name' || field === 'description') {
            setError(field, { type: 'server', message: messages[0] })
          }
        }
      }
      setFormError(getErrorMessage(error))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (category: Category) => api(`/categories/${category.id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast('success', 'Kategori dihapus', 'Kategori yang tidak dipakai aset telah dihapus.')
      setPendingDelete(null)
      invalidate()
    },
    onError: (error) => {
      setPendingDelete(null)
      toast('error', 'Kategori belum dapat dihapus', getErrorMessage(error))
    },
  })

  const openCreate = () => {
    setEditing(null)
    setFormError(null)
    reset({ name: '', description: '' })
    setFormOpen(true)
  }

  const openEdit = (category: Category) => {
    setEditing(category)
    setFormError(null)
    reset({ name: category.name, description: category.description ?? '' })
    setFormOpen(true)
  }

  const meta = categories.data?.meta
  const rows = categories.data?.data ?? []

  return (
    <>
      <PageHeader
        title="Kategori Aset"
        description="Klasifikasi aset untuk memudahkan pencarian, pelaporan, dan analisis kondisi stok."
        actions={
          canManage ? (
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Tambah kategori
            </Button>
          ) : null
        }
      />

      <div className="no-print mb-4">
        <FilterBar className="lg:grid-cols-[minmax(0,1fr)_auto]">
          <div>
            <label htmlFor="category-search" className="mb-1 block text-xs font-semibold text-slate-600">
              Pencarian
            </label>
            <SearchField
              value={query}
              onChange={(value) => {
                setQuery(value)
                setPage(1)
              }}
              placeholder="Cari nama atau keterangan kategori…"
              label="Cari kategori aset"
            />
          </div>
          {query ? (
            <div className="flex items-end">
              <Button
                variant="secondary"
                className="w-full sm:w-auto"
                onClick={() => {
                  setQuery('')
                  setPage(1)
                }}
              >
                Reset pencarian
              </Button>
            </div>
          ) : null}
        </FilterBar>
      </div>

      <Card>
        {categories.isError ? (
          <ErrorState
            title="Kategori belum dapat dimuat"
            description={getErrorMessage(categories.error)}
            onRetry={() => void categories.refetch()}
          />
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <p className="text-sm text-slate-600" aria-live="polite">
                {categories.isLoading ? 'Memuat kategori…' : `${formatNumber(meta?.total ?? 0)} kategori`}
              </p>
              {categories.isFetching && !categories.isLoading ? (
                <span className="text-xs text-slate-400">Memperbarui…</span>
              ) : null}
            </div>

            <Table caption="Daftar kategori aset" minWidth="min-w-[720px]">
              <THead>
                <TR>
                  <TH>Nama kategori</TH>
                  <TH>Keterangan</TH>
                  <TH className="text-right">Jumlah aset</TH>
                  <TH>Terakhir diperbarui</TH>
                  {canManage ? <TH className="text-right">Tindakan</TH> : null}
                </TR>
              </THead>
              <TBody>
                {categories.isLoading ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <TR key={`skeleton-${index}`}>
                      <TD colSpan={canManage ? 5 : 4}>
                        <span className="block h-5 animate-pulse rounded bg-slate-100" />
                      </TD>
                    </TR>
                  ))
                ) : rows.length === 0 ? (
                  <TableEmpty colSpan={canManage ? 5 : 4}>
                    <EmptyState
                      icon={<Tags className="h-6 w-6" aria-hidden="true" />}
                      title="Tidak ada kategori"
                      description={
                        query
                          ? 'Tidak ada kategori yang cocok dengan pencarian. Coba kata kunci lain.'
                          : 'Tambahkan kategori agar aset dapat diklasifikasikan dengan rapi.'
                      }
                      action={
                        canManage && !query ? (
                          <Button onClick={openCreate}>
                            <Plus className="h-4 w-4" aria-hidden="true" />
                            Tambah kategori
                          </Button>
                        ) : undefined
                      }
                    />
                  </TableEmpty>
                ) : (
                  rows.map((category) => (
                    <TR key={category.id}>
                      <TD>
                        <span className="font-medium text-slate-900">{category.name}</span>
                      </TD>
                      <TD className="max-w-[420px] text-sm text-slate-600">
                        {category.description ?? <span className="text-slate-400">Tidak ada keterangan</span>}
                      </TD>
                      <TD className="text-right">
                        <Badge tone={(category.assets_count ?? 0) > 0 ? 'primary' : 'neutral'}>
                          {formatNumber(category.assets_count ?? 0)} aset
                        </Badge>
                      </TD>
                      <TD className="text-sm whitespace-nowrap text-slate-500">
                        {formatDateTime(category.updated_at)}
                      </TD>
                      {canManage ? (
                        <TD>
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEdit(category)}
                              aria-label={`Ubah kategori ${category.name}`}
                              title="Ubah kategori"
                            >
                              <Pencil className="h-4 w-4" aria-hidden="true" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-red-700 hover:bg-red-50 hover:text-red-800"
                              onClick={() => setPendingDelete(category)}
                              aria-label={`Hapus kategori ${category.name}`}
                              title="Hapus kategori"
                            >
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                            </Button>
                          </div>
                        </TD>
                      ) : null}
                    </TR>
                  ))
                )}
              </TBody>
            </Table>
            <TableScrollHint />
            {meta ? <Pagination meta={meta} onChange={setPage} itemLabel="kategori" /> : null}
          </>
        )}
      </Card>

      <Modal
        open={formOpen}
        onClose={() => {
          setFormOpen(false)
          setEditing(null)
        }}
        title={editing ? 'Ubah kategori' : 'Tambah kategori'}
        description={
          editing
            ? 'Perubahan nama kategori akan terlihat pada seluruh aset dan laporan.'
            : 'Gunakan nama yang singkat dan konsisten agar mudah dipahami pengguna.'
        }
        size="md"
        preventClose={saveMutation.isPending}
      >
        {formError ? (
          <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {formError}
          </div>
        ) : null}
        <form
          id="category-form"
          onSubmit={handleSubmit((values) => {
            setFormError(null)
            saveMutation.mutate(values)
          })}
          noValidate
          className="space-y-4"
        >
          <Field label="Nama kategori" htmlFor="category-name" required error={errors.name?.message}>
            <Input
              id="category-name"
              autoComplete="off"
              placeholder="Alat Tulis Kantor"
              aria-invalid={errors.name ? true : undefined}
              {...register('name')}
            />
          </Field>
          <Field
            label="Keterangan"
            htmlFor="category-description"
            hint="Opsional. Jelaskan cakupan kategori ini."
            error={errors.description?.message}
          >
            <Textarea
              id="category-description"
              rows={3}
              placeholder="Kertas, alat tulis, dan kebutuhan administrasi harian…"
              aria-invalid={errors.description ? true : undefined}
              {...register('description')}
            />
          </Field>
        </form>
        <div className="mt-5 flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
          <Button
            variant="secondary"
            disabled={saveMutation.isPending}
            onClick={() => {
              setFormOpen(false)
              setEditing(null)
            }}
          >
            Batal
          </Button>
          <Button type="submit" form="category-form" loading={saveMutation.isPending}>
            {editing ? 'Simpan perubahan' : 'Simpan kategori'}
          </Button>
        </div>
      </Modal>

      <ConfirmDialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) deleteMutation.mutate(pendingDelete)
        }}
        loading={deleteMutation.isPending}
        title="Hapus kategori ini?"
        description={
          pendingDelete
            ? `${pendingDelete.name} akan dihapus permanen. Kategori yang masih dipakai aset tidak dapat dihapus.`
            : ''
        }
        confirmLabel="Hapus kategori"
        tone="danger"
      />
    </>
  )
}
