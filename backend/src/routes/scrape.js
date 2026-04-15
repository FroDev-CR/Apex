import { Router } from 'express';
import { runScraper, getLastScrapeTime } from '../scraper/supplyProScraper.js';

export const scrapeRoutes = Router();

// Track if a scrape is in progress to prevent concurrent scrapes
let scrapeInProgress = false;

/**
 * POST /api/scrape
 * Trigger a manual scrape of Supply Pro orders
 */
scrapeRoutes.post('/', async (req, res) => {
  try {
    // Prevent concurrent scrapes
    if (scrapeInProgress) {
      return res.status(409).json({
        error: 'A scrape is already in progress',
        message: 'Please wait for the current scrape to complete'
      });
    }

    scrapeInProgress = true;
    console.log('🔍 Manual scrape triggered via API');

    // Run scraper
    const result = await runScraper();

    scrapeInProgress = false;

    res.json({
      success: true,
      message: 'Scrape completed successfully',
      ...result
    });
  } catch (error) {
    scrapeInProgress = false;
    console.error('❌ Manual scrape failed:', error.message);
    res.status(500).json({
      error: 'Scrape failed',
      message: error.message
    });
  }
});

/**
 * GET /api/scrape/status
 * Get the current scrape status and last scrape time
 */
scrapeRoutes.get('/status', async (req, res) => {
  try {
    const lastScrapeTime = await getLastScrapeTime();

    res.json({
      inProgress: scrapeInProgress,
      lastScrapeTime: lastScrapeTime?.toISOString() || null
    });
  } catch (error) {
    console.error('❌ Error getting scrape status:', error.message);
    res.status(500).json({ error: 'Failed to get scrape status' });
  }
});
