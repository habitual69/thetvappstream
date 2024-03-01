# TheTvApp StreamScraper

TheTvApp StreamScraper is an innovative server application built on Express, designed to streamline access to HLS live TV streams by dynamically scraping and maintaining updated stream URLs from the `thetvapp.to` website. It combines web scraping with automated browser interactions to offer an efficient and user-friendly way to enjoy live TV channels.

## Features

- **HLS Streaming**: Specialized in fetching HLS (HTTP Live Streaming) links for high-quality TV streaming.
- **Dynamic Channel Listing**: Automatically retrieves and refreshes the list of available TV channels from `thetvapp.to`.
- **Automated Token Retrieval**: Uses Puppeteer to automate the process of token management, ensuring uninterrupted access to streams.
- **Efficient Caching**: Implements caching for both channel listings and HLS stream URLs, optimizing performance and reducing load.
- **Quality Selection**: Prioritizes high-bitrate HLS streams when available, delivering superior video quality.
- **Stream URL Auto-Refresh**: Periodically updates stream URLs to keep them active, ensuring consistent access to TV channels.
- **M3U Playlist Integration**: Generates and serves M3U playlists, making it easy to use with various media players that support streaming.

## Getting Started

### Prerequisites

- Node.js (v14 or later recommended)
- npm (v6 or later)
- Docker (if running with Docker)

### Installation

1. Pull the Docker image from Docker Hub:

```bash
docker pull habitual69/thetvappstream
```

### Usage

#### Running with Docker

To run the server using Docker in host network mode:

```bash
docker run --network host habitual69/thetvappstream
```

Upon starting, the server will fetch the necessary token and channel listings. Access the channel playlist via `http://localhost:5000/channels.m3u` and individual HLS stream URLs by visiting `http://localhost:5000/channel/{channelID}`.

#### Running without Docker

1. Clone the repository:

```bash
git clone https://github.com/habitual69/thetvappstream.git
cd thetvappstream
```

2. Install the dependencies:

```bash
npm install
```

3. Set up environment variables:

Rename the `.env_example` file to `.env` and adjust the variables as needed for your setup.

```plaintext
PORT=5000
TV_URL=https://thetvapp.to
```

4. To run the server:

```bash
node app.js
```

Upon starting, the server will fetch the necessary token and channel listings. Access the channel playlist via `http://localhost:5000/channels.m3u` and individual HLS stream URLs by visiting `http://localhost:5000/channel/{channelID}`.

## Note

If you are deploying this on a server using Docker, make sure to use a reverse proxy like Nginx, Apache, or Cloudflare tunnel to serve the stream over HTTPS or set the Docker network mode to host.

## Development

Contributions to TheTvApp StreamScraper are welcome! Feel free to fork, clone, or submit pull requests to enhance its features or performance.

## License

This project is released under the MIT License - see the LICENSE.md file for details.

## Acknowledgments

- A big thank you to the developers of Express, Axios, Puppeteer, Cheerio, and all other libraries that have contributed to this project.
- Inspired by the streaming community's need for more accessible and high-quality TV streaming solutions.

## Disclaimer

> TheTvApp StreamScraper is not affiliated with `thetvapp.to` and is intended for educational and personal use only. Please respect the terms of service of the website and use this application responsibly.