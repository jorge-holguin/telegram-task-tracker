"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, Video, Clock, CheckCircle, TrendingUp } from "lucide-react"
import type { VistaEstadisticas } from "@/types/database"

interface StatsCardsProps {
  stats: VistaEstadisticas
}

export function StatsCards({ stats }: StatsCardsProps) {
  const cards = [
    {
      title: "Cumplimiento Total",
      value: `${stats.porcentaje_cumplimiento}%`,
      icon: TrendingUp,
      description: "Porcentaje de tareas completadas",
      color: "text-green-500",
    },
    {
      title: "Usuarios Activos",
      value: stats.usuarios_activos,
      icon: Users,
      description: "Usuarios registrados",
      color: "text-blue-500",
    },
    {
      title: "Videos Activos",
      value: stats.videos_activos,
      icon: Video,
      description: "Videos disponibles",
      color: "text-purple-500",
    },
    {
      title: "Tareas Pendientes",
      value: stats.tareas_pendientes,
      icon: Clock,
      description: "Evidencias por recibir",
      color: "text-yellow-500",
    },
    {
      title: "Tareas Completadas",
      value: stats.tareas_completadas,
      icon: CheckCircle,
      description: "Evidencias recibidas",
      color: "text-emerald-500",
    },
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
            <card.icon className={`h-4 w-4 ${card.color}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{card.value}</div>
            <p className="text-xs text-muted-foreground">{card.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
