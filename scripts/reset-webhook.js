#!/usr/bin/env node

/**
 * Script para resetear el webhook de Telegram
 * Elimina el webhook, limpia la cola y lo vuelve a configurar
 */

// Cargar variables de entorno desde .env.local
require('dotenv').config({ path: '.env.local' })

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const WEBHOOK_URL = process.env.VERCEL_URL || 'https://telegram-task-tracker.vercel.app'

if (!BOT_TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN no configurado')
  process.exit(1)
}

async function resetWebhook() {
  console.log('🔄 Eliminando webhook y limpiando cola...')
  
  // Eliminar webhook y cola
  const deleteUrl = `https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook?drop_pending_updates=true`
  const deleteResponse = await fetch(deleteUrl)
  const deleteData = await deleteResponse.json()
  
  if (!deleteData.ok) {
    console.error('❌ Error eliminando webhook:', deleteData)
    process.exit(1)
  }
  
  console.log('✅ Webhook eliminado y cola limpiada')
  
  // Esperar 2 segundos
  console.log('⏳ Esperando 2 segundos...')
  await new Promise(resolve => setTimeout(resolve, 2000))
  
  // Configurar nuevo webhook
  console.log(`🔧 Configurando webhook: ${WEBHOOK_URL}/api/telegram/webhook`)
  
  const setUrl = `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`
  const setResponse = await fetch(setUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: `${WEBHOOK_URL}/api/telegram/webhook`,
      drop_pending_updates: true
    })
  })
  
  const setData = await setResponse.json()
  
  if (!setData.ok) {
    console.error('❌ Error configurando webhook:', setData)
    process.exit(1)
  }
  
  console.log('✅ Webhook configurado correctamente')
  
  // Verificar
  const infoUrl = `https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`
  const infoResponse = await fetch(infoUrl)
  const infoData = await infoResponse.json()
  
  console.log('\n📊 Estado del webhook:')
  console.log(`   URL: ${infoData.result.url}`)
  console.log(`   Pendientes: ${infoData.result.pending_update_count}`)
  console.log(`   Último error: ${infoData.result.last_error_message || 'Ninguno'}`)
  console.log('\n✅ Webhook reseteado correctamente')
}

resetWebhook().catch(err => {
  console.error('❌ Error:', err)
  process.exit(1)
})
