// ghost-publisher.js
const GhostAdminAPI = require('@tryghost/admin-api');

class GhostPublisher {
  constructor() {
    if (!process.env.GHOST_API_URL || !process.env.GHOST_ADMIN_API_KEY) {
      throw new Error('Ghost API credentials not found in environment variables');
    }

    this.api = new GhostAdminAPI({
      url: process.env.GHOST_API_URL,
      key: process.env.GHOST_ADMIN_API_KEY,
      version: 'v5.0'
    });
  }

  async publishWeeklyDigest(markdownContent) {
    try {
      const date = new Date().toISOString().split('T')[0];
      const title = `Weekly Music Discovery - ${date}`;
      
      // Convert markdown to HTML (basic conversion)
      const htmlContent = this.markdownToHtml(markdownContent);
      
      const post = await this.api.posts.add({
        title: title,
        html: htmlContent,
        status: 'published', // or 'draft' if you want to review first
        tags: ['music', 'weekly-digest', 'electronica', 'post-rock', 'dance'],
        excerpt: 'Weekly curated selection of new releases in electronica, post-rock, and dance music',
        feature_image: null, // Add a URL if you have a default image
        published_at: new Date().toISOString()
      });

      console.log(`Post published successfully: ${post.url}`);
      return post;

    } catch (error) {
      console.error('Error publishing to Ghost:', error);
      throw error;
    }
  }

  // Basic markdown to HTML conversion
  markdownToHtml(markdown) {
    return markdown
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/^(.*)$/gm, '<p>$1</p>')
      .replace(/<p><h/g, '<h')
      .replace(/<\/h([1-6])><\/p>/g, '</h$1>')
      .replace(/<p><\/p>/g, '');
  }

  async createDraft(markdownContent) {
    try {
      const date = new Date().toISOString().split('T')[0];
      const title = `Weekly Music Discovery - ${date}`;
      
      const htmlContent = this.markdownToHtml(markdownContent);
      
      const post = await this.api.posts.add({
        title: title,
        html: htmlContent,
        status: 'draft',
        tags: ['music', 'weekly-digest', 'electronica', 'post-rock', 'dance'],
        excerpt: 'Weekly curated selection of new releases in electronica, post-rock, and dance music'
      });

      console.log(`Draft created successfully: ${post.id}`);
      return post;

    } catch (error) {
      console.error('Error creating draft:', error);
      throw error;
    }
  }
}

module.exports = GhostPublisher;
