// build.js — Generado por Vercel antes de servir el sitio estático.
// Lee las variables de entorno e inyecta las credenciales en config/config.js.
const fs = require('fs');

const u  = process.env.SUPABASE_URL        || '';
const k  = process.env.SUPABASE_ANON_KEY   || '';
const bt = process.env.TELEGRAM_BOT_TOKEN  || 'TU_BOT_TOKEN';
const ci = process.env.TELEGRAM_CHAT_ID    || 'TU_CHAT_ID';

const content = `const CONFIG={supabase:{url:"${u}",anonKey:"${k}"},telegram:{botToken:"${bt}",chatId:"${ci}"}};`;

fs.writeFileSync('config/config.js', content);
console.log('config/config.js generado correctamente.');
