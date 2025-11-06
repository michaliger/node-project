require('dotenv').config();
require('colors'); 

const app = require('./app');
const connectDB = require('./config/db');

connectDB();

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`שרת רץ על פורט ${port} במצב ${process.env.NODE_ENV}`.yellow.bold);
});