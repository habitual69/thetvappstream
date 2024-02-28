const puppeteer = require('puppeteer');
const { TV_URL } = require('./config');

class TokenSniffer {
  constructor() {
    this.token = null;
  }

  async refresh() {
    const browser = await puppeteer.launch({
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
      ],
    });
    
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

module.exports = TokenSniffer;
