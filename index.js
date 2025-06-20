const puppeteer = require('puppeteer');
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs').promises;
const GhostPublisher = require('./ghost-publisher');

class MusicDiscoveryAgent {
  constructor() {
    this.releases = [];
    this.targetGenres = ['electronica', 'electronic', 'post-rock', 'post rock', 'dance', 'ambient', 'experimental'];
  }

  // Scrape Bandcamp new releases
  async scrapeBandcamp() {
    console.log('Scraping Bandcamp...');
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    
    try {
      // Bandcamp discover page for electronic music
      await page.goto('https://bandcamp.com/discover/electronic', { waitUntil: 'networkidle2' });
      
      const releases = await page.evaluate(() => {
        const items = Array.from(document.querySelectorAll('.discover-item'));
        return items.slice(0, 20).map(item => {
          const title = item.querySelector('.discover-detail-inner p:first-child')?.textContent?.trim();
          const artist = item.querySelector('.discover-detail-inner p:nth-child(2)')?.textContent?.trim();
          const link = item.querySelector('a')?.href;
          const genre = item.querySelector('.discover-genre')?.textContent?.trim();
          
          return { title, artist, link, genre, source: 'Bandcamp Electronic' };
        }).filter(item => item.title && item.artist);
      });

      this.releases.push(...releases);
      console.log(`Found ${releases.length} releases from Bandcamp Electronic`);

      // Also check ambient section
      await page.goto('https://bandcamp.com/discover/ambient', { waitUntil: 'networkidle2' });
      
      const ambientReleases = await page.evaluate(() => {
        const items = Array.from(document.querySelectorAll('.discover-item'));
        return items.slice(0, 15).map(item => {
          const title = item.querySelector('.discover-detail-inner p:first-child')?.textContent?.trim();
          const artist = item.querySelector('.discover-detail-inner p:nth-child(2)')?.textContent?.trim();
          const link = item.querySelector('a')?.href;
          const genre = item.querySelector('.discover-genre')?.textContent?.trim();
          
          return { title, artist, link, genre, source: 'Bandcamp Ambient' };
        }).filter(item => item.title && item.artist);
      });

      this.releases.push(...ambientReleases);
      console.log(`Found ${ambientReleases.length} releases from Bandcamp Ambient`);

    } catch (error) {
      console.error('Error scraping Bandcamp:', error);
    } finally {
      await browser.close();
    }
  }

  // Scrape music blogs via RSS
  async scrapeMusicBlogs() {
    console.log('Scraping music blogs...');
    
    const blogFeeds = [
      'https://xlr8r.com/feed/',
      'https://www.residentadvisor.net/xml/rss.aspx',
      'https://thequietus.com/feed'
    ];

    for (const feedUrl of blogFeeds) {
      try {
        const response = await axios.get(feedUrl, { timeout: 10000 });
        const $ = cheerio.load(response.data, { xmlMode: true });
        
        const articles = [];
        $('item').slice(0, 10).each((i, item) => {
          const title = $(item).find('title').text();
          const link = $(item).find('link').text();
          const description = $(item).find('description').text();
          const pubDate = $(item).find('pubDate').text();
          
          // Filter for music-related content
          if (this.isRelevantMusicContent(title + ' ' + description)) {
            articles.push({
              title,
              link,
              description: description.substring(0, 200) + '...',
              pubDate,
              source: `Blog: ${new URL(feedUrl).hostname}`,
              type: 'article'
            });
          }
        });
        
        this.releases.push(...articles);
        console.log(`Found ${articles.length} relevant articles from ${new URL(feedUrl).hostname}`);
        
      } catch (error) {
        console.error(`Error fetching ${feedUrl}:`, error.message);
      }
    }
  }

  // Check if content is relevant to our target genres
  isRelevantMusicContent(text) {
    const lowerText = text.toLowerCase();
    return this.targetGenres.some(genre => lowerText.includes(genre)) ||
           lowerText.includes('album') ||
           lowerText.includes('release') ||
           lowerText.includes('ep') ||
           lowerText.includes('single') ||
           lowerText.includes('track');
  }

  // Use AI to curate and describe releases
  async curateWithAI() {
    console.log('Curating releases with AI...');
    
    if (!process.env.ANTHROPIC_API_KEY) {
      console.log('No API key found, skipping AI curation');
      return this.releases;
    }

    try {
      const prompt = `You are a music curator specializing in electronica, post-rock, and dance music. 
      Here's a list of recent music releases and articles:

      ${JSON.stringify(this.releases.slice(0, 20), null, 2)}

      Please:
      1. Rate each item's relevance to electronica/post-rock/dance music (1-10)
      2. Remove items with rating below 6
      3. Add a brief, engaging description for each remaining item
      4. Sort by relevance and newsworthiness

      Return JSON format with: title, artist, link, source, relevanceScore, description`;

      const response = await axios.post('https://api.anthropic.com/v1/messages', {
        model: 'claude-3-sonnet-20240229',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }]
      }, {
        headers: {
          'Authorization': `Bearer ${process.env.ANTHROPIC_API_KEY}`,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01'
        }
      });

      // Parse AI response and update releases
      const curatedReleases = JSON.parse(response.data.content[0].text);
      this.releases = curatedReleases;
      
    } catch (error) {
      console.error('Error with AI curation:', error.message);
    }
  }

  // Generate weekly digest
  async generateWeeklyDigest() {
    const date = new Date().toISOString().split('T')[0];
    const digestTitle = `Weekly Music Discovery - ${date}`;
    
    let content = `# ${digestTitle}\n\n`;
    content += `*Curated selection of new releases in electronica, post-rock, and dance music*\n\n`;

    // Group by source
    const bySource = this.releases.reduce((acc, release) => {
      if (!acc[release.source]) acc[release.source] = [];
      acc[release.source].push(release);
      return acc;
    }, {});

    for (const [source, releases] of Object.entries(bySource)) {
      content += `## ${source}\n\n`;
      
      releases.forEach(release => {
        content += `**${release.title}**`;
        if (release.artist) content += ` - ${release.artist}`;
        content += `\n`;
        
        if (release.description) {
          content += `${release.description}\n`;
        }
        
        if (release.link) {
          content += `[Listen/Read More](${release.link})\n`;
        }
        content += `\n`;
      });
    }

    // Save to file
    await fs.writeFile(`digest-${date}.md`, content);
    console.log(`Weekly digest saved as digest-${date}.md`);
    
    return content;
  }

  // Main execution
  async run() {
    console.log('Starting Music Discovery Agent...');
    
    try {
      await this.scrapeBandcamp();
      await this.scrapeMusicBlogs();
      await this.curateWithAI();
      
      const digest = await this.generateWeeklyDigest();
      
      // Publish to Ghost if credentials are available
      if (process.env.GHOST_API_URL && process.env.GHOST_ADMIN_API_KEY) {
        try {
          const ghostPublisher = new GhostPublisher();
          await ghostPublisher.publishWeeklyDigest(digest);
          console.log('Successfully published to Ghost!');
        } catch (error) {
          console.error('Error publishing to Ghost:', error.message);
        }
      }
      
      console.log(`\nFound ${this.releases.length} total releases`);
      console.log('Weekly digest generated successfully!');
      
      return digest;
      
    } catch (error) {
      console.error('Error in main execution:', error);
    }
  }
}

// Export for use in Netlify Functions or GitHub Actions
module.exports = MusicDiscoveryAgent;

// Run directly if called from command line
if (require.main === module) {
  const agent = new MusicDiscoveryAgent();
  agent.run();
}
