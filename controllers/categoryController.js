const { validationResult } = require('express-validator');
const database = require('../config/database');
const { logError } = require('../utils/errorHandler');

class CategoryController {
  // Ambil semua kategori punya user ini
  async getCategories(req, res) {
    try {
      const db = database.getDb();
      const userId = req.user.id;

      const [categories] = await db.query(
        'SELECT * FROM categories WHERE user_id = ? ORDER BY name ASC',
        [userId]
      );

      res.json({
        success: true,
        message: 'Nih, semua kategori kamu udah diambil!',
        data: { categories }
      });
    } catch (error) {
      console.error('Duh, error pas ambil kategori:', error);
      logError('error', 'Error retrieving categories', 'categoryController.getCategories', error.stack, req.user?.id);
      res.status(500).json({
        success: false,
        message: 'Server-nya lagi error nih, coba lagi nanti ya!'
      });
    }
  }

  // Bikin kategori baru, jangan sampe namanya sama ya!
  async createCategory(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Waduh, data kategori yang diisi ada yang salah nih!',
          errors: errors.array()
        });
      }

      const { name, color } = req.body;
      const userId = req.user.id;
      const db = database.getDb();

      // Cek dulu apa nama kategorinya udah ada
      const [existingRows] = await db.query(
        'SELECT * FROM categories WHERE name = ? AND user_id = ?',
        [name, userId]
      );
      const existingCategory = existingRows[0];

      if (existingCategory) {
        return res.status(400).json({
          success: false,
          message: 'Wah, nama kategori ini udah ada, cari nama lain dong!'
        });
      }

      // Masukin kategori baru ke database
      const [result] = await db.query(
        'INSERT INTO categories (name, color, user_id) VALUES (?, ?, ?)',
        [name, color || '#3498db', userId]
      );
      const categoryId = result.insertId;

      // Ambil kategori yang baru dibuat
      const [newCategoryRows] = await db.query(
        'SELECT * FROM categories WHERE id = ?',
        [categoryId]
      );
      const newCategory = newCategoryRows[0];

      res.status(201).json({
        success: true,
        message: 'Yeay! Kategori baru berhasil dibuat!',
        data: { category: newCategory }
      });
    } catch (error) {
      console.error('Duh, error pas bikin kategori:', error);
      logError('error', 'Error creating category', 'categoryController.createCategory', error.stack, req.user?.id);
      res.status(500).json({
        success: false,
        message: 'Server-nya lagi error nih, coba lagi nanti ya!'
      });
    }
  }

  // Update kategori, bisa ganti nama atau warna
  async updateCategory(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Waduh, data update kategori ada yang salah nih!',
          errors: errors.array()
        });
      }

      const categoryId = req.params.id;
      const { name, color } = req.body;
      const userId = req.user.id;
      const db = database.getDb();

      // Cek dulu kategorinya ada gak dan punya user ini gak
      const [existingRows] = await db.query(
        'SELECT * FROM categories WHERE id = ? AND user_id = ?',
        [categoryId, userId]
      );
      const existingCategory = existingRows[0];

      if (!existingCategory) {
        return res.status(404).json({
          success: false,
          message: 'Waduh, kategori yang mau diupdate gak ketemu atau bukan punya kamu!'
        });
      }

      // Cek dulu apa nama kategori barunya udah ada
      if (name && name !== existingCategory.name) {
        const [duplicateRows] = await db.query(
          'SELECT * FROM categories WHERE name = ? AND user_id = ? AND id != ?',
          [name, userId, categoryId]
        );
        const duplicateName = duplicateRows[0];

        if (duplicateName) {
          return res.status(400).json({
            success: false,
            message: 'Wah, nama kategori ini udah ada, cari nama lain dong!'
          });
        }
      }

      // Update kategori di database
      await db.query(
        'UPDATE categories SET name = ?, color = ? WHERE id = ? AND user_id = ?',
        [name || existingCategory.name, color || existingCategory.color, categoryId, userId]
      );

      // Ambil kategori yang udah diupdate
      const [updatedRows] = await db.query(
        'SELECT * FROM categories WHERE id = ?',
        [categoryId]
      );
      const updatedCategory = updatedRows[0];

      res.json({
        success: true,
        message: 'Sip! Kategori berhasil diupdate!',
        data: { category: updatedCategory }
      });
    } catch (error) {
      console.error('Duh, error pas update kategori:', error);
      logError('error', 'Error updating category', 'categoryController.updateCategory', error.stack, req.user?.id);
      res.status(500).json({
        success: false,
        message: 'Server-nya lagi error nih, coba lagi nanti ya!'
      });
    }
  }

  // Hapus kategori, tugas yang pake kategori ini bakal jadi gak punya kategori
  async deleteCategory(req, res) {
    try {
      const categoryId = req.params.id;
      const userId = req.user.id;
      const db = database.getDb();

      // Cek dulu kategorinya ada gak dan punya user ini gak
      const [existingRows] = await db.query(
        'SELECT * FROM categories WHERE id = ? AND user_id = ?',
        [categoryId, userId]
      );
      const existingCategory = existingRows[0];

      if (!existingCategory) {
        return res.status(404).json({
          success: false,
          message: 'Waduh, kategori yang mau dihapus gak ketemu atau bukan punya kamu!'
        });
      }

      // Hapus kategori dari database, tugas yang pake kategori ini bakal jadi null (ON DELETE SET NULL)
      await db.query(
        'DELETE FROM categories WHERE id = ? AND user_id = ?',
        [categoryId, userId]
      );

      res.json({
        success: true,
        message: 'Kategori berhasil dihapus! Tugas yang pake kategori ini sekarang jadi gak punya kategori ya~',
        data: null
      });
    } catch (error) {
      console.error('Duh, error pas hapus kategori:', error);
      logError('error', 'Error deleting category', 'categoryController.deleteCategory', error.stack, req.user?.id);
      res.status(500).json({
        success: false,
        message: 'Server-nya lagi error nih, coba lagi nanti ya!'
      });
    }
  }
}

module.exports = new CategoryController(); // Export biar bisa dipake di tempat lain