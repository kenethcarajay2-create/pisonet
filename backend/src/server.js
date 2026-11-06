
import 'dotenv/config';
import bcrypt from 'bcryptjs';

import app from './app.js';
import Admin from './models/Admin.js';
import { connectDatabase } from './config/database.js';

async function start() {
  try {
    console.log('Starting PisoNet Cloud Backend...');

    const { JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;

    if (!JWT_SECRET || JWT_SECRET.length < 32) {
      throw new Error('JWT_SECRET must be at least 32 characters');
    }

    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is missing from .env');
    }

    console.log('Connecting to MongoDB Atlas...');
    await connectDatabase();
    console.log('MongoDB connection established.');

    if (ADMIN_EMAIL && ADMIN_PASSWORD) {
      const email = ADMIN_EMAIL.trim().toLowerCase();

      const existingAdmin = await Admin.exists({ email });

      if (!existingAdmin) {
        const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);

        await Admin.create({
          email,
          passwordHash
        });

        console.log('Initial admin account created.');
      }
    }

    const port = Number(process.env.PORT || 5000);

    app.listen(port, () => {
      console.log(`PisoNet API running on port ${port}`);
      console.log(`Health check: http://localhost:${port}/api/health`);
    });

  } catch (error) {
    console.error('\nBackend startup failed.');
    console.error('Error:', error.message);

    if (error.code === 'ECONNREFUSED' && error.syscall === 'querySrv') {
      console.error(
        'MongoDB SRV DNS lookup was refused. Check the Atlas URI and DNS resolver.'
      );
    }

    process.exit(1);
  }
}

start();
