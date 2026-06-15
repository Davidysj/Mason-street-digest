const nodemailer = require('nodemailer');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// ============================================================
// TOPIC KEYWORDS — edit these to change what news is searched
// ============================================================
const SEARCH_TOPICS = [
  'skilled trades workforce training programs',
  'vocational training apprenticeship programs news',
  'skilled labor shortage construction manufacturing',
  'trade workforce development funding',
  'blue collar worker training AI automation impact',
  'Attatche Mason Street Training workforce',
];
// ============================================================

async function searchAndSummarize() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash-lite',
    tools: [{ googleSearch: {} }],
  });

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const prompt = `Today is ${today}.

Search for recent news articles published in the past 7 days that are relevant to these topics:
${SEARCH_TOPICS.map(t => `- ${t}`).join('\n')}

Background context: These topics relate to Attatche / Mason Street Training, a company focused on skilled trades workforce development, training programs, and connecting employers with trade workers. They care about news covering skilled labor markets, workforce training initiatives, apprenticeship programs, policy affecting trade workers, and the intersection of AI/automation with blue-collar employment.

A relevant article is one where the primary subject is skilled trades, workforce training, or trade labor markets. Articles that only mention these topics briefly are NOT relevant — skip them.

Find between 1 and 5 genuinely relevant articles. Do not pad to reach 5. Zero is acceptable if nothing relevant was published.

For each article provide:
1. The exact headline
2. A 2–3 sentence summary explaining what the article covers and why it matters to a workforce training company
3. The full URL

Respond ONLY with a valid JSON array in this exact format (no markdown, no explanation):
[
  {
    "headline": "Exact Article Title",
    "summary": "2-3 sentence summary here.",
    "url": "https://example.com/article"
  }
]

If no relevant recent articles are found, return exactly: []`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();

  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    console.warn('No JSON array found in Gemini response. Raw response:', text.slice(0, 500));
    return [];
  }

  try {
    const articles = JSON.parse(jsonMatch[0]);
    return Array.isArray(articles) ? articles.slice(0, 5) : [];
  } catch (err) {
    console.error('Failed to parse JSON from Gemini response:', err.message);
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
  const required = ['GEMINI_API_KEY', 'GMAIL_ADDRESS', 'GMAIL_APP_PASSWORD'];
  const missing = required.filter(k => !process.env[k]);
  if (missing.length > 0) {
    console.error(`Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }

  console.log(`[${new Date().toISOString()}] Starting Mason Street Training news digest...`);

  const articles = await searchAndSummarize();
  console.log(`Found ${articles.length} relevant article(s).`);
  articles.forEach((a, i) => console.log(`  ${i + 1}. ${a.headline}`));

  await sendEmail(articles);
  console.log('Done.');
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
