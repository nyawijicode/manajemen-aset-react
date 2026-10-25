import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Boxes,
  CheckCircle2,
  ClipboardCheck,
  Download,
  Package,
  Scale,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AssetCombobox } from "../components/ui/AssetCombobox";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { ErrorState, LoadingState } from "../components/ui/Feedback";
import { FilterBar, SearchField } from "../components/ui/Filters";
import { Input, Select } from "../components/ui/Form";
import { PageHeader } from "../components/ui/PageHeader";
import { Pagination } from "../components/ui/Pagination";
import { StatCard } from "../components/ui/StatCard";
import { api, buildQuery, downloadFile, getErrorMessage } from "../lib/api";
import {
  formatDate,
  formatDifference,
  formatNumber,
  todayIso,
} from "../lib/format";
import { useDebouncedValue, useDocumentTitle } from "../lib/hooks";
import { useToast } from "../lib/toast";
import type {
  Asset,
  AssetIn,
  AssetOut,
  AssetReportSummary,
  Category,
  OpnameReportSummary,
  Paginated,
  ReportResponse,
  StockOpname,
  StockOpnameReportRow,
  TransactionReportSummary,
} from "../types/api";

export type ReportKind = "assets" | "in" | "out" | "opname";

type ReportRow = Asset | AssetIn | AssetOut | StockOpnameReportRow;
type ReportSummary =
  | AssetReportSummary
  | TransactionReportSummary
  | OpnameReportSummary;

const PER_PAGE = 1000;

const REPORT_COPY: Record<
  ReportKind,
  { title: string; description: string; endpoint: string; filePrefix: string }
> = {
  assets: {
    title: "Laporan Inventaris Aset",
    description:
      "Rekapitulasi master aset, saldo stok, batas minimum, penggunaan serial number, dan status keaktifan.",
    endpoint: "/reports/assets",
    filePrefix: "laporan-inventaris-aset",
  },
  in: {
    title: "Laporan Aset Masuk",
    description:
      "Rekapitulasi penerimaan aset pada rentang tanggal tertentu beserta sumber pengadaan dan pencatatnya.",
    endpoint: "/reports/asset-ins",
    filePrefix: "laporan-aset-masuk",
  },
  out: {
    title: "Laporan Aset Keluar",
    description:
      "Rekapitulasi pengeluaran aset beserta penerima, serial number terkait, dan pengguna yang mencatat.",
    endpoint: "/reports/asset-outs",
    filePrefix: "laporan-aset-keluar",
  },
  opname: {
    title: "Laporan Stock Opname",
    description:
      "Perbandingan stok sistem dan hasil hitung fisik per baris opname, lengkap dengan selisih dan petugas pengesah.",
    endpoint: "/reports/stock-opnames",
    filePrefix: "laporan-stock-opname",
  },
};

const TABS: Array<{ kind: ReportKind; label: string; to: string }> = [
  { kind: "assets", label: "Inventaris", to: "/laporan/aset" },
  { kind: "in", label: "Aset masuk", to: "/laporan/masuk" },
  { kind: "out", label: "Aset keluar", to: "/laporan/keluar" },
  { kind: "opname", label: "Stock opname", to: "/laporan/opname" },
];

function normalizeReport(payload: ReportResponse<ReportRow, ReportSummary>) {
  const { meta } = payload;
  const rowsBefore = (meta.current_page - 1) * meta.per_page;

  return {
    ...payload,
    meta: {
      ...meta,
      from: meta.from ?? (meta.total === 0 ? null : rowsBefore + 1),
      to:
        meta.to ??
        (meta.total === 0
          ? null
          : Math.min(rowsBefore + meta.per_page, meta.total)),
    },
  };
}

