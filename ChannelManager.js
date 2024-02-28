const axios = require('axios');
const cheerio = require('cheerio');
const { TV_URL } = require('./config');

class ChannelManager {
  constructor() {
    this.channelsCache = {};
    this.streamsCache = {};
  }

  async listChannels() {
    if (Object.keys(this.channelsCache).length === 0) {
      const indexHTML = await axios.get(TV_URL).then(response => response.data);
      const channelListRegex = /<a class="list-group-item" href="([^"]+)">([^<]+)<\/a>/g;
      let match;
      let promises = [];

      while ((match = channelListRegex.exec(indexHTML)) !== null) {
        const name = match[2].replace("&amp;", "&");
        const channelUrl = new URL(match[1], TV_URL).href;
        promises.push(
          axios.get(channelUrl).then(response => {
            const streamHTML = response.data;
            const streamIdMatch = /<div id="stream_name" stream-name="([^"]+)"><\/div>/.exec(streamHTML);
            if (streamIdMatch) {
              this.channelsCache[name] = streamIdMatch[1];
            }
          }).catch(error => {
            console.error(`Failed to fetch channel ${name}: ${error}`);
          })
        );
      }
      await Promise.all(promises);
      let sortedChannelsCache = {};
      Object.keys(this.channelsCache).sort().forEach(key => {
        sortedChannelsCache[key] = this.channelsCache[key];
      });
      this.channelsCache = sortedChannelsCache;
    }

    return this.channelsCache;
  }

  async getStream(chid, token) {
    if (this.streamsCache[chid] && new Date().getTime() - this.streamsCache[chid].timestamp < 4 * 60 * 60 * 1000) {
      return this.streamsCache[chid].url;
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

    let streamUrl = r2.data; // Direct URL response

    try {
      const data = JSON.parse(streamUrl);
      if (Array.isArray(data)) {
        streamUrl = data.find(url => url.includes('_high.m3u8')) || data[data.length - 1];
      }
    } catch (error) {
      if (typeof streamUrl === 'string' && streamUrl.includes('.m3u8')) {
        const playlistResponse = await axios.get(streamUrl);
        const lines = playlistResponse.data.split('\n');
        const highBitrateUrl = lines.find(line => line.includes('_high.m3u8'));
        if (highBitrateUrl) {
          streamUrl = new URL(highBitrateUrl, streamUrl).href;
        }
      }
    }

    this.streamsCache[chid] = { url: streamUrl, timestamp: new Date().getTime() };
    return streamUrl;
  }

  async refreshAllStreams(tokenSniffer) {
    const channels = await this.listChannels();
    for (const chid of Object.values(channels)) {
      try {
        await this.getStream(chid, tokenSniffer.token); // Refresh and cache each stream URL
      } catch (error) {
        console.error(`Error refreshing stream for channel ID ${chid}: ${error.message}`);
      }
    }
  }
}

module.exports = ChannelManager;
