// ✅ JWT Token Generator Script
// Usage: node generate-token.js
// This script generates a JWT token for testing purposes

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Sample user data
const user = {
  _id: '507f1f77bcf86cd799439011',
  email: 'admin@example.com'
};

try {
  const token = jwt.sign(
    { 
      id: user._id, 
      email: user.email 
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  console.log('\n✅ JWT TOKEN GENERATED SUCCESSFULLY!\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n📧 User Email:', user.email);
  console.log('🔑 Token:', token);
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // Show how to use it
  console.log('📋 HOW TO USE THIS TOKEN:\n');
  console.log('1️⃣  In Frontend localStorage:');
  console.log('   localStorage.setItem("token", "' + token + '");\n');
  
  console.log('2️⃣  In API Request Headers:');
  console.log('   Authorization: Bearer ' + token + '\n');
  
  console.log('3️⃣  cURL Example:');
  console.log(`   curl -H "Authorization: Bearer ${token}" http://localhost:5000/candidates\n`);
  
  // Decode to show token details
  const decoded = jwt.decode(token);
  console.log('📊 Token Details:');
  console.log('   - User ID:', decoded.id);
  console.log('   - Email:', decoded.email);
  console.log('   - Expires at:', new Date(decoded.exp * 1000).toLocaleString(), '\n');
  
} catch (error) {
  console.error('❌ Error generating token:', error.message);
}
