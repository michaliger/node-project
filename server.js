const mongoose = require('mongoose');
const app = require('./app');

const DB = 'mongodb://127.0.0.1:27017/library-db'; // שנה לפי הצורך

mongoose.connect(DB, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('DB מחובר בהצלחה!');
});

const port = 3000;
app.listen(port, () => {
  console.log(`שרת פועל על פורט ${port}...`);
});