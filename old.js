const express = require('express');
const axios = require('axios');
const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const app = express();

// Hardcoded values
const TV_URL = "https://thetvapp.to";
const VISIBLE_URL = "http://127.0.0.1:5000";

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
  const res = {};
  const indexHTML = (await axios.get(TV_URL)).data;
  const channelListRegex = /<a class="list-group-item" href="([^"]+)">([^<]+)<\/a>/g;
  let match;

  while ((match = channelListRegex.exec(indexHTML)) !== null) {
    const name = match[2];
    const streamHTML = (await axios.get(new URL(match[1], TV_URL).href)).data;
    const streamIdMatch = /<div id="stream_name" stream-name="([^"]+)"><\/div>/.exec(streamHTML);

    if (streamIdMatch) {
      res[name.replace("&amp;", "&")] = streamIdMatch[1];
    }
  }

  return res;
}

async function getStream(chid, token, channels) {
  if (!Object.values(channels).includes(chid)) {
    throw new Error('Channel not found');
  }

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

  // Assuming the response contains the streaming URL directly
  return r2.data;
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
    const streamUrl = await getStream(req.params.channel, tokenSniffer.token, channels);
    console.log("Redirected to: " + streamUrl);
    res.redirect(streamUrl);
  } catch (error) {
    console.error(error.message);
    if (error.message === 'Invalid token') {
      await tokenSniffer.refresh();
      try {
        // Attempt to fetch and redirect again after refreshing the token
        const streamUrl = await getStream(req.params.channel, tokenSniffer.token, channels);
        res.redirect(streamUrl);
        console.log("Token refreshed successfully");

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
  app.listen(5000, () => {
    console.log('Server running on http://127.0.0.1:5000');
  });
})();
