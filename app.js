const express = require('express');
const { getChannelLogos, getSystemIPAddress } = require('./utils');
const TokenSniffer = require('./TokenSniffer');
const ChannelManager = require('./ChannelManager');
const { PORT } = require('./config');

const app = express();
const IP = getSystemIPAddress();
const VISIBLE_URL = `http://${IP}:${PORT}`;
const tokenSniffer = new TokenSniffer();
const channelManager = new ChannelManager();

app.get('/channels.m3u', async (req, res) => {
  const channels = await channelManager.listChannels();
  const channelLogos = await getChannelLogos();
  let m3u = "#EXTM3U";
  Object.entries(channels).forEach(([name, value], i) => {
    const logo = channelLogos.channels.find(channel => channel.name === name)?.logo || '';
    m3u += `\n#EXTINF:-1 tvg-chno="${i + 1}" tvg-logo="${logo}", ${name}\n${VISIBLE_URL}/channel/${value}`;
  });
  res.send(m3u);
});

app.get('/channel/:channel', async (req, res) => {
  try {
    const streamUrl = await channelManager.getStream(req.params.channel, tokenSniffer.token);
    res.redirect(streamUrl);
  } catch (error) {
    console.error(error.message);
    if (error.message === 'Invalid token') {
      await tokenSniffer.refresh();
      try {
        const streamUrl = await channelManager.getStream(req.params.channel, tokenSniffer.token);
        res.redirect(streamUrl);
      } catch (error) {
        console.error(error.message);
        res.status(500).send(error.message);
        await tokenSniffer.refresh();
      }
    } else {
      res.status(404).send("Channel does not exist, or is blocked.");
      await tokenSniffer.refresh();
    }
  }
});

(async () => {
  await tokenSniffer.refresh();
  channelManager.refreshAllStreams(tokenSniffer);
  app.listen(PORT, () => {
    console.log(`Server running on http://${IP}:${PORT}`);
  });
})();
