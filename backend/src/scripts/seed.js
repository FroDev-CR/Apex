import 'dotenv/config';
import mongoose from 'mongoose';
import { Collaborator } from '../models/index.js';

/**
 * Sample collaborators for seeding the database
 */
const sampleCollaborators = [
  {
    name: 'Alice Johnson',
    email: 'alice.johnson@example.com',
    role: 'senior',
    hourlyRate: 35.00,
    color: '#3B82F6', // Blue
    availability: [
      { dayOfWeek: 1, startHour: 9, endHour: 17 },
      { dayOfWeek: 2, startHour: 9, endHour: 17 },
      { dayOfWeek: 3, startHour: 9, endHour: 17 },
      { dayOfWeek: 4, startHour: 9, endHour: 17 },
      { dayOfWeek: 5, startHour: 9, endHour: 17 }
    ]
  },
  {
    name: 'Bob Martinez',
    email: 'bob.martinez@example.com',
    role: 'collaborator',
    hourlyRate: 25.00,
    color: '#10B981', // Green
    availability: [
      { dayOfWeek: 1, startHour: 8, endHour: 16 },
      { dayOfWeek: 2, startHour: 8, endHour: 16 },
      { dayOfWeek: 3, startHour: 8, endHour: 16 },
      { dayOfWeek: 4, startHour: 8, endHour: 16 },
      { dayOfWeek: 5, startHour: 8, endHour: 16 }
    ]
  },
  {
    name: 'Carol Williams',
    email: 'carol.williams@example.com',
    role: 'manager',
    hourlyRate: 45.00,
    color: '#8B5CF6', // Purple
    availability: [
      { dayOfWeek: 1, startHour: 10, endHour: 18 },
      { dayOfWeek: 2, startHour: 10, endHour: 18 },
      { dayOfWeek: 3, startHour: 10, endHour: 18 },
      { dayOfWeek: 4, startHour: 10, endHour: 18 },
      { dayOfWeek: 5, startHour: 10, endHour: 18 }
    ]
  }
];

/**
 * Seeds the database with sample collaborators
 */
async function seed() {
  try {
    const uri = process.env.MONGODB_URI;

    if (!uri) {
      console.error('❌ MONGODB_URI environment variable is not set');
      console.log('Please create a .env file with your MongoDB connection string');
      process.exit(1);
    }

    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(uri);
    console.log('✅ Connected to MongoDB');

    console.log('🌱 Seeding collaborators...');

    for (const collabData of sampleCollaborators) {
      const existing = await Collaborator.findOne({ email: collabData.email });

      if (existing) {
        console.log(`⏭️  Skipping ${collabData.name} (already exists)`);
        continue;
      }

      const collaborator = new Collaborator(collabData);
      await collaborator.save();
      console.log(`✅ Created collaborator: ${collaborator.name}`);
    }

    console.log('');
    console.log('🎉 Seed completed successfully!');
    console.log('');
    console.log('📋 Created collaborators:');

    const allCollaborators = await Collaborator.find().lean();
    allCollaborators.forEach((c, i) => {
      console.log(`   ${i + 1}. ${c.name} (${c.email}) - ${c.role} - $${c.hourlyRate}/hr`);
    });

    await mongoose.connection.close();
    console.log('');
    console.log('✅ Database connection closed');

  } catch (error) {
    console.error('❌ Seed failed:', error.message);
    process.exit(1);
  }
}

seed();
