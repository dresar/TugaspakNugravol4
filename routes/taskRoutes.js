const express = require('express');
const { body, param, query } = require('express-validator');
const taskController = require('../controllers/taskController');
const { authenticateToken, authenticateApiKey } = require('../middleware/auth');

const router = express.Router();

// Aturan validasi biar data task-nya gak amburadul
const createTaskValidation = [
  body('title')
    .isLength({ min: 1, max: 255 })
    .withMessage('Judul task harus 1-255 karakter, jangan kebanyakan ntar pusing bacanya!')
    .trim(),
  body('description')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Deskripsi maksimal 1000 karakter, emangnya nulis novel?')
    .trim(),
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high'])
    .withMessage('Prioritas cuma boleh low, medium, high. Jangan ngarang sendiri ya!'),
  body('due_date')
    .optional()
    .isISO8601()
    .withMessage('Format tanggal harus YYYY-MM-DD, jangan dibalik-balik!'),
  body('category_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('ID kategori harus angka positif, jangan ngasal!')
];

const updateTaskValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('ID task harus angka positif, mau update yang mana sih?'),
  body('title')
    .optional()
    .isLength({ min: 1, max: 255 })
    .withMessage('Judul task harus 1-255 karakter, jangan kebanyakan!')
    .trim(),
  body('description')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Deskripsi maksimal 1000 karakter, emangnya nulis skripsi?')
    .trim(),
  body('status')
    .optional()
    .isIn(['pending', 'completed'])
    .withMessage('Status cuma boleh pending atau completed. Jangan ngarang status sendiri!'),
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high'])
    .withMessage('Prioritas cuma boleh low, medium, high. Jangan aneh-aneh!'),
  body('due_date')
    .optional()
    .isISO8601()
    .withMessage('Format tanggal harus YYYY-MM-DD, jangan dibolak-balik!'),
  body('category_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('ID kategori harus angka positif, jangan minus!')
];

const updateTaskStatusValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('ID task harus angka positif, mau update yang mana nih?'),
  body('status')
    .isIn(['pending', 'completed'])
    .withMessage('Status cuma boleh pending atau completed. Jangan kreatif-kreatif!')
];

const getTaskValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('ID task harus angka positif, mau lihat yang mana sih?')
];

const deleteTaskValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('ID task harus angka positif, mau hapus yang mana nih?')
];

const getTasksValidation = [
  query('status')
    .optional()
    .isIn(['pending', 'completed'])
    .withMessage('Status cuma boleh pending atau completed. Jangan ngarang!'),
  query('priority')
    .optional()
    .isIn(['low', 'medium', 'high'])
    .withMessage('Prioritas cuma boleh low, medium, high. Pilih yang bener dong!'),
  query('category_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('ID kategori harus angka positif, jangan ngasal!'),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Halaman harus angka positif, masa halaman minus?'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit harus 1-100, jangan kebanyakan ntar servernya nangis!'),
  query('search')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Kata pencarian maksimal 100 karakter, emangnya nyari apaan?')
    .trim()
];

// Buat router terpisah untuk API key
const apiKeyRouter = express.Router();
apiKeyRouter.use(authenticateApiKey);

// Rute-rute dengan API key
apiKeyRouter.get('/', getTasksValidation, taskController.getAllTasks); // Ambil semua task dengan API key
apiKeyRouter.get('/:id', getTaskValidation, taskController.getTaskById); // Ambil task by ID dengan API key
apiKeyRouter.post('/', createTaskValidation, taskController.createTask); // Bikin task baru dengan API key
apiKeyRouter.put('/:id', updateTaskValidation, taskController.updateTask); // Update task dengan API key
apiKeyRouter.patch('/:id/status', updateTaskStatusValidation, taskController.updateTaskStatus); // Update status doang dengan API key
apiKeyRouter.delete('/:id', deleteTaskValidation, taskController.deleteTask); // Hapus task dengan API key

// Semua rute butuh token, jangan nekat masuk tanpa izin!
router.use(authenticateToken);

// Rute-rute kece buat task dengan token
router.get('/', getTasksValidation, taskController.getAllTasks); // Ambil semua task
router.get('/:id', getTaskValidation, taskController.getTaskById); // Ambil task by ID
router.post('/', createTaskValidation, taskController.createTask); // Bikin task baru
router.put('/:id', updateTaskValidation, taskController.updateTask); // Update task
router.patch('/:id/status', updateTaskStatusValidation, taskController.updateTaskStatus); // Update status doang
router.delete('/:id', deleteTaskValidation, taskController.deleteTask); // Hapus task

module.exports = { router, apiKeyRouter }; // Export kedua router biar bisa dipake di tempat lain