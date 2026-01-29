"use client"

import { useState, useMemo } from "react"
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
} from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select } from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  ArrowUpDown,
  Eye,
  XCircle,
  Download,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { formatDate } from "@/lib/utils"
import { rechazarEvidencia, exportarCSV } from "@/app/actions/tareas"
import type { VistaMonitorTareas } from "@/types/database"
import type { Video, Perfil } from "@/types/database"

interface TareasTableProps {
  tareas: VistaMonitorTareas[]
  videos: Video[]
  perfiles: Perfil[]
}

export function TareasTable({ tareas, videos, perfiles }: TareasTableProps) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = useState("")
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [estadoFilter, setEstadoFilter] = useState("todos")
  const [videoFilter, setVideoFilter] = useState("todos")
  const [perfilFilter, setPerfilFilter] = useState("todos")

  const filteredData = useMemo(() => {
    let result = tareas

    if (estadoFilter !== "todos") {
      result = result.filter((t) => t.estado === estadoFilter)
    }

    if (videoFilter !== "todos") {
      result = result.filter((t) => t.video_id === videoFilter)
    }

    if (perfilFilter !== "todos") {
      result = result.filter((t) => t.perfil_id === perfilFilter)
    }

    return result
  }, [tareas, estadoFilter, videoFilter, perfilFilter])

  const columns: ColumnDef<VistaMonitorTareas>[] = [
    {
      accessorKey: "nombre_completo",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Usuario
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
    },
    {
      accessorKey: "video_titulo",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Video
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
    },
    {
      accessorKey: "estado",
      header: "Estado",
      cell: ({ row }) => {
        const estado = row.getValue("estado") as string
        return (
          <Badge variant={estado === "COMPLETADO" ? "success" : "warning"}>
            {estado}
          </Badge>
        )
      },
    },
    {
      accessorKey: "fecha_asignacion",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Asignación
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const fecha = row.getValue("fecha_asignacion") as string
        return fecha ? formatDate(fecha) : "-"
      },
    },
    {
      accessorKey: "fecha_entrega",
      header: "Entrega",
      cell: ({ row }) => {
        const fecha = row.getValue("fecha_entrega") as string | null
        return fecha ? formatDate(fecha) : "-"
      },
    },
    {
      id: "acciones",
      header: "Acciones",
      cell: ({ row }) => {
        const tarea = row.original
        return (
          <div className="flex gap-2">
            {tarea.url_evidencia && (
              <Button
                variant="outline"
                size="icon"
                onClick={() => setSelectedImage(tarea.url_evidencia)}
                title="Ver evidencia"
              >
                <Eye className="h-4 w-4" />
              </Button>
            )}
            {tarea.estado === "COMPLETADO" && (
              <Button
                variant="destructive"
                size="icon"
                onClick={() => handleRechazar(tarea.tarea_id, tarea.telegram_id)}
                title="Rechazar evidencia"
              >
                <XCircle className="h-4 w-4" />
              </Button>
            )}
          </div>
        )
      },
    },
  ]

  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    state: {
      sorting,
      columnFilters,
      globalFilter,
    },
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  })

  async function handleRechazar(tareaId: string, telegramId: number) {
    if (confirm("¿Rechazar esta evidencia? El usuario será notificado.")) {
      await rechazarEvidencia(tareaId, telegramId)
    }
  }

  async function handleExportar() {
    const csv = await exportarCSV()
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `reporte-tareas-${new Date().toISOString().split("T")[0]}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="max-w-sm"
          />
        </div>
        
        <div className="flex flex-wrap gap-2">
          <Select
            options={[
              { value: "todos", label: "Todos los estados" },
              { value: "PENDIENTE", label: "Pendiente" },
              { value: "COMPLETADO", label: "Completado" },
            ]}
            value={estadoFilter}
            onChange={(e) => setEstadoFilter(e.target.value)}
          />
          
          <Select
            options={[
              { value: "todos", label: "Todos los videos" },
              ...videos.map((v) => ({ value: v.id, label: v.titulo })),
            ]}
            value={videoFilter}
            onChange={(e) => setVideoFilter(e.target.value)}
          />
          
          <Select
            options={[
              { value: "todos", label: "Todos los usuarios" },
              ...perfiles.map((p) => ({ value: p.id, label: p.nombre_completo })),
            ]}
            value={perfilFilter}
            onChange={(e) => setPerfilFilter(e.target.value)}
          />
          
          <Button variant="outline" onClick={handleExportar}>
            <Download className="mr-2 h-4 w-4" />
            Exportar CSV
          </Button>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No hay resultados.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Mostrando {table.getRowModel().rows.length} de {filteredData.length} tareas
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeft className="h-4 w-4" />
            Anterior
          </Button>
          <span className="text-sm">
            Página {table.getState().pagination.pageIndex + 1} de{" "}
            {table.getPageCount()}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Siguiente
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Evidencia</DialogTitle>
            <DialogDescription>
              Captura de pantalla enviada por el usuario
            </DialogDescription>
          </DialogHeader>
          {selectedImage && (
            <div className="flex justify-center">
              <img
                src={selectedImage}
                alt="Evidencia"
                className="max-h-[70vh] object-contain rounded-md"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
