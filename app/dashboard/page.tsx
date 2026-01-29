export const dynamic = "force-dynamic"

import { Suspense } from "react"
import { StatsCards } from "@/components/dashboard/stats-cards"
import { VideoForm } from "@/components/dashboard/video-form"
import { TareasTable } from "@/components/dashboard/tareas-table"
import { getEstadisticas, getMonitorTareas } from "@/app/actions/tareas"
import { getVideos } from "@/app/actions/videos"
import { getPerfiles } from "@/app/actions/perfiles"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, ListChecks } from "lucide-react"

async function DashboardContent() {
  const [stats, tareas, videos, perfiles] = await Promise.all([
    getEstadisticas(),
    getMonitorTareas(),
    getVideos(),
    getPerfiles(),
  ])

  return (
    <div className="space-y-6">
      <StatsCards stats={stats} />
      
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <VideoForm />
        </div>
        
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ListChecks className="h-5 w-5" />
                Monitor de Seguimiento
              </CardTitle>
              <CardDescription>
                Gestiona las evidencias y el cumplimiento de los usuarios
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TareasTable
                tareas={tareas}
                videos={videos}
                perfiles={perfiles}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  )
}

export default function DashboardPage() {
  return (
    <div className="container py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Gestiona videos y supervisa el cumplimiento de los trabajadores
        </p>
      </div>
      
      <Suspense fallback={<LoadingState />}>
        <DashboardContent />
      </Suspense>
    </div>
  )
}
