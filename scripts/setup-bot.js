// Script para configurar el webhook de Telegram
const readline = require('readline');
require('dotenv').config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (!BOT_TOKEN) {
  console.error('❌ Error: TELEGRAM_BOT_TOKEN no encontrado en .env');
  console.log('Asegúrate de tener la variable en tu archivo .env.local');
  rl.close();
  return;
}

rl.question('Ingresa la URL de ngrok (https://xxx.ngrok.io): ', async (ngrokUrl) => {
  if (!ngrokUrl.startsWith('https://')) {
    console.error('❌ Error: La URL debe comenzar con https://');
    rl.close();
    return;
  }

  const webhookUrl = `${ngrokUrl}/api/telegram/webhook`;
  
  console.log('\n📡 Configurando webhook...');
  console.log(`Webhook URL: ${webhookUrl}\n`);

  try {
    // Configurar webhook
    const response = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: webhookUrl,
          allowed_updates: ['message'],
        }),
      }
    );

    const data = await response.json();

    if (data.ok) {
      console.log('✅ Webhook configurado exitosamente!\n');
      
      // Obtener información del webhook
      const infoResponse = await fetch(
        `https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`
      );
      const info = await infoResponse.json();
      
      console.log('📊 Información del webhook:');
      console.log(`   URL: ${info.result.url}`);
      console.log(`   Pendientes: ${info.result.pending_update_count}`);
      console.log(`   Última llamada: ${info.result.last_error_date ? new Date(info.result.last_error_date * 1000) : 'Ninguna'}`);
      
      console.log('\n🎉 Bot listo para usar!');
      console.log('\n📱 Prueba en Telegram:');
      console.log('   1. Abre @control_videos_bot');
      console.log('   2. Envía: /start');
      console.log('   3. El bot debería responder pidiendo tu nombre\n');
    } else {
      console.error('❌ Error:', data.description);
    }
  } catch (error) {
    console.error('❌ Error de conexión:', error.message);
  }

  rl.close();
});
