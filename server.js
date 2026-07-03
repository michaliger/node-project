require('dotenv').config();
console.log("MONGO_URI is:", process.env.MONGO_URI);
require('colors'); 

const app = require('./app');
const connectDB = require('./config/db');

connectDB();

const port = process.env.PORT || 5000;

// הפעלת השרת והאזנה לפורט (כולל הגדרת ה-IP החיצוני עבור השרת המרוחק)
app.listen(port, '0.0.0.0', () => {
  console.log(`שרת רץ על פורט ${port} במצב ${process.env.NODE_ENV || 'development'}`.yellow.bold);
});