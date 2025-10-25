// MongoDB connection for autonomous agent platform
import connectDB from '../lib/mongodb';

// Re-export the connection function
export { default as connectDB } from '../lib/mongodb';

// Export all models
export * from '../lib/models';

// Initialize connection (will use cached connection after first call)
export async function getDB() {
  await connectDB();
}