export function ReportsPage({ kind }: { kind: ReportKind }) {
  const copy = REPORT_COPY[kind];
  useDocumentTitle(copy.title);
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [downloading, setDownloading] = useState(false);

  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 350);
  const [categoryId, setCategoryId] = useState("");
  const [serialFilter, setSerialFilter] = useState("all");
  const [stockStatus, setStockStatus] = useState("all");
  const [activeFilter, setActiveFilter] = useState("all");
  const [asset, setAsset] = useState<Asset | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [opnameStatus, setOpnameStatus] = useState("all");
  const [opnameId, setOpnameId] = useState(
    searchParams.get("stock_opname_id") ?? "",
  );

  const buildReportParams = (): Record<string, unknown> =>
    kind === "assets"
      ? {
          q: debouncedQuery,
          category_id: categoryId,
          has_serial_number:
            serialFilter === "yes"
              ? true
              : serialFilter === "no"
                ? false
                : undefined,
          stock_status: stockStatus,
          is_active:
            activeFilter === "active"
              ? true
              : activeFilter === "inactive"
                ? false
                : undefined,
        }
      : kind === "opname"
        ? {
            stock_opname_id: opnameId,
            status: opnameStatus,
            date_from: dateFrom,
            date_to: dateTo,
          }
        : {
            q: debouncedQuery,
            asset_id: asset?.id,
            date_from: dateFrom,
            date_to: dateTo,
          };

  const categories = useQuery({
    queryKey: ["categories", "options"],
    queryFn: () => api<Paginated<Category>>("/categories?per_page=100"),
    enabled: kind === "assets",
    staleTime: 60_000,
  });

  const opnames = useQuery({
    queryKey: ["stock-opnames", "report-options"],
    queryFn: () => api<Paginated<StockOpname>>("/stock-opnames?per_page=100"),
    enabled: kind === "opname",
    staleTime: 60_000,
  });

  const report = useQuery({
    queryKey: [
      "reports",
      kind,
      debouncedQuery,
      categoryId,
      serialFilter,
      stockStatus,
      activeFilter,
      asset?.id ?? null,
      dateFrom,
      dateTo,
      opnameStatus,
      opnameId,
      page,
    ],
    queryFn: async () => {
      const payload = await api<ReportResponse<ReportRow, ReportSummary>>(
        `${copy.endpoint}${buildQuery({ ...buildReportParams(), page, per_page: PER_PAGE })}`,
      );

      return normalizeReport(payload);
    },
  });

  const data = report.data;
  const rows = data?.data ?? [];

  const selectedCategory = categories.data?.data.find(
    (category) => String(category.id) === categoryId,
  );
  const selectedOpname = opnames.data?.data.find(
    (opname) => String(opname.id) === opnameId,
  );

  const filters: Array<{ label: string; value: string }> = [];

  if (kind === "assets") {
    if (query.trim()) filters.push({ label: "Pencarian", value: query.trim() });
    if (selectedCategory)
      filters.push({ label: "Kategori", value: selectedCategory.name });
    if (serialFilter !== "all") {
      filters.push({
        label: "Serial number",
        value: serialFilter === "yes" ? "Menggunakan serial" : "Tanpa serial",
      });
    }
    if (stockStatus !== "all") {
      const labels: Record<string, string> = {
        critical: "Stok kritis",
        empty: "Stok kosong",
        normal: "Stok normal",
      };
      filters.push({
        label: "Kondisi stok",
        value: labels[stockStatus] ?? stockStatus,
      });
    }
    if (activeFilter !== "all") {
      filters.push({
        label: "Status aset",
        value: activeFilter === "active" ? "Aktif" : "Nonaktif",
      });
    }
  } else if (kind === "opname") {
    if (opnameId) {
      filters.push({
        label: "Sesi opname",
        value: selectedOpname?.reference ?? `#${opnameId}`,
      });
    }
    if (opnameStatus !== "all") {
      filters.push({
        label: "Status",
        value: opnameStatus === "draft" ? "Draf" : "Disahkan",
      });
    }
    if (dateFrom)
      filters.push({ label: "Dari tanggal", value: formatDate(dateFrom) });
    if (dateTo)
      filters.push({ label: "Sampai tanggal", value: formatDate(dateTo) });
  } else {
    if (query.trim()) filters.push({ label: "Pencarian", value: query.trim() });
    if (asset)
      filters.push({ label: "Aset", value: `${asset.code} — ${asset.name}` });
    if (dateFrom)
      filters.push({ label: "Dari tanggal", value: formatDate(dateFrom) });
    if (dateTo)
      filters.push({ label: "Sampai tanggal", value: formatDate(dateTo) });
  }

  const resetFilters = () => {
    setQuery("");
    setCategoryId("");
    setSerialFilter("all");
    setStockStatus("all");
    setActiveFilter("all");
    setAsset(null);
    setDateFrom("");
    setDateTo("");
    setOpnameStatus("all");
    setOpnameId("");
    setPage(1);
  };

  const handleDownloadPdf = async () => {
    setDownloading(true);
    try {
      const filename = await downloadFile(
        `${copy.endpoint}/pdf${buildQuery(buildReportParams())}`,
        `${copy.filePrefix}-${todayIso()}.pdf`,
      );
      toast("success", "PDF berhasil dibuat", `${filename} telah diunduh.`);
    } catch (error) {
      toast("error", "PDF gagal dibuat", getErrorMessage(error));
    } finally {
      setDownloading(false);
    }
  };

  const summaryCards = !data
    ? []
    : kind === "assets"
      ? buildAssetSummary(data.summary as AssetReportSummary)
      : kind === "opname"
        ? buildOpnameSummary(data.summary as OpnameReportSummary)
        : buildTransactionSummary(
            data.summary as TransactionReportSummary,
            kind,
          );

  return (
    <>
      <PageHeader
        title={copy.title}
        description={copy.description}
        actions={
          <Button
            variant="primary"
            loading={downloading}
            onClick={() => void handleDownloadPdf()}
          >
            {downloading ? null : (
              <Download className="h-4 w-4" aria-hidden="true" />
            )}
            {downloading ? "Menyiapkan PDF…" : "Unduh PDF"}
          </Button>
        }
      />

      <nav aria-label="Jenis laporan" className="mb-5 overflow-x-auto">
        <div className="inline-flex min-w-full gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-card sm:min-w-0">
          {TABS.map((tab) => (
            <Link
              key={tab.kind}
              to={tab.to}
              aria-current={kind === tab.kind ? "page" : undefined}
              className={
                kind === tab.kind
                  ? "inline-flex min-h-10 flex-1 items-center justify-center rounded-lg bg-primary-700 px-3 text-sm font-semibold whitespace-nowrap text-white"
                  : "inline-flex min-h-10 flex-1 items-center justify-center rounded-lg px-3 text-sm font-medium whitespace-nowrap text-slate-600 hover:bg-slate-100 hover:text-slate-950"
              }
            >
              {tab.label}
            </Link>
          ))}
        </div>
      </nav>

      <div className="mb-4">
        <FilterBar>
          {kind === "assets" ? (
            <>
              <div className="sm:col-span-2">
                <label
                  htmlFor="report-search"
                  className="mb-1 block text-xs font-semibold text-slate-600"
                >
                  Pencarian
                </label>
                <SearchField
                  value={query}
                  onChange={(value) => {
                    setQuery(value);
                    setPage(1);
                  }}
                  placeholder="Cari kode atau nama aset…"
                  label="Cari aset pada laporan"
                />
              </div>

              <div>
                <label
                  htmlFor="report-category"
                  className="mb-1 block text-xs font-semibold text-slate-600"
                >
                  Kategori
                </label>
                <Select
                  id="report-category"
                  value={categoryId}
                  onChange={(event) => {
                    setCategoryId(event.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">Semua kategori</option>
                  {categories.data?.data.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <label
                  htmlFor="report-stock"
                  className="mb-1 block text-xs font-semibold text-slate-600"
                >
                  Kondisi stok
                </label>
                <Select
                  id="report-stock"
                  value={stockStatus}
                  onChange={(event) => {
                    setStockStatus(event.target.value);
                    setPage(1);
                  }}
                >
                  <option value="all">Semua stok</option>
                  <option value="critical">Kritis</option>
                  <option value="empty">Stok kosong</option>
                  <option value="normal">Stok normal</option>
                </Select>
              </div>

              <div>
                <label
                  htmlFor="report-serial"
                  className="mb-1 block text-xs font-semibold text-slate-600"
                >
                  Serial number
                </label>
                <Select
                  id="report-serial"
                  value={serialFilter}
                  onChange={(event) => {
                    setSerialFilter(event.target.value);
                    setPage(1);
                  }}
                >
                  <option value="all">Semua aset</option>
                  <option value="yes">Menggunakan serial</option>
                  <option value="no">Tanpa serial</option>
                </Select>
              </div>

              <div>
                <label
                  htmlFor="report-active"
                  className="mb-1 block text-xs font-semibold text-slate-600"
                >
                  Status aset
                </label>
                <Select
                  id="report-active"
                  value={activeFilter}
                  onChange={(event) => {
                    setActiveFilter(event.target.value);
                    setPage(1);
                  }}
                >
                  <option value="all">Semua status</option>
                  <option value="active">Aktif</option>
                  <option value="inactive">Nonaktif</option>
                </Select>
              </div>

              <div className="flex items-end">
                <Button
                  variant="secondary"
                  onClick={resetFilters}
                  className="w-full"
                >
                  Reset filter
                </Button>
              </div>
            </>
          ) : kind === "opname" ? (
            <>
              <div className="sm:col-span-2">
                <label
                  htmlFor="report-opname-session"
                  className="mb-1 block text-xs font-semibold text-slate-600"
                >
                  Sesi opname
                </label>
                <Select
                  id="report-opname-session"
                  value={opnameId}
                  onChange={(event) => {
                    setOpnameId(event.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">Semua sesi</option>
                  {opnames.data?.data.map((opname) => (
                    <option key={opname.id} value={opname.id}>
                      {opname.reference} — {formatDate(opname.opname_date)} (
                      {opname.status_label})
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <label
                  htmlFor="report-opname-status"
                  className="mb-1 block text-xs font-semibold text-slate-600"
                >
                  Status
                </label>
                <Select
                  id="report-opname-status"
                  value={opnameStatus}
                  onChange={(event) => {
                    setOpnameStatus(event.target.value);
                    setPage(1);
                  }}
                >
                  <option value="all">Semua status</option>
                  <option value="draft">Draf</option>
                  <option value="finalized">Disahkan</option>
                </Select>
              </div>

              <div>
                <label
                  htmlFor="report-opname-from"
                  className="mb-1 block text-xs font-semibold text-slate-600"
                >
                  Dari tanggal
                </label>
                <Input
                  id="report-opname-from"
                  type="date"
                  value={dateFrom}
                  max={dateTo || todayIso()}
                  onChange={(event) => {
                    setDateFrom(event.target.value);
                    setPage(1);
                  }}
                />
              </div>

              <div>
                <label
                  htmlFor="report-opname-to"
                  className="mb-1 block text-xs font-semibold text-slate-600"
                >
                  Sampai tanggal
                </label>
                <Input
                  id="report-opname-to"
                  type="date"
                  value={dateTo}
                  min={dateFrom}
                  max={todayIso()}
                  onChange={(event) => {
                    setDateTo(event.target.value);
                    setPage(1);
                  }}
                />
              </div>

              <div className="flex items-end sm:col-span-2">
                <Button
                  variant="secondary"
                  onClick={resetFilters}
                  className="w-full sm:w-auto"
                >
                  Reset filter
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="sm:col-span-2">
                <label
                  htmlFor="report-tx-search"
                  className="mb-1 block text-xs font-semibold text-slate-600"
                >
                  Pencarian
                </label>
                <SearchField
                  value={query}
                  onChange={(value) => {
                    setQuery(value);
                    setPage(1);
                  }}
                  placeholder={`Cari referensi atau ${kind === "in" ? "supplier" : "penerima"}…`}
                  label={`Cari transaksi pada laporan ${kind === "in" ? "aset masuk" : "aset keluar"}`}
                />
              </div>

              <div className="sm:col-span-2">
                <label
                  htmlFor="report-tx-asset"
                  className="mb-1 block text-xs font-semibold text-slate-600"
                >
                  Aset
                </label>
                <AssetCombobox
                  id="report-tx-asset"
                  selected={asset}
                  onSelect={(value) => {
                    setAsset(value);
                    setPage(1);
                  }}
                  onlyActive={false}
                  placeholder="Semua aset"
                />
              </div>

              <div>
                <label
                  htmlFor="report-tx-from"
                  className="mb-1 block text-xs font-semibold text-slate-600"
                >
                  Dari tanggal
                </label>
                <Input
                  id="report-tx-from"
                  type="date"
                  value={dateFrom}
                  max={dateTo || todayIso()}
                  onChange={(event) => {
                    setDateFrom(event.target.value);
                    setPage(1);
                  }}
                />
              </div>

              <div>
                <label
                  htmlFor="report-tx-to"
                  className="mb-1 block text-xs font-semibold text-slate-600"
                >
                  Sampai tanggal
                </label>
                <Input
                  id="report-tx-to"
                  type="date"
                  value={dateTo}
                  min={dateFrom}
                  max={todayIso()}
                  onChange={(event) => {
                    setDateTo(event.target.value);
                    setPage(1);
                  }}
                />
              </div>

              <div className="flex items-end sm:col-span-2">
                <Button
                  variant="secondary"
                  onClick={resetFilters}
                  className="w-full sm:w-auto"
                >
                  Reset filter
                </Button>
              </div>
            </>
          )}
        </FilterBar>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
          Filter aktif
        </span>
        {filters.length === 0 ? (
          <Badge tone="neutral">Seluruh data</Badge>
        ) : (
          filters.map((filter) => (
            <Badge key={`${filter.label}-${filter.value}`} tone="primary">
              {filter.label}: {filter.value}
            </Badge>
          ))
        )}
      </div>

      {report.isError ? (
        <Card>
          <ErrorState
            title={`${copy.title} belum dapat dimuat`}
            description={getErrorMessage(report.error)}
            onRetry={() => void report.refetch()}
          />
        </Card>
      ) : report.isLoading ? (
        <Card>
          <LoadingState label="Menyiapkan laporan…" />
        </Card>
      ) : (
        <>
          {summaryCards.length > 0 ? (
            <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
              {summaryCards.map((card) => (
                <StatCard
                  key={card.label}
                  label={card.label}
                  value={card.value}
                  hint={card.hint}
                  icon={card.icon}
                  tone={card.tone}
                />
              ))}
            </div>
          ) : null}

          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              {kind === "assets" ? (
                <AssetReportTable rows={rows as Asset[]} />
              ) : kind === "opname" ? (
                <OpnameReportTable rows={rows as StockOpnameReportRow[]} />
              ) : (
                <TransactionReportTable
                  rows={rows as Array<AssetIn | AssetOut>}
                  kind={kind}
                />
              )}
            </div>

            <div className="flex flex-col gap-1 border-t border-slate-200 px-4 py-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
              <p>
                {formatNumber(data?.meta.total ?? 0)} baris sesuai filter · PDF
                memuat maksimum {formatNumber(PER_PAGE)} baris pertama.
              </p>
              <p>
                Persempit filter bila laporan lebih panjang dari batas tersebut.
              </p>
            </div>

            {data ? (
              <Pagination
                meta={data.meta}
                onChange={setPage}
                itemLabel="baris"
              />
            ) : null}
          </Card>
        </>
      )}
    </>
  );
}

interface SummaryCardItem {
  label: string;
  value: string;
  hint?: string;
  icon: typeof Boxes;
  tone: "neutral" | "primary" | "warning" | "success" | "info";
}

function buildAssetSummary(summary: AssetReportSummary): SummaryCardItem[] {
  return [
    {
      label: "Total aset",
      value: formatNumber(summary.total_assets),
      icon: Boxes,
      tone: "primary",
    },
    {
      label: "Total unit stok",
      value: formatNumber(summary.total_stock),
      icon: Package,
      tone: "info",
    },
    {
      label: "Stok kritis",
      value: formatNumber(summary.critical_assets),
      hint: "Aset aktif pada atau di bawah minimum",
      icon: AlertTriangle,
      tone: summary.critical_assets > 0 ? "warning" : "success",
    },
  ];
}

function buildTransactionSummary(
  summary: TransactionReportSummary,
  kind: ReportKind,
): SummaryCardItem[] {
  return [
    {
      label: "Jumlah transaksi",
      value: formatNumber(summary.transactions),
      icon: kind === "in" ? ArrowDownToLine : ArrowUpFromLine,
      tone: kind === "in" ? "success" : "warning",
    },
    {
      label: "Total unit",
      value: formatNumber(summary.total_qty),
      hint:
        kind === "in"
          ? "Unit aset yang diterima"
          : "Unit aset yang dikeluarkan",
      icon: Package,
      tone: "primary",
    },
  ];
}

function buildOpnameSummary(summary: OpnameReportSummary): SummaryCardItem[] {
  return [
    {
      label: "Baris opname",
      value: formatNumber(summary.items),
      icon: ClipboardCheck,
      tone: "primary",
    },
    {
      label: "Sesuai",
      value: formatNumber(summary.match),
      icon: CheckCircle2,
      tone: "success",
    },
    {
      label: "Lebih",
      value: formatNumber(summary.more),
      icon: TrendingUp,
      tone: "info",
    },
    {
      label: "Kurang",
      value: formatNumber(summary.less),
      icon: TrendingDown,
      tone: "warning",
    },
    {
      label: "Selisih bersih",
      value: formatDifference(summary.net_difference),
      hint: "Fisik dikurangi stok sistem",
      icon: Scale,
      tone: summary.net_difference === 0 ? "neutral" : "warning",
    },
  ];
}

function ReportEmptyRow({ colSpan }: { colSpan: number }) {
  return (
    <tr>
      <td
        colSpan={colSpan}
        className="px-4 py-10 text-center text-sm text-slate-500"
      >
        Tidak ada data yang sesuai dengan filter laporan.
      </td>
    </tr>
  );
}

function AssetReportTable({ rows }: { rows: Asset[] }) {
  return (
    <table className="report-table min-w-[980px]">
      <caption className="sr-only">Laporan inventaris aset</caption>
      <thead>
        <tr>
          <th scope="col">Kode</th>
          <th scope="col">Nama aset</th>
          <th scope="col">Kategori</th>
          <th scope="col">Satuan</th>
          <th scope="col" className="text-right">
            Stok
          </th>
          <th scope="col" className="text-right">
            Minimum
          </th>
          <th scope="col">Serial number</th>
          <th scope="col">Status</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <ReportEmptyRow colSpan={8} />
        ) : (
          rows.map((asset) => (
            <tr key={asset.id}>
              <td className="font-mono text-xs whitespace-nowrap">
                {asset.code}
              </td>
              <td className="font-medium text-slate-900">{asset.name}</td>
              <td>{asset.category?.name ?? "—"}</td>
              <td>{asset.unit}</td>
              <td className="text-right tabular-nums">
                {formatNumber(asset.stock)}
              </td>
              <td className="text-right tabular-nums">
                {formatNumber(asset.minimum_stock)}
              </td>
              <td>
                {asset.has_serial_number
                  ? `${formatNumber(asset.available_serial_numbers_count ?? 0)} tersedia / ${formatNumber(asset.serial_numbers_count ?? 0)}`
                  : "Tidak digunakan"}
              </td>
              <td>
                {asset.is_active ? "Aktif" : "Nonaktif"}
                {asset.is_active && asset.is_critical ? " · Stok kritis" : ""}
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

function TransactionReportTable({
  rows,
  kind,
}: {
  rows: Array<AssetIn | AssetOut>;
  kind: "in" | "out";
}) {
  return (
    <table className="report-table min-w-[1040px]">
      <caption className="sr-only">
        Laporan aset {kind === "in" ? "masuk" : "keluar"}
      </caption>
      <thead>
        <tr>
          <th scope="col">Tanggal</th>
          <th scope="col">Referensi</th>
          <th scope="col">Aset</th>
          <th scope="col">Kategori</th>
          <th scope="col" className="text-right">
            Jumlah
          </th>
          <th scope="col">
            {kind === "in" ? "Sumber / supplier" : "Penerima / unit"}
          </th>
          <th scope="col" className="text-right">
            Serial
          </th>
          <th scope="col">Dicatat oleh</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <ReportEmptyRow colSpan={8} />
        ) : (
          rows.map((row) => {
            const serialCount =
              kind === "out"
                ? ((row as AssetOut).serial_numbers?.length ?? 0)
                : row.asset?.has_serial_number
                  ? row.qty
                  : 0;

            return (
              <tr key={row.id}>
                <td className="whitespace-nowrap">
                  {formatDate(row.transaction_date)}
                </td>
                <td className="font-mono text-xs whitespace-nowrap">
                  {row.reference}
                </td>
                <td>
                  <span className="font-medium text-slate-900">
                    {row.asset?.name ?? "—"}
                  </span>
                  <span className="mt-0.5 block font-mono text-[11px] text-slate-500">
                    {row.asset?.code ?? ""}
                  </span>
                </td>
                <td>{row.asset?.category?.name ?? "—"}</td>
                <td className="text-right tabular-nums">
                  {formatNumber(row.qty)} {row.asset?.unit ?? ""}
                </td>
                <td>
                  {kind === "in"
                    ? (row as AssetIn).supplier_or_source
                    : (row as AssetOut).recipient}
                </td>
                <td className="text-right tabular-nums">
                  {serialCount > 0 ? formatNumber(serialCount) : "—"}
                </td>
                <td>{row.creator?.name ?? "—"}</td>
              </tr>
            );
          })
        )}
      </tbody>
    </table>
  );
}

function OpnameReportTable({ rows }: { rows: StockOpnameReportRow[] }) {
  return (
    <table className="report-table min-w-[1120px]">
      <caption className="sr-only">Laporan stock opname</caption>
      <thead>
        <tr>
          <th scope="col">Sesi</th>
          <th scope="col">Tanggal</th>
          <th scope="col">Status</th>
          <th scope="col">Aset</th>
          <th scope="col">Kategori</th>
          <th scope="col" className="text-right">
            Stok sistem
          </th>
          <th scope="col" className="text-right">
            Fisik
          </th>
          <th scope="col" className="text-right">
            Selisih
          </th>
          <th scope="col">Petugas</th>
          <th scope="col">Catatan</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <ReportEmptyRow colSpan={10} />
        ) : (
          rows.map((row) => (
            <tr key={row.id}>
              <td className="font-mono text-xs whitespace-nowrap">
                {row.reference}
              </td>
              <td className="whitespace-nowrap">
                {formatDate(row.opname_date)}
              </td>
              <td>{row.status_label}</td>
              <td>
                <span className="font-medium text-slate-900">
                  {row.asset_name}
                </span>
                <span className="mt-0.5 block font-mono text-[11px] text-slate-500">
                  {row.asset_code}
                </span>
              </td>
              <td>{row.category ?? "—"}</td>
              <td className="text-right tabular-nums">
                {formatNumber(row.system_qty)} {row.unit}
              </td>
              <td className="text-right tabular-nums">
                {row.physical_qty === null
                  ? "Belum diisi"
                  : `${formatNumber(row.physical_qty)} ${row.unit}`}
              </td>
              <td className="text-right tabular-nums">
                {formatDifference(row.difference)}
              </td>
              <td>{row.approved_by ?? "—"}</td>
              <td className="max-w-[220px]">{row.notes ?? "—"}</td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
