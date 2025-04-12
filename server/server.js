const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const { Pool } = require('pg');
const archiver = require('archiver');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// CORS configuration
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(',');
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, postman)
    if (!origin) {
      return callback(null, true);
    }
    
    if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json());

// Connection pool configuration
const poolConfig = {
  max: parseInt(process.env.MAX_POOL_SIZE) || 10,
  connectionTimeoutMillis: parseInt(process.env.REQUEST_TIMEOUT) || 30000
};

// Store database connections
let mysqlConnection = null;
let pgConnection = null;

// Cleanup function for database connections
const cleanup = async () => {
  try {
    if (mysqlConnection) {
      await mysqlConnection.end();
    }
    if (pgConnection) {
      await pgConnection.end();
    }
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
};

// Handle graceful shutdown
process.on('SIGTERM', cleanup);
process.on('SIGINT', cleanup);

// Connect to database
app.post('/api/connect', async (req, res) => {
  try {
    const { type, host, port, user, password, database } = req.body;

    // Close existing connections before creating new ones
    await cleanup();

    if (type === 'mysql') {
      mysqlConnection = await mysql.createConnection({
        host,
        port,
        user,
        password,
        database,
        connectTimeout: parseInt(process.env.REQUEST_TIMEOUT) || 30000
      });
      await mysqlConnection.connect();
    } else if (type === 'postgresql') {
      pgConnection = new Pool({
        ...poolConfig,
        host,
        port,
        user,
        password,
        database,
      });
      // Test the connection
      const client = await pgConnection.connect();
      client.release();
    } else {
      throw new Error('Unsupported database type');
    }

    res.json({ success: true, message: 'Successfully connected to database' });
  } catch (error) {
    console.error('Database connection error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to connect to database',
      error: error.message 
    });
  }
});

// Get tables
app.get('/api/tables', async (req, res) => {
  try {
    const dbType = req.query.type;
    
    if (!mysqlConnection && !pgConnection) {
      return res.status(400).json({ 
        success: false, 
        message: 'No active database connection' 
      });
    }

    let tables = [];
    if (dbType === 'mysql' && mysqlConnection) {
      const [rows] = await mysqlConnection.query('SHOW TABLES');
      tables = rows.map(row => Object.values(row)[0]);
    } else if (dbType === 'postgresql' && pgConnection) {
      const { rows } = await pgConnection.query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
      );
      tables = rows.map(row => row.table_name);
    } else {
      throw new Error('Invalid database type or no connection available');
    }

    res.json({ success: true, tables });
  } catch (error) {
    console.error('Error fetching tables:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch tables',
      error: error.message 
    });
  }
});

// Export tables
app.post('/api/export', async (req, res) => {
  try {
    const { tables, type } = req.body;
    
    if (!tables || !Array.isArray(tables) || tables.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'No tables selected for export' 
      });
    }

    if (!mysqlConnection && !pgConnection) {
      return res.status(400).json({ 
        success: false, 
        message: 'No active database connection' 
      });
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename=export.zip');

    const archive = archiver('zip', {
      zlib: { level: 9 }
    });

    archive.pipe(res);

    for (const table of tables) {
      let data;
      if (type === 'mysql' && mysqlConnection) {
        const [rows] = await mysqlConnection.query(`SELECT * FROM ${table}`);
        data = rows;
      } else if (type === 'postgresql' && pgConnection) {
        const { rows } = await pgConnection.query(`SELECT * FROM ${table}`);
        data = rows;
      } else {
        throw new Error('Invalid database type or no connection available');
      }

      const csv = generateCSV(data);
      archive.append(csv, { name: `${table}.csv` });
    }

    archive.finalize();
  } catch (error) {
    console.error('Error exporting tables:', error);
    // If headers haven't been sent yet, send error response
    if (!res.headersSent) {
      res.status(500).json({ 
        success: false, 
        message: 'Failed to export tables',
        error: error.message 
      });
    }
  }
});

// Get PostgreSQL schemas
app.get('/api/schemas', async (req, res) => {
  try {
    if (!pgConnection) {
      return res.status(400).json({ 
        success: false, 
        message: 'No active PostgreSQL connection' 
      });
    }

    const { rows } = await pgConnection.query(
      "SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT IN ('information_schema', 'pg_catalog')"
    );
    const schemas = rows.map(row => row.schema_name);
    res.json({ success: true, schemas });
  } catch (error) {
    console.error('Error fetching schemas:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch schemas',
      error: error.message 
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    environment: process.env.NODE_ENV || 'development',
    mysqlConnected: !!mysqlConnection,
    postgresConnected: !!pgConnection
  });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port} in ${process.env.NODE_ENV || 'development'} mode`);
}); 