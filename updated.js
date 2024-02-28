const express = require('express');
const axios = require('axios');
const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const fs = require('fs').promises;
const os = require('os');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const TV_URL = process.env.TV_URL || "https://thetvapp.to";
const IP = getSystemIPAddress();
const VISIBLE_URL = `http://${IP}:${PORT}`;

let channelsCache = {};
let streamsCache = {};

class TokenSniffer {
  constructor() {
    this.token = null;
  }

  async refresh() {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    page.on('request', interceptedRequest => {
      if (interceptedRequest.url().includes('/token/')) {
        this.token = JSON.parse(interceptedRequest.postData()).password;
        console.log("New token: " + this.token);
      }
    });

    await page.goto(new URL('/tv/ae-live-stream/', TV_URL).href);
    await browser.close();
  }
}

// Instantiate TokenSniffer after its declaration
const tokenSniffer = new TokenSniffer();

app.get('/channels.m3u', handleChannelsRequest);
app.get('/channel/:channel', handleChannelRequest);

startServer();

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

class TokenSniffer {
  constructor() {
    this.token = null;
  }

  async refresh() {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    page.on('request', interceptedRequest => {
      if (interceptedRequest.url().includes('/token/')) {
        this.token = JSON.parse(interceptedRequest.postData()).password;
        console.log("New token: " + this.token);
      }
    });

    await page.goto(new URL('/tv/ae-live-stream/', TV_URL).href);
    await browser.close();
  }
}

async function listChannels() {
  if (Object.keys(channelsCache).length === 0) {
    const indexHTML = await axios.get(TV_URL).then(response => response.data);
    const channelListRegex = /<a class="list-group-item" href="([^"]+)">([^<]+)<\/a>/g;
    let match;
    let promises = [];

    while ((match = channelListRegex.exec(indexHTML)) !== null) {
      const name = match[2].replace("&amp;", "&");
      const channelUrl = new URL(match[1], TV_URL).href;
      promises.push(fetchChannel(name, channelUrl));
    }
    await Promise.all(promises);
    channelsCache = sortObjectByKey(channelsCache);
  }
  return channelsCache;
}

async function fetchChannel(name, channelUrl) {
  try {
    const response = await axios.get(channelUrl);
    const streamHTML = response.data;
    const streamIdMatch = /<div id="stream_name" stream-name="([^"]+)"><\/div>/.exec(streamHTML);
    if (streamIdMatch) {
      channelsCache[name] = streamIdMatch[1];
    }
  } catch (error) {
    console.error(`Failed to fetch channel ${name}: ${error}`);
  }
}

async function getStream(chid, token) {
  if (streamsCache[chid] && new Date().getTime() - streamsCache[chid].timestamp < 4 * 60 * 60 * 1000) {
    return streamsCache[chid].url;
  }
  const response = await axios.get(TV_URL);
  const $ = cheerio.load(response.data);
  const csrfToken = $('meta[name="csrf-token"]').attr('content');

  if (!csrfToken) {
    throw new Error('CSRF token not found');
  }

  const streamResponse = await axios.post(new URL(`/token/${chid}`, TV_URL).href, {
    password: token
  }, {
    headers: {
      "Content-Type": "application/json",
      "X-Csrf-Token": csrfToken,
      "Cookie": response.headers['set-cookie'].join('; ')
    }
  });

  if (streamResponse.status !== 200) {
    throw new Error('Invalid token');
  }

  const streamUrl = parseStreamUrl(streamResponse.data, chid);
  streamsCache[chid] = { url: streamUrl, timestamp: new Date().getTime() };
  return streamUrl;
}

async function parseStreamUrl(data, chid) {
  try {
    const jsonData = JSON.parse(data);
    if (Array.isArray(jsonData)) {
      return jsonData.find(url => url.includes('_high.m3u8')) || jsonData[jsonData.length - 1];
    }
  } catch (error) {
    if (typeof data === 'string' && data.includes('.m3u8')) {
      return data;
    }
  }
  throw new Error(`Stream URL parsing error for channel ID ${chid}`);
}

async function handleChannelsRequest(req, res) {
  const channels = await listChannels();
  const channelLogos = await getChannelLogos();
  let m3u = "#EXTM3U";
  Object.entries(channels).forEach(([name, chid], i) => {
    const logo = (channelLogos.channels.find(channel => channel.name === name) || {}).logo || '';
    m3u += `\n#EXTINF:-1 tvg-chno="${i + 1}" tvg-logo="${logo}", ${name}\n${VISIBLE_URL}/channel/${chid}`;
  });
  res.send(m3u);
}

async function handleChannelRequest(req, res) {
  try {
    const streamUrl = await getStream(req.params.channel, tokenSniffer.token);
    res.redirect(streamUrl);
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Error processing your request.");
  }
}

async function startServer() {
  await tokenSniffer.refresh();
  refreshAllStreams();
  setInterval(refreshAllStreams, 4 * 60 * 60 * 1000);
  app.listen(PORT, () => console.log(`Server running on ${VISIBLE_URL}`));
}

function sortObjectByKey(obj) {
  return Object.keys(obj).sort().reduce((accumulator, key) => {
    accumulator[key] = obj[key];
    return accumulator;
  }, {});
}

async function refreshAllStreams() {
  const channels = await listChannels();
  for (const chid of Object.values(channels)) {
    try {
      await getStream(chid, tokenSniffer.token);
    } catch (error) {
      console.error(`Error refreshing stream for channel ID ${chid}: ${error.message}`);
    }
  }
}
