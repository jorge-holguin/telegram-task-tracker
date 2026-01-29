import { NextResponse } from "next/server"

export async function GET() {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  
  if (!botToken) {
    return NextResponse.json({ error: "No bot token" }, { status: 500 })
  }

  try {
    // Obtener información del bot
    const response = await fetch(`https://api.telegram.org/bot${botToken}/getMe`)
    const data = await response.json()
    
    if (data.ok) {
      return NextResponse.json({
        success: true,
        bot: data.result,
        message: "Bot token válido"
      })
    } else {
      return NextResponse.json({ error: data.description }, { status: 400 })
    }
  } catch (error) {
    return NextResponse.json({ error: "Error conectando con Telegram" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const { chatId, message } = await request.json()
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  
  if (!botToken) {
    return NextResponse.json({ error: "No bot token" }, { status: 500 })
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "Markdown",
      }),
    })
    
    const data = await response.json()
    
    if (data.ok) {
      return NextResponse.json({ success: true, result: data.result })
    } else {
      return NextResponse.json({ error: data.description }, { status: 400 })
    }
  } catch (error) {
    return NextResponse.json({ error: "Error enviando mensaje" }, { status: 500 })
  }
}
