// utils/error.handler.js
// כלי עזר לטיפול בטעויות ב-async functions
// חוסך כתיבת try/catch בכל פונקציה בקונטרולר

const catchasync = (fn) => {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
};

module.exports = { catchasync };