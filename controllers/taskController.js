const { validationResult } = require('express-validator');
const database = require('../config/database');
const { logError } = require('../utils/errorHandler');

class TaskController {
  // Ambil semua tugas, bisa pake filter, pagination, dan search
  async getAllTasks(req, res) {
    try {
      const db = database.getDb();
      const userId = req.user.id;
      
      // Parameter query buat filter dan pagination
      const { 
        category_id, 
        status, 
        priority,
        page = 1, 
        limit = 10,
        search = '',
        sort_by = 'created_at',
        sort_order = 'desc'
      } = req.query;
      
      const offset = (page - 1) * limit;
      let params = [userId];
      
      // Bikin query dasar
      let query = `
        SELECT t.*, c.name as category_name 
        FROM tasks t
        LEFT JOIN categories c ON t.category_id = c.id
        WHERE t.user_id = ?
      `;
      
      // Tambah filter kalo ada
      if (category_id) {
        query += ' AND t.category_id = ?';
        params.push(category_id);
      }
      
      if (status) {
        query += ' AND t.status = ?';
        params.push(status);
      }
      
      if (priority) {
        query += ' AND t.priority = ?';
        params.push(priority);
      }
      
      // Tambah search kalo ada
      if (search) {
        query += ' AND (t.title LIKE ? OR t.description LIKE ?)';
        params.push(`%${search}%`, `%${search}%`);
      }
      
      // Tambah sorting
      const validSortColumns = ['title', 'due_date', 'status', 'priority', 'created_at'];
      const sortColumn = validSortColumns.includes(sort_by) ? sort_by : 'created_at';
      const sortDirection = sort_order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
      
      query += ` ORDER BY t.${sortColumn} ${sortDirection}`;
      
      // Tambah pagination
      query += ' LIMIT ? OFFSET ?';
      params.push(parseInt(limit), offset);
      
      // Jalankan query
      const [tasks] = await db.query(query, params);
      
      // Hitung total tugas
      let countQuery = `
        SELECT COUNT(*) as total 
        FROM tasks t 
        WHERE t.user_id = ?
      `;
      
      let countParams = [userId];
      
      if (category_id) {
        countQuery += ' AND t.category_id = ?';
        countParams.push(category_id);
      }
      
      if (status) {
        countQuery += ' AND t.status = ?';
        countParams.push(status);
      }
      
      if (priority) {
        countQuery += ' AND t.priority = ?';
        countParams.push(priority);
      }
      
      if (search) {
        countQuery += ' AND (t.title LIKE ? OR t.description LIKE ?)';
        countParams.push(`%${search}%`, `%${search}%`);
      }
      
      const [totalResult] = await db.query(countQuery, countParams);
      
      const total = totalResult[0].total;
      const totalPages = Math.ceil(total / limit);
      
      res.json({
        success: true,
        message: 'Nih, semua tugas kamu udah diambil!',
        data: {
          tasks,
          pagination: {
            total,
            totalPages,
            currentPage: parseInt(page),
            limit: parseInt(limit)
          }
        }
      });
    } catch (error) {
      console.error('Duh, error pas ambil semua tugas:', error);
      logError('error', 'Error retrieving all tasks', 'taskController.getAllTasks', error.stack, req.user?.id);
      res.status(500).json({
        success: false,
        message: 'Server-nya lagi error nih, coba lagi nanti ya!'
      });
    }
  }

  // Ambil satu tugas berdasarkan ID
  async getTaskById(req, res) {
    try {
      const db = database.getDb();
      const userId = req.user.id;
      const taskId = req.params.id;
      
      const [rows] = await db.query(
        `SELECT t.*, c.name as category_name 
         FROM tasks t
         LEFT JOIN categories c ON t.category_id = c.id
         WHERE t.id = ? AND t.user_id = ?`,
        [taskId, userId]
      );
      
      const task = rows[0];
      
      if (!task) {
        return res.status(404).json({
          success: false,
          message: 'Waduh, tugas yang kamu cari gak ketemu nih!'
        });
      }
      
      res.json({
        success: true,
        message: 'Nah, ini dia tugas yang kamu cari!',
        data: { task }
      });
    } catch (error) {
      console.error('Duh, error pas ambil tugas by ID:', error);
      logError('error', 'Error retrieving task by ID', 'taskController.getTaskById', error.stack, req.user?.id);
      res.status(500).json({
        success: false,
        message: 'Server-nya lagi error nih, coba lagi nanti ya!'
      });
    }
  }

