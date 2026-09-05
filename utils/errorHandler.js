
const database = require('../config/database');

/**
 * Log error ke console dan database jika diperlukan
 * @param {string|object} level - Level error (error, warn, info) atau objek error
 * @param {string} message - Pesan error
 * @param {string} source - Sumber error (file/function)
 * @param {string} stack - Stack trace error
 * @param {object} data - Data tambahan terkait error
 */
const logError = async (level = 'error', message, source, stack, data = null) => {
  // Handle jika parameter pertama adalah objek error
  if (typeof level === 'object' && level !== null) {
    const errorObj = level;
    source = message || 'unknown';
    message = errorObj.message || 'Unknown error';
    stack = errorObj.stack;
    level = 'error';
  }
  
  // Log ke console
  console.error(`[${level.toUpperCase()}] ${message} (${source})`);
  if (stack) console.error(stack);
  
  // Log ke database
  try {
    const db = database.getDb();
    await db.query(
      'INSERT INTO error_logs (level, message, source, stack, user_id) VALUES (?, ?, ?, ?, ?)',
      [level, message, source, stack, data?.user_id || null]
    );
  } catch (err) {
    console.error('Gagal menyimpan error log ke database:', err.message);
  }
  
  return true;
};

/**
 * Log error login khusus untuk mencatat kegagalan login
 * @param {string} email - Email yang digunakan untuk login
 * @param {string} reason - Alasan kegagalan login
 * @param {string} source - Sumber error (file/function)
 * @param {string} ip - IP address pengguna
 * @param {string} method - Metode login (email/password atau API key)
 */
const logLoginError = async (email, reason, source, ip = null, method = 'email/password') => {
  const message = `Login gagal untuk ${email || 'unknown'} menggunakan ${method}: ${reason}`;
  
  // Log ke console
  console.error(`[LOGIN_ERROR] ${message} (${source})`);
  
  // Log ke database
  try {
    const db = database.getDb();
    await db.query(
      'INSERT INTO error_logs (level, message, source, stack) VALUES (?, ?, ?, ?)',
      ['warning', message, source, `IP: ${ip || 'unknown'}`]
    );
  } catch (err) {
    console.error('Gagal menyimpan login error log ke database:', err.message);
  }
  
  return true;
};

/**
 * Middleware untuk menangani error global
 */
const errorMiddleware = (err, req, res, next) => {
  console.error('Error:', err);
  
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err.stack : {}
  });
};

module.exports = {
  logError,
  logLoginError,
  errorMiddleware
};