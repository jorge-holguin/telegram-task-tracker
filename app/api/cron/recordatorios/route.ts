import { NextRequest, NextResponse } from "next/server"
import { enviarRecordatorios } from "@/app/actions/telegram"

async function handleCron(request: NextRequest) {
  const authHeader = request.headers.get("authorization")
  
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  
  try {
    const result = await enviarRecordatorios()
    return NextResponse.json(result)
  } catch (error) {
    console.error("Error en cron de recordatorios:", error)
    return NextResponse.json(
      { error: "Error enviando recordatorios" },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  return handleCron(request)
}

export async function POST(request: NextRequest) {
  return handleCron(request)
}

export const dynamic = "force-dynamic"
