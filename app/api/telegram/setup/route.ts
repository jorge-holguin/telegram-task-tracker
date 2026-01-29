import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  
  if (!botToken || !appUrl) {
    return NextResponse.json(
      { error: "Missing TELEGRAM_BOT_TOKEN or NEXT_PUBLIC_APP_URL" },
      { status: 500 }
    )
  }
  
  const webhookUrl = `${appUrl}/api/telegram/webhook`
  
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/setWebhook`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: webhookUrl,
          allowed_updates: ["message"],
        }),
      }
    )
    
    const data = await response.json()
    
    if (data.ok) {
      return NextResponse.json({
        success: true,
        message: `Webhook configurado: ${webhookUrl}`,
      })
    } else {
      return NextResponse.json(
        { error: data.description },
        { status: 400 }
      )
    }
  } catch (error) {
    return NextResponse.json(
      { error: "Error configurando webhook" },
      { status: 500 }
    )
  }
}

export async function GET() {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  
  if (!botToken) {
    return NextResponse.json(
      { error: "Missing TELEGRAM_BOT_TOKEN" },
      { status: 500 }
    )
  }
  
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/getWebhookInfo`
    )
    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      { error: "Error obteniendo info del webhook" },
      { status: 500 }
    )
  }
}
