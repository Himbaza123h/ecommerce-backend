import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import connectDB from './src/config/database.js';
import authRoutes from './src/routes/auth.js';
import categoryRoutes from './src/routes/category.js'; 
import productRoutes from './src/routes/product.js';
import serviceRoutes from './src/routes/service.js';
import groupRoutes  from './src/routes/group.js';
import blogRoutes  from './src/routes/blog.js';

// Load environment variables
dotenv.config();

// Connect to database
connectDB();

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Increased limit for base64 images
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Basic route
app.get('/', (req, res) => {
  res.json({
    message: 'Ecommerce API is running successfully!',
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
    endpoints: {
      auth: '/api/auth',
      categories: '/api/categories'
    }
  });
});

// Health check route
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/categories', categoryRoutes); // Add this line
app.use('/api/services', serviceRoutes); // Add this line
app.use('/api/products', productRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/blogs', blogRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal Server Error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    message: 'Route not found'
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Ecommerce Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
  console.log(`🌐 Server URL: http://localhost:${PORT}`);
//   console.log(`📚 API Documentation:`);
//   console.log(`   - Categories: http://localhost:${PORT}/api/categories`);
//   console.log(`   - Images: http://localhost:${PORT}/api/images`);
//   console.log(`   - Auth: http://localhost:${PORT}/api/auth`);
});