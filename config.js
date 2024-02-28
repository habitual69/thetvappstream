const dotenv = require('dotenv');
dotenv.config();

module.exports = {
  PORT: process.env.PORT || 5000,
  TV_URL: process.env.TV_URL || "https://thetvapp.to",
};