  // Bikin tugas baru, jangan lupa isi yang lengkap ya!
  async createTask(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Waduh, data tugas yang diisi ada yang salah nih!',
          errors: errors.array()
        });
      }
      
      const db = database.getDb();
      const userId = req.user.id;
      const { title, description, due_date, priority, category_id, status } = req.body;
      
      // Cek dulu kategorinya ada gak dan punya user ini gak
      if (category_id) {
        const [rows] = await db.query(
          'SELECT * FROM categories WHERE id = ? AND user_id = ?',
          [category_id, userId]
        );
        const category = rows[0];
        
        if (!category) {
          return res.status(404).json({
            success: false,
            message: 'Kategori yang dipilih gak ada atau bukan punya kamu!'
          });
        }
      }
      
      // Masukin tugas baru ke database
      const [result] = await db.query(
        `INSERT INTO tasks 
         (title, description, due_date, priority, status, category_id, user_id) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          title,
          description || null,
          due_date || null,
          priority || 'medium',
          status || 'pending',
          category_id || null,
          userId
        ]
      );
      
      const taskId = result.insertId;
      
      // Ambil tugas yang baru dibuat
      const [newTaskRows] = await db.query(
        `SELECT t.*, c.name as category_name 
         FROM tasks t
         LEFT JOIN categories c ON t.category_id = c.id
         WHERE t.id = ?`,
        [taskId]
      );
      const newTask = newTaskRows[0];
      
      res.status(201).json({
        success: true,
        message: 'Yeay! Tugas baru berhasil dibuat!',
        data: { task: newTask }
      });
    } catch (error) {
      console.error('Duh, error pas bikin tugas:', error);
      logError('error', 'Error creating task', 'taskController.createTask', error.stack, req.user?.id);
      res.status(500).json({
        success: false,
        message: 'Server-nya lagi error nih, coba lagi nanti ya!'
      });
    }
  }

  // Update tugas, bisa ubah semua data
  async updateTask(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Waduh, data update tugas ada yang salah nih!',
          errors: errors.array()
        });
      }
      
      const db = database.getDb();
      const userId = req.user.id;
      const taskId = req.params.id;
      const { title, description, due_date, priority, category_id, status } = req.body;
      
      // Cek dulu tugasnya ada gak dan punya user ini gak
      const [existingRows] = await db.query(
        'SELECT * FROM tasks WHERE id = ? AND user_id = ?',
        [taskId, userId]
      );
      const existingTask = existingRows[0];
      
      if (!existingTask) {
        return res.status(404).json({
          success: false,
          message: 'Waduh, tugas yang mau diupdate gak ketemu atau bukan punya kamu!'
        });
      }
      
      // Cek dulu kategorinya ada gak dan punya user ini gak
      if (category_id) {
        const [categoryRows] = await db.query(
          'SELECT * FROM categories WHERE id = ? AND user_id = ?',
          [category_id, userId]
        );
        const category = categoryRows[0];
        
        if (!category) {
          return res.status(404).json({
            success: false,
            message: 'Kategori yang dipilih gak ada atau bukan punya kamu!'
          });
        }
      }
      
      // Update tugas di database
      await db.query(
        `UPDATE tasks SET 
         title = ?, 
         description = ?, 
         due_date = ?, 
         priority = ?, 
         status = ?, 
         category_id = ?, 
         updated_at = CURRENT_TIMESTAMP 
         WHERE id = ? AND user_id = ?`,
        [
          title,
          description || null,
          due_date || null,
          priority || 'medium',
          status || 'pending',
          category_id || null,
          taskId,
          userId
        ]
      );
      
      // Ambil tugas yang udah diupdate
      const [updatedRows] = await db.query(
        `SELECT t.*, c.name as category_name 
         FROM tasks t
         LEFT JOIN categories c ON t.category_id = c.id
         WHERE t.id = ?`,
        [taskId]
      );
      const updatedTask = updatedRows[0];
      
      res.json({
        success: true,
        message: 'Sip! Tugas berhasil diupdate!',
        data: { task: updatedTask }
      });
    } catch (error) {
      console.error('Duh, error pas update tugas:', error);
      logError('error', 'Error updating task', 'taskController.updateTask', error.stack, req.user?.id);
      res.status(500).json({
        success: false,
        message: 'Server-nya lagi error nih, coba lagi nanti ya!'
      });
    }
  }

  // Update status tugas aja, biar cepet
  async updateTaskStatus(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Waduh, data status tugas ada yang salah nih!',
          errors: errors.array()
        });
      }
      
      const db = database.getDb();
      const userId = req.user.id;
      const taskId = req.params.id;
      const { status } = req.body;
      
      // Cek dulu tugasnya ada gak dan punya user ini gak
      const [existingRows] = await db.query(
        'SELECT * FROM tasks WHERE id = ? AND user_id = ?',
        [taskId, userId]
      );
      const existingTask = existingRows[0];
      
      if (!existingTask) {
        return res.status(404).json({
          success: false,
          message: 'Waduh, tugas yang mau diupdate gak ketemu atau bukan punya kamu!'
        });
      }
      
      // Update status tugas di database
      await db.query(
        `UPDATE tasks SET 
         status = ?, 
         updated_at = CURRENT_TIMESTAMP 
         WHERE id = ? AND user_id = ?`,
        [status, taskId, userId]
      );
      
      // Ambil tugas yang udah diupdate
      const [updatedRows] = await db.query(
        `SELECT t.*, c.name as category_name 
         FROM tasks t
         LEFT JOIN categories c ON t.category_id = c.id
         WHERE t.id = ?`,
        [taskId]
      );
      const updatedTask = updatedRows[0];
      
      res.json({
        success: true,
        message: 'Sip! Status tugas berhasil diupdate!',
        data: { task: updatedTask }
      });
    } catch (error) {
      console.error('Duh, error pas update status tugas:', error);
      logError('error', 'Error updating task status', 'taskController.updateTaskStatus', error.stack, req.user?.id);
      res.status(500).json({
        success: false,
        message: 'Server-nya lagi error nih, coba lagi nanti ya!'
      });
    }
  }

  // Hapus tugas, hati-hati ya!
  async deleteTask(req, res) {
    try {
      const db = database.getDb();
      const userId = req.user.id;
      const taskId = req.params.id;
      
      // Cek dulu tugasnya ada gak dan punya user ini gak
      const [existingRows] = await db.query(
        'SELECT * FROM tasks WHERE id = ? AND user_id = ?',
        [taskId, userId]
      );
      const existingTask = existingRows[0];
      
      if (!existingTask) {
        return res.status(404).json({
          success: false,
          message: 'Waduh, tugas yang mau dihapus gak ketemu atau bukan punya kamu!'
        });
      }
      
      // Hapus tugas dari database
      await db.query('DELETE FROM tasks WHERE id = ? AND user_id = ?', [taskId, userId]);
      
      res.json({
        success: true,
        message: 'Yeay! Tugas berhasil dihapus!',
        data: { task_id: taskId }
      });
    } catch (error) {
      console.error('Duh, error pas hapus tugas:', error);
      logError('error', 'Error deleting task', 'taskController.deleteTask', error.stack, req.user?.id);
      res.status(500).json({
        success: false,
        message: 'Server-nya lagi error nih, coba lagi nanti ya!'
      });
    }
  }
}

module.exports = new TaskController(); // Export biar bisa dipake di tempat lain