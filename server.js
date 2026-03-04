require('dotenv').config();
console.log("MONGO_URI is:", process.env.MONGO_URI);
require('colors'); 

const app = require('./app');
const connectDB = require('./config/db');

connectDB();

const port = process.env.PORT || 5000;

app.listen(port, () => {
  console.log(`שרת רץ על פורט ${port} במצב ${process.env.NODE_ENV}`.yellow.bold);
});