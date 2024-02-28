const fs = require('fs').promises;
const os = require('os');

async function getChannelLogos() {
  const json = await fs.readFile('./channelLogos.json', 'utf8');
  return JSON.parse(json);
}

function getSystemIPAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '0.0.0.0';
}

module.exports = { getChannelLogos, getSystemIPAddress };
