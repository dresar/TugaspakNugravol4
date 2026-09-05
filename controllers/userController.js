const bcrypt = require('bcryptjs');
const { validationResult } = require('express-validator');
const database = require('../config/database');
const { generateToken } = require('../middleware/auth');
const { logError, logLoginError } = require('../utils/errorHandler');

class UserController {
  // Daftar user baru, jangan sampe duplikat ya!
  async register(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Waduh, data yang diisi ada yang salah nih!',
          errors: errors.array()
        });
      }

      const { username, email, password } = req.body;
      const db = database.getDb();

      // Cek dulu apa usernya udah ada
      const existingUser = await new Promise(async (resolve, reject) => {
        try {
          const [rows] = await db.query(
            'SELECT * FROM users WHERE email = ? OR username = ?',
            [email, username]
          );
          resolve(rows.length > 0 ? rows[0] : null);
        } catch (err) {
          console.error('Error checking existing admin:', err);
          reject(err);
        }
      });

      if (existingUser) {
        console.log('Existing user found:', existingUser);
        return res.status(400).json({
          success: false,
          message: 'Wah, email atau username-nya udah dipake orang lain tuh! Cari yang lain ya~'
        });
      }

      // Generate API key baru
      const apiKey = Math.random().toString(36).substring(2, 15) + 
                     Math.random().toString(36).substring(2, 15) + 
                     Date.now().toString(36);

      // Masukin user baru ke database dengan role default 'user'
      try {
        const result = await new Promise(async (resolve, reject) => {
          try {
            const [result] = await db.query(
              'INSERT INTO users (username, email, password, api_key, role) VALUES (?, ?, ?, ?, ?)',
              [username, email, password, apiKey, 'user']
            );
            resolve({ id: result.insertId });
          } catch (err) {
            console.error('Error inserting new user:', err);
            reject(err);
          }
        });

        // Bikin token buat user baru
        const user = { id: result.id, username, email, role: 'user' };
        const token = await generateToken(user);

        res.status(201).json({
          success: true,
          message: 'Yeay! Kamu berhasil daftar, selamat bergabung!',
          data: {
            user: {
              id: result.id,
              username,
              email,
              api_key: apiKey
            },
            token
          }
        });
      } catch (insertError) {
        console.error('Error during user insertion:', insertError);
        if (insertError.message && insertError.message.includes('UNIQUE constraint failed')) {
          return res.status(400).json({
            success: false,
            message: 'Wah, email atau username-nya udah dipake orang lain tuh! Cari yang lain ya~'
          });
        }
        throw insertError;
      }
    } catch (error) {
      // Log error ke database
      await logError(error, 'userController.register');
      
      console.error('Duh, error pas register:', error);
      res.status(500).json({
        success: false,
        message: 'Server-nya lagi error nih, coba lagi nanti ya!'
      });
    }
  }

  // Login user, jangan lupa password-nya!
  async login(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Data login-nya ada yang salah nih!',
          errors: errors.array()
        });
      }

      const { username, email, password } = req.body;
      const db = database.getDb();

      // Cari user berdasarkan email
      let user = await new Promise(async (resolve, reject) => {
        try {
          const [rows] = await db.query(
            'SELECT * FROM users WHERE email = ?',
            [email]
          );
          resolve(rows.length > 0 ? rows[0] : null);
        } catch (err) {
          console.error('Error finding user:', err);
          reject(err);
        }
      });

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Email atau password salah tuh, coba cek lagi!'
        });
      }

      // Verifikasi bahwa user bukan admin
      if (user.role === 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Admin tidak dapat login melalui rute ini. Silakan gunakan rute admin-login!'
        });
      }

      // Cek password-nya bener gak (tanpa hashing)
      if (password !== user.password) {
        return res.status(401).json({
          success: false,
          message: 'Email atau password salah tuh, coba cek lagi!'
        });
      }

      // Bikin token buat user
      const token = await generateToken(user);

      res.json({
        success: true,
        message: 'Hore! Login berhasil, selamat datang kembali!',
        data: {
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            api_key: user.api_key
          },
          token
        }
      });
    } catch (error) {
      // Log error ke database
      await logError(error, 'userController.login');
      
      console.error('Duh, error pas login:', error);
      res.status(500).json({
        success: false,
        message: 'Server-nya lagi error nih, coba lagi nanti ya!'
      });
    }
  }

  // Ambil profil user, tapi harus login dulu!
  async getProfile(req, res) {
    try {
      const db = database.getDb();
      const userId = req.user.id;

      const user = await new Promise(async (resolve, reject) => {
        try {
          const [rows] = await db.query(
            'SELECT id, username, email, role, created_at FROM users WHERE id = ?',
            [userId]
          );
          resolve(rows.length > 0 ? rows[0] : null);
        } catch (err) {
          console.error('Error finding user profile:', err);
          reject(err);
        }
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Lho, user-nya kok gak ketemu? Aneh deh!'
        });
      }

      res.json({
        success: true,
        message: 'Nah, ini dia profil kamu!',
        data: {
          user
        }
      });
    } catch (error) {
      // Log error ke database
      await logError(error, 'userController.getProfile', 'error', req.user?.id);
      
      console.error('Duh, error pas ambil profil:', error);
      res.status(500).json({
        success: false,
        message: 'Server-nya lagi error nih, coba lagi nanti ya!'
      });
    }
  }
  
  // Register sebagai admin
  async registerAdmin(req, res) {
    try {
      // Fitur pendaftaran admin dinonaktifkan
      return res.status(403).json({
        success: false,
        message: 'Pendaftaran admin telah dinonaktifkan. Hanya user biasa yang dapat mendaftar.'
      });
    } catch (error) {
      // Log error ke database
      await logError(error, 'userController.registerAdmin');
      
      console.error('Duh, error pas register admin:', error);
      res.status(500).json({
        success: false,
        message: 'Server-nya lagi error nih, coba lagi nanti ya!'
      });
    }
  }

  // Reset password user
  async resetPassword(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Data reset password ada yang salah!',
          errors: errors.array()
        });
      }

      const { user_id, new_password } = req.body;
      const adminId = req.user.id;
      const db = database.getDb();
      
      // Cek apakah yang melakukan request adalah admin
      const admin = await new Promise(async (resolve, reject) => {
        try {
          const [rows] = await db.query(
            'SELECT * FROM users WHERE id = ? AND role = ?',
            [adminId, 'admin']
          );
          resolve(rows.length > 0 ? rows[0] : null);
        } catch (err) {
          console.error('Error checking admin status:', err);
          reject(err);
        }
      });
      
      if (!admin) {
        return res.status(403).json({
          success: false,
          message: 'Hanya admin yang bisa mereset password!'
        });
      }
      
      // Cek apakah user yang akan direset password ada
      const userToReset = await new Promise(async (resolve, reject) => {
        try {
          const [rows] = await db.query(
            'SELECT * FROM users WHERE id = ?',
            [user_id]
          );
          resolve(rows.length > 0 ? rows[0] : null);
        } catch (err) {
          console.error('Error finding user to reset:', err);
          reject(err);
        }
      });
      
      if (!userToReset) {
        return res.status(404).json({
          success: false,
          message: 'User tidak ditemukan!'
        });
      }
      
      // Update password user (tanpa hashing)
      await new Promise(async (resolve, reject) => {
        try {
          await db.query(
            'UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [new_password, user_id]
          );
          resolve();
        } catch (err) {
          console.error('Error updating password:', err);
          reject(err);
        }
      });
      
      res.json({
        success: true,
        message: 'Password berhasil direset!',
        data: {
          user_id,
          username: userToReset.username
        }
      });
    } catch (error) {
      // Log error ke database
      await logError(error, 'userController.resetPassword', 'error', req.user?.id);
      
      console.error('Error saat reset password:', error);
      res.status(500).json({
        success: false,
        message: 'Server error saat reset password',
        error: error.message
      });
    }
  }

  // Self reset password (user mereset password sendiri)
  async selfResetPassword(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Data reset password ada yang salah!',
          errors: errors.array()
        });
      }

      const { current_password, new_password } = req.body;
      const userId = req.user.id;
      const db = database.getDb();
      
      // Cek user yang sedang login
      const user = await new Promise(async (resolve, reject) => {
        try {
          const [rows] = await db.query(
            'SELECT * FROM users WHERE id = ?',
            [userId]
          );
          resolve(rows.length > 0 ? rows[0] : null);
        } catch (err) {
          console.error('Error finding user:', err);
          reject(err);
        }
      });
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User tidak ditemukan!'
        });
      }
      
      // Verifikasi password saat ini (tanpa hashing)
      if (current_password !== user.password) {
        return res.status(401).json({
          success: false,
          message: 'Password saat ini tidak valid!'
        });
      }
      
      // Update password user (tanpa hashing)
      await new Promise(async (resolve, reject) => {
        try {
          await db.query(
            'UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [new_password, userId]
          );
          resolve();
        } catch (err) {
          console.error('Error updating password:', err);
          reject(err);
        }
      });
      
      res.json({
        success: true,
        message: 'Password berhasil diubah!'
      });
    } catch (error) {
      // Log error ke database
      await logError(error, 'userController.selfResetPassword', 'error', req.user?.id);
      
      console.error('Error saat self reset password:', error);
      res.status(500).json({
        success: false,
        message: 'Server error saat mengubah password',
        error: error.message
      });
    }
  }
  
  // Login khusus admin
  async adminLogin(req, res) {
    try {
      // Fitur login admin dinonaktifkan
      return res.status(403).json({
        success: false,
        message: 'Login admin telah dinonaktifkan. Hanya user biasa yang dapat login.'
      });
    } catch (error) {
      // Log error ke database
      await logError(error, 'userController.adminLogin');
      
      console.error('Error saat login admin:', error);
      res.status(500).json({
        success: false,
        message: 'Server sedang mengalami gangguan, silakan coba lagi nanti!'
      });
    }
  }

  // Login khusus admin dengan API key
  async adminLoginWithApiKey(req, res) {
    try {
      // Fitur login admin dengan API key dinonaktifkan
      return res.status(403).json({
        success: false,
        message: 'Login admin dengan API key telah dinonaktifkan. Hanya user biasa yang dapat login.'
      });
    } catch (error) {
      // Log error ke database
      await logError(error, 'userController.adminLoginWithApiKey');
      
      console.error('Error saat login admin dengan API key:', error);
      res.status(500).json({
        success: false,
        message: 'Server sedang mengalami gangguan, silakan coba lagi nanti!'
      });
    }
  }

  // ... Mendapatkan log error login terakhir (hanya untuk admin)
  async getLoginErrorLogs(req, res) {
    try {
      // Verifikasi bahwa user adalah admin
      if (req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Hanya admin yang diizinkan melihat log error!'
        });
      }

      const db = database.getDb();

      // Ambil 10 log error login terakhir
      const logs = await new Promise(async (resolve, reject) => {
        try {
          const [rows] = await db.query(
            `SELECT * FROM error_logs 
             WHERE level = 'warning' AND message LIKE '%Login gagal untuk%' 
             ORDER BY timestamp DESC LIMIT 10`
          );
          resolve(rows);
        } catch (err) {
          console.error('Error getting login error logs:', err);
          reject(err);
        }
      });

      res.json({
        success: true,
        message: 'Log error login berhasil diambil',
        data: logs,
        logs: logs // Menambahkan logs untuk kompatibilitas dengan frontend
      });
    } catch (error) {
      // Log error ke database
      await logError(error, 'userController.getLoginErrorLogs');
      
      console.error('Error saat mengambil log error login:', error);
      res.status(500).json({
        success: false,
        message: 'Server sedang mengalami gangguan, silakan coba lagi nanti!'
      });
    }
  }

  // Logout user dan hapus token dari database
  async logout(req, res) {
    try {
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1]; // Ambil TOKEN dari Bearer TOKEN

      if (!token) {
        return res.status(400).json({
          success: false,
          message: 'Token tidak ditemukan!'
        });
      }

      const db = database.getDb();
      
      // Hapus token dari database
      await db.query('DELETE FROM tokens WHERE token = ?', [token]);
      
      res.json({
        success: true,
        message: 'Logout berhasil, sampai jumpa kembali!'
      });
    } catch (error) {
      // Log error ke database
      await logError(error, 'userController.logout', 'error', req.user?.id);
      
      console.error('Error saat logout:', error);
      res.status(500).json({
        success: false,
        message: 'Server sedang mengalami gangguan, silakan coba lagi nanti!'
      });
    }
  }
}

module.exports = new UserController(); // Export biar bisa dipake di tempat lain