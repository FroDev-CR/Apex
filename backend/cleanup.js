import 'dotenv/config';
import { connectDatabase } from './src/config/database.js';
import { Order } from './src/models/index.js';

await connectDatabase();
const result = await Order.deleteMany({});
console.log(`✅ Eliminadas ${result.deletedCount} órdenes`);
process.exit(0);
