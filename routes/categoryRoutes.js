const express = require('express');
const { body, param } = require('express-validator');
const categoryController = require('../controllers/categoryController');
const { authenticateToken, authenticateApiKey } = require('../middleware/auth');

const router = express.Router();

// Aturan validasi buat ngecek data yang masuk
const createCategoryValidation = [
  body('name')
    .isLength({ min: 1, max: 100 })
    .withMessage('Nama kategori harus antara 1-100 karakter dong, jangan kebanyakan!')
    .trim(),
  body('color')
    .optional()
    .matches(/^#[0-9A-F]{6}$/i)
    .withMessage('Warnanya harus kode hex yang bener ya, contoh: #FF0000. Jangan ngasal!')
];

const updateCategoryValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('ID kategori harus angka positif, jangan minus-minusan!'),
  body('name')
    .isLength({ min: 1, max: 100 })
    .withMessage('Nama kategori harus antara 1-100 karakter, jangan kebanyakan ngetik!')
    .trim(),
  body('color')
    .optional()
    .matches(/^#[0-9A-F]{6}$/i)
    .withMessage('Warnanya harus kode hex yang bener ya, contoh: #FF0000. Jangan ngasal!')
];

const deleteCategoryValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('ID kategori harus angka positif, masa mau hapus yang gak ada?')
];

// Buat router terpisah untuk API key
const apiKeyRouter = express.Router();
apiKeyRouter.use(authenticateApiKey);

// Rute-rute dengan API key
apiKeyRouter.get('/', categoryController.getCategories); // Ambil semua kategori dengan API key
apiKeyRouter.post('/', createCategoryValidation, categoryController.createCategory); // Bikin kategori baru dengan API key
apiKeyRouter.put('/:id', updateCategoryValidation, categoryController.updateCategory); // Update kategori dengan API key
apiKeyRouter.delete('/:id', deleteCategoryValidation, categoryController.deleteCategory); // Hapus kategori dengan API key

// Semua rute butuh token, jangan coba-coba masuk tanpa izin ya!
router.use(authenticateToken);

// Rute-rute kece buat kategori dengan token
router.get('/', categoryController.getCategories); // Ambil semua kategori
router.post('/', createCategoryValidation, categoryController.createCategory); // Bikin kategori baru
router.put('/:id', updateCategoryValidation, categoryController.updateCategory); // Update kategori
router.delete('/:id', deleteCategoryValidation, categoryController.deleteCategory); // Hapus kategori

module.exports = { router, apiKeyRouter }; // Export kedua router biar bisa dipake di tempat lain