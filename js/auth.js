// auth.js — Autenticación, notificación Telegram y acceso por dominio
// Solo permite acceso a cuentas @cielco.com.mx (Supabase Auth, email+password)
// Envía notificación a Telegram en cada inicio de sesión exitoso.
// No hay roles: todos los usuarios autenticados tienen acceso completo.

const DOMINIO_PERMITIDO = '@cielco.com.mx';

/** Punto de entrada: llamar en DOMContentLoaded */
async function initApp() {
  const { data: { session } } = await _sb.auth.getSession();
  if (session?.user) {
    _onSesionActiva(session.user);
  } else {
    show('loginScreen');
  }
}

/** Leer campos y hacer login */
async function doLogin() {
  const email = (document.getElementById('loginEmail')?.value || '').trim().toLowerCase();
  const pass  =  document.getElementById('loginPass')?.value  || '';
  _loginError('');

  if (!email) { _loginError('Ingresa tu correo'); return; }
  if (!email.endsWith(DOMINIO_PERMITIDO)) {
    _loginError(`Solo se permiten cuentas ${DOMINIO_PERMITIDO}`);
    return;
  }
  if (!pass)  { _loginError('Ingresa tu contraseña'); return; }

  const btn = document.getElementById('loginBtn');
  btn.disabled = true;
  btn.textContent = 'VERIFICANDO...';

  const { data, error } = await _sb.auth.signInWithPassword({ email, password: pass });

  btn.disabled = false;
  btn.textContent = 'INICIAR SESIÓN';

  if (error) {
    _loginError(
      error.message === 'Invalid login credentials'
        ? 'Correo o contraseña incorrectos'
        : error.message
    );
    return;
  }

  // Telegram al iniciar sesión
  _sendTelegram(data.user);
  _onSesionActiva(data.user);
}

/** Cerrar sesión */
async function doLogout() {
  await _sb.auth.signOut();
  window.location.reload();
}

// ─── privado ─────────────────────────────────────────────────────────────────

function _onSesionActiva(user) {
  const navUser = document.getElementById('navUser');
  if (navUser) navUser.style.display = 'flex';
  const emailEl = document.getElementById('navEmail');
  if (emailEl) emailEl.textContent = user.email;
  show('uploadScreen');
  renderHistorial();
}

function _loginError(msg) {
  const el = document.getElementById('loginError');
  if (!el) return;
  el.textContent = msg;
  el.style.display = msg ? 'block' : 'none';
}

async function _sendTelegram(user) {
  const token  = CONFIG.telegram?.botToken;
  const chatId = CONFIG.telegram?.chatId;
  if (!token || !chatId || token === 'TU_BOT_TOKEN') return;

  const texto = [
    '\u{1F512} <b>Alfa Quattro — Inicio de sesi\u00F3n</b>',
    `\u{1F464} ${user.email}`,
    `\u{1F551} ${new Date().toLocaleString('es-MX', { timeZone: 'America/Mazatlan' })}`,
  ].join('\n');

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: texto, parse_mode: 'HTML' }),
    });
  } catch (e) {
    console.warn('[Telegram] No se pudo enviar notificación:', e.message);
  }
}

// Enter en cualquier campo del formulario de login dispara doLogin()
document.addEventListener('DOMContentLoaded', () => {
  ['loginEmail', 'loginPass'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
  });
  initApp();
});
