const nodemailer = require('nodemailer');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const https = require('https');

// ============================================================
// TOPIC KEYWORDS — edit these to change what news is searched
// ============================================================
const SEARCH_QUERIES = [
  'skilled trades workforce training',
  'vocational training apprenticeship',
  'skilled labor shortage',
  'trade workforce development',
  'blue collar worker training automation',
];
// ============================================================

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

async function fetchArticles() {
  const apiKey = process.env.NEWS_API_KEY;
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const allArticles = [];

  for (const query of SEARCH_QUERIES) {
    const encoded = encodeURIComponent(query);
    const url = `https://newsapi.org/v2/everything?q=${encoded}&from=${sevenDaysAgo}&sortBy=relevancy&pageSize=5&language=en&apiKey=${apiKey}`;

    try {
      const data = await fetchJson(url);
      if (data.articles) {
        allArticles.push(...data.articles);
      }
    } catch (err) {
      console.warn(`Failed to fetch for query "${query}":`, err.message);
    }
  }

  // Deduplicate by URL
  const seen = new Set();
  return allArticles.filter(a => {
    if (!a.url || seen.has(a.url)) return false;
    seen.add(a.url);
    return true;
  });
}

async function filterAndSummarize(rawArticles) {
  if (rawArticles.length === 0) return [];

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  const articleList = rawArticles.slice(0, 20).map((a, i) =>
    `[${i}] Title: ${a.title}\nSource: ${a.source?.name || 'Unknown'}\nDescription: ${a.description || 'No description'}\nURL: ${a.url}`
  ).join('\n\n');

  const prompt = `You are a news curator for Attatche / Mason Street Training, a company focused on skilled trades workforce development and training programs.

Here are recent news articles. Your job is to:
1. Select only the genuinely relevant ones (where skilled trades, workforce training, apprenticeships, or trade labor markets is the PRIMARY topic — not just mentioned briefly)
2. Write a 2-3 sentence summary for each selected article explaining what it covers and why it matters to a workforce training company
3. Return between 1 and 5 articles. Do not pad — return fewer if only a few are truly relevant. Return none if nothing qualifies.

Articles:
${articleList}

Respond ONLY with a valid JSON array (no markdown, no explanation):
[
  {
    "index": 0,
    "headline": "exact article title",
    "summary": "2-3 sentence summary here.",
    "url": "https://..."
  }
]

If no articles are relevant, return exactly: []`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();

  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    console.warn('No JSON found in Gemini response:', text.slice(0, 300));
    return [];
  }

  try {
    const selected = JSON.parse(jsonMatch[0]);
    return Array.isArray(selected) ? selected.slice(0, 5) : [];
  } catch (err) {
    console.error('Failed to parse Gemini JSON:', err.message);
    return [];
  }
}

function buildEmailHtml(articles) {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const header = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px 20px;">
      <div style="border-bottom: 3px solid #1e40af; padding-bottom: 14px; margin-bottom: 20px;">
        <h1 style="margin: 0; font-size: 20px; color: #1e293b;">Mason Street Training</h1>
        <p style="margin: 4px 0 0; font-size: 15px; color: #64748b;">Daily News Digest &nbsp;·&nbsp; ${today}</p>
      </div>
  `;

  const footer = `
      <p style="margin-top: 32px; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 16px;">
        Automated digest powered by Gemini AI &nbsp;·&nbsp; Attatche / Mason Street Training
      </p>
    </div>
  `;

  if (articles.length === 0) {
    return header + `
      <p style="color: #475569; line-height: 1.6;">
        No highly relevant articles were found today. The digest will resume tomorrow.
      </p>
    ` + footer;
  }

  const articleBlocks = articles.map((a) => `
    <div style="margin-bottom: 28px; padding-bottom: 28px; border-bottom: 1px solid #e2e8f0;">
      <h2 style="margin: 0 0 10px; font-size: 16px; line-height: 1.4;">
        <a href="${escapeHtml(a.url)}" style="color: #1d4ed8; text-decoration: none;">${escapeHtml(a.headline)}</a>
      </h2>
      <p style="margin: 0 0 10px; color: #374151; line-height: 1.65; font-size: 14px;">${escapeHtml(a.summary)}</p>
      <a href="${escapeHtml(a.url)}" style="font-size: 12px; color: #6b7280; word-break: break-all;">${escapeHtml(a.url)}</a>
    </div>
  `).join('');

  return header + `
    <p style="color: #475569; font-size: 14px; margin-bottom: 24px;">
      ${articles.length} article${articles.length !== 1 ? 's' : ''} found today:
    </p>
    ${articleBlocks}
  ` + footer;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function sendEmail(articles) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_ADDRESS,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });

  const dateShort = new Date().toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });

  const subject = articles.length === 0
    ? `[Mason Street Digest] No new articles — ${dateShort}`
    : `[Mason Street Digest] ${articles.length} article${articles.length !== 1 ? 's' : ''} — ${dateShort}`;

  const info = await transporter.sendMail({
    from: `"Mason Street News Agent" <${process.env.GMAIL_ADDRESS}>`,
    to: process.env.RECIPIENT_EMAIL || process.env.GMAIL_ADDRESS,
    subject,
    html: buildEmailHtml(articles),
  });

  console.log(`Email sent — Message ID: ${info.messageId}`);
}

async function main() {
  const required = ['GEMINI_API_KEY', 'GMAIL_ADDRESS', 'GMAIL_APP_PASSWORD', 'NEWS_API_KEY'];
  const missing = required.filter(k => !process.env[k]);
  if (missing.length > 0) {
    console.error(`Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }

  console.log(`[${new Date().toISOString()}] Starting Mason Street Training news digest...`);

  const rawArticles = await fetchArticles();
  console.log(`Fetched ${rawArticles.length} raw articles from NewsAPI.`);

  const articles = await filterAndSummarize(rawArticles);
  console.log(`Selected ${articles.length} relevant article(s).`);
  articles.forEach((a, i) => console.log(`  ${i + 1}. ${a.headline}`));

  await sendEmail(articles);
  console.log('Done.');
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
