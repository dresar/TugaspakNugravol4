require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const database = require('./config/database');

// Import routes
const userRoutes = require('./routes/userRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const taskRoutes = require('./routes/taskRoutes');

// Destructure routes yang menggunakan API key
const { router: categoryRouter, apiKeyRouter: categoryApiKeyRouter } = categoryRoutes;
const { router: taskRouter, apiKeyRouter: taskApiKeyRouter } = taskRoutes;

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// API Routes dengan token JWT
app.use('/api/users', userRoutes);
app.use('/api/categories', categoryRouter);
app.use('/api/tasks', taskRouter);

// API Routes dengan API key
app.use('/api/key/categories', categoryApiKeyRouter);
app.use('/api/key/tasks', taskApiKeyRouter);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Todo API Server',
    version: '1.0.0',
    documentation: `http://localhost:${PORT}/api-docs`
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    path: req.originalUrl
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err.stack : {}
  });
});

// Start server
const startServer = async () => {
  try {
    // Connect to database
    await database.connect();
    console.log('Database connected successfully');
    
    // Initialize database tables
    await database.init();
    // Pastikan tabel error_logs sudah dibuat
    await database.createErrorLogsTable();
    console.log('Database dan tabel error_logs berhasil diinisialisasi');
    
    // Start listening
    app.listen(PORT, () => {
      console.log(`\n🚀 Server is running on port ${PORT}`);
      console.log(`📍 API Base URL: http://localhost:${PORT}`);
      console.log(`📖 API Documentation: http://localhost:${PORT}`);
      console.log(`💚 Health Check: http://localhost:${PORT}/health`);
      console.log(`\n📋 Available Endpoints:`);
      console.log(`   Users: http://localhost:${PORT}/api/users`);
      console.log(`   Categories: http://localhost:${PORT}/api/categories`);
      console.log(`   Tasks: http://localhost:${PORT}/api/tasks`);
      console.log(`   Admin: http://localhost:${PORT}/api/admin`);
      console.log(`\n🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Received SIGINT. Graceful shutdown...');
  try {
    await database.close();
    console.log('✅ Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM. Graceful shutdown...');
  try {
    await database.close();
    console.log('✅ Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

startServer();

module.exports = app;