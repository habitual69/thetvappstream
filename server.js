const express = require('express');
const axios = require('axios');
const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const app = express();
const dotenv = require('dotenv');
const os = require('os');
dotenv.config();


// Function to find the first non-internal IPv4 address
function getSystemIPAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      const { family, internal, address } = iface;
      if (family === 'IPv4' && !internal) {
        return address;
      }
    }
  }
  return '0.0.0.0'; // Fallback if no external IPv4 address is found
}

const IP = getSystemIPAddress();
PORT=process.env.PORT || 5000;
TV_URL=process.env.TV_URL || "https://thetvapp.to";
VISIBLE_URL=`http://${IP}:${PORT}` || `http://localhost:${PORT}`;


// Caching objects
let channelsCache = {}; // Cache for channel list
let streamsCache = {}; // Cache for stream URLs with expiration

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

    await page.goto(new URL('/tv/fox-news-channel-live-stream/', TV_URL).href);
    await browser.close();
  }
}

async function listChannels() {
  if (Object.keys(channelsCache).length === 0) {
    // Fetch and cache channels if not already cached
    const indexHTML = (await axios.get(TV_URL)).data;
    const channelListRegex = /<a class="list-group-item" href="([^"]+)">([^<]+)<\/a>/g;
    let match;

    while ((match = channelListRegex.exec(indexHTML)) !== null) {
      const name = match[2];
      const streamHTML = (await axios.get(new URL(match[1], TV_URL).href)).data;
      const streamIdMatch = /<div id="stream_name" stream-name="([^"]+)"><\/div>/.exec(streamHTML);

      if (streamIdMatch) {
        channelsCache[name.replace("&amp;", "&")] = streamIdMatch[1];
      }
    }
  }

  return channelsCache;
}

async function getStream(chid, token) {
    // Check cache first
    if (streamsCache[chid] && new Date().getTime() - streamsCache[chid].timestamp < 4 * 60 * 60 * 1000) {
      return streamsCache[chid].url; // Return cached URL if valid
    }
  
    // Fetch new stream URL if not cached or expired
    const r1 = await axios.get(TV_URL);
    const $ = cheerio.load(r1.data);
    const csrftoken = $('meta[name="csrf-token"]').attr('content');
  
    if (!csrftoken) {
      throw new Error('CSRF token not found');
    }
  
    const r2 = await axios.post(new URL(`/token/${chid}`, TV_URL).href, {
      password: token
    }, {
      headers: {
        "Content-Type": "application/json",
        "X-Csrf-Token": csrftoken,
        "Cookie": r1.headers['set-cookie'].join('; ')
      }
    });
  
    if (r2.status !== 200) {
      throw new Error('Invalid token');
    }
  
    // Process the response to select the high bitrate link
    let streamUrl = r2.data; // Default to the direct response if applicable
    if (typeof r2.data === 'string' && r2.data.includes('_high.m3u8')) {
      // This assumes the response is a direct URL to the high bitrate stream
      streamUrl = r2.data;
    } else if (typeof r2.data === 'object' && Array.isArray(r2.data)) {
      // If the response is an array, find the high bitrate URL
      const highBitrateLink = r2.data.find(link => link.includes('_high.m3u8'));
      streamUrl = highBitrateLink || r2.data[0]; // Fallback to the first link if high bitrate isn't found
    }
  
    // Cache and return the new URL
    streamsCache[chid] = { url: streamUrl, timestamp: new Date().getTime() };
    return streamUrl;
  }
  

async function refreshAllStreams() {
  const channels = await listChannels();
  for (const chid of Object.values(channels)) {
    try {
      await getStream(chid, tokenSniffer.token); // Refresh and cache each stream URL
    } catch (error) {
      console.error(`Error refreshing stream for channel ID ${chid}: ${error.message}`);
    }
  }
}

const tokenSniffer = new TokenSniffer();

app.get('/channels.m3u', async (req, res) => {
  const channels = await listChannels();
  let m3u = "#EXTM3U";
  Object.entries(channels).forEach(([name, value], i) => {
    m3u += `\n#EXTINF:-1 tvg-chno="${i + 1}", ${name}\n${VISIBLE_URL}/channel/${value}`;
  });
  res.send(m3u);
});

app.get('/channel/:channel', async (req, res) => {
  try {
    const channels = await listChannels();
    const streamUrl = await getStream(req.params.channel, tokenSniffer.token);
    res.redirect(streamUrl);
  } catch (error) {
    console.error(error.message);
    if (error.message === 'Invalid token') {
      await tokenSniffer.refresh();
      try {
        // Attempt to fetch and redirect again after refreshing the token
        const streamUrl = await getStream(req.params.channel, tokenSniffer.token);
        res.redirect(streamUrl);
      } catch (error) {
        console.error(error.message);
        res.status(500).send(error.message);
      }
    } else {
      res.status(404).send("Channel does not exist, or is blocked.");
    }
  }
});

(async () => {
  await tokenSniffer.refresh(); // Ensure the token is fetched before starting the server
  refreshAllStreams(); // Initial refresh of all stream URLs in the background
  setInterval(refreshAllStreams, 4 * 60 * 60 * 1000); // Refresh every 4 hours
  app.listen(5000, () => {
    console.log(`Server running on ${VISIBLE_URL}`);
  });
})();
