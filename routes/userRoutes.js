const express = require('express');
const { body } = require('express-validator');
const userController = require('../controllers/userController');
const { authenticateToken, authenticateApiKey } = require('../middleware/auth');

const router = express.Router();

// Aturan validasi biar usernya gak ngasal
const registerValidation = [
  body('username')
    .isLength({ min: 3, max: 50 })
    .withMessage('Username harus 3-50 karakter, jangan kepanjangan ntar capek ngetiknya!')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username cuma boleh huruf, angka, dan underscore. Jangan aneh-aneh ya!'),
  body('email')
    .isEmail()
    .withMessage('Email harus bener formatnya dong, masa @gmail aja gak ada?')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password minimal 6 karakter, masa cuma 123 doang? Gampang ditebak!')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password harus ada huruf kecil, huruf besar, dan angka. Biar aman bos!')
];

const loginValidation = [
  body('email')
    .isEmail()
    .withMessage('Email harus bener formatnya, jangan ngasal!')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Password-nya diisi dong, masa kosong? Mau hack ya?')
];

const registerAdminValidation = [
  ...registerValidation,
  body('admin_code')
    .notEmpty()
    .withMessage('Kode admin harus diisi!')
];

const resetPasswordValidation = [
  body('user_id')
    .isInt({ min: 1 })
    .withMessage('ID user harus berupa angka positif!'),
  body('new_password')
    .isLength({ min: 6 })
    .withMessage('Password baru minimal 6 karakter!')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password baru harus ada huruf kecil, huruf besar, dan angka!')
];

const selfResetPasswordValidation = [
  body('current_password')
    .notEmpty()
    .withMessage('Password saat ini harus diisi!'),
  body('new_password')
    .isLength({ min: 6 })
    .withMessage('Password baru minimal 6 karakter!')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password baru harus ada huruf kecil, huruf besar, dan angka!')
];

// Rute-rute keren buat user
router.post('/register', registerValidation, userController.register); // Daftar user baru
router.post('/register-admin', registerAdminValidation, userController.registerAdmin); // Daftar admin baru
router.post('/login', loginValidation, userController.login); // Login user
router.post('/logout', authenticateToken, userController.logout); // Logout user dan hapus token
router.post('/admin-login', loginValidation, userController.adminLogin); // Login khusus admin
router.post('/admin-login-api-key', userController.adminLoginWithApiKey); // Login admin dengan API key
router.get('/profile', authenticateToken, userController.getProfile); // Lihat profil, tapi harus login dulu!
router.get('/profile-api-key', authenticateApiKey, userController.getProfile); // Lihat profil dengan API key
router.post('/reset-password', authenticateToken, resetPasswordValidation, userController.resetPassword); // Reset password user (admin only)
router.post('/self-reset-password', authenticateToken, selfResetPasswordValidation, userController.selfResetPassword); // User reset password sendiri
router.get('/login-error-logs', authenticateToken, userController.getLoginErrorLogs); // Lihat log error login terakhir (admin only)

module.exports = router; // Biar bisa dipake di file lain