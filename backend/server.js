require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const path = require('path');
const db = require('./database.js');
const{ globalErrorHandler } = require('./middleware/errorHandler');
const authRoutes = require('./routes/authRoutes');
const salesRoutes = require('./routes/salesRoutes');
const productRoutes = require('./routes/productRoutes');
const userRoutes = require('./routes/userRoutes');
const branchRoutes = require('./routes/branchRoutes');

const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(morgan('dev'));
app.use(express.json({ limit: '1mb' }));
const apiLimiter = rateLimit({ windowsMs: 15 * 60 * 1000, max: 5000});
app.use('/api/', apiLimiter);
app.use(express.static(path.join(__dirname, '../renderer')));
app.use('/templates', express.static(path.join(__dirname, 'renderer', 'templates')));
app.use('/templates', express.static(path.join(__dirname, 'templates')));

app.use('/api', authRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/products', productRoutes);
app.use('/api/users', userRoutes);
app.use('/api/branch', branchRoutes);

app.all('/api/*', (req, res) => {
  res.status(404).json({ error: `API route ${req.method} ${req.originalUrl} not found`});
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'renderer', 'index.html'));
});

app.use(globalErrorHandler);

const start = async () => {
  try {
    await db.init();
    const PORT = process.env.PORT || 3001;
    app.listen(PORT, '0.0.0.0', () => console.log(`pos running on port ${PORT}`));
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
}
};

start();

