const express = require('express');
const router = express.Router();
const Event = require('../models/Event');

router.get('/sitemap.xml', async (req, res) => {
  try {
    const frontendUrl = 'https://aiversevitb.in';
    
    // Static Routes
    const staticRoutes = [
      '',
      '/events',
      '/gallery',
      '/team',
      '/contact',
      '/login'
    ];

    // Fetch active events from DB
    // Assuming Event model has at least _id, status
    const events = await Event.find({ status: { $ne: 'Draft' } }).select('_id updatedAt');

    // Build the XML
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

    // Add static routes
    staticRoutes.forEach((route) => {
      xml += `  <url>\n`;
      xml += `    <loc>${frontendUrl}${route}</loc>\n`;
      xml += `    <changefreq>weekly</changefreq>\n`;
      xml += `    <priority>${route === '' ? '1.0' : '0.8'}</priority>\n`;
      xml += `  </url>\n`;
    });

    // Add dynamic event routes
    events.forEach((event) => {
      xml += `  <url>\n`;
      xml += `    <loc>${frontendUrl}/events/${event._id}</loc>\n`;
      if (event.updatedAt) {
        xml += `    <lastmod>${event.updatedAt.toISOString()}</lastmod>\n`;
      }
      xml += `    <changefreq>daily</changefreq>\n`;
      xml += `    <priority>0.9</priority>\n`;
      xml += `  </url>\n`;
    });

    xml += `</urlset>`;

    res.header('Content-Type', 'application/xml');
    res.send(xml);
  } catch (error) {
    console.error('Error generating sitemap:', error);
    res.status(500).send('Error generating sitemap');
  }
});

module.exports = router;
