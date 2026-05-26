const { pool, query } = require('./database');
const auth = require('./auth');
const sendEmail = require('./sendEmail');

module.exports = {
  pool,
  query,
  auth,
  sendEmail
};
