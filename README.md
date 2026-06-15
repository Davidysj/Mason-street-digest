# Mason Street Training — Daily News Digest Agent

An automated agent that searches the web each morning and emails a curated digest of relevant news to your Gmail inbox. Built with Node.js, Gemini AI, and deployed on Railway.

---

## What You'll Need Before Starting

- A **Google account** (Gmail) to send emails from
- A **Gemini API key** (free tier works fine)
- A **Railway account** (free tier works for this)
- A **GitHub account** to host the code

This setup takes about 20–30 minutes total.

---

## Step 1 — Get Your Gemini API Key

1. Go to [aistudio.google.com](https://aistudio.google.com)
2. Click **"Get API key"** in the left sidebar
3. Click **"Create API key"**
4. Copy the key and save it somewhere safe — you'll need it in Step 4

---

## Step 2 — Create a Gmail App Password

Gmail requires a special "App Password" instead of your regular password when sending email from apps. This is separate from your normal login.

1. Go to your Google Account at [myaccount.google.com](https://myaccount.google.com)
2. Click **"Security"** in the left sidebar
3. Under "How you sign in to Google," make sure **2-Step Verification is ON** (you need this enabled first — turn it on if it's off)
4. Go back to Security and search for **"App passwords"** (or go directly to [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords))
5. Under "App name," type something like `Mason Street Digest`
6. Click **"Create"**
7. Google will show you a 16-character password (like `abcd efgh ijkl mnop`) — **copy this now**, it won't be shown again
8. Save this password alongside your Gemini API key

---

## Step 3 — Put the Code on GitHub

1. Go to [github.com](https://github.com) and sign in (create an account if needed)
2. Click the **"+"** in the top-right corner → **"New repository"**
3. Name it `mason-street-digest`
4. Set it to **Private**
5. Click **"Create repository"**
6. Follow GitHub's instructions to upload the files from this folder to your new repo
   - The easiest way: click **"uploading an existing file"** on the repo page and drag all the files in this folder (not the `node_modules` folder)

---

## Step 4 — Deploy on Railway

1. Go to [railway.app](https://railway.app) and sign up (you can log in with GitHub)
2. Click **"New Project"**
3. Choose **"Deploy from GitHub repo"**
4. Select your `mason-street-digest` repository
5. Railway will detect it's a Node.js app automatically — click **"Deploy Now"**

### Set Up Environment Variables

After the project is created, click on the service, then go to **"Variables"** tab and add these one by one:

| Variable Name | Value |
|---|---|
| `GEMINI_API_KEY` | Your Gemini API key from Step 1 |
| `GMAIL_ADDRESS` | Your Gmail address (e.g. `you@gmail.com`) |
| `GMAIL_APP_PASSWORD` | The 16-character app password from Step 2 |
| `RECIPIENT_EMAIL` | The email address to send the digest TO (can be same as `GMAIL_ADDRESS`) |

### Configure the Cron Schedule

1. In your Railway project, click on the service
2. Click **"Settings"** tab
3. Scroll down to find **"Cron Schedule"**
4. Enter: `0 8 * * *`
   - This means "run at 8:00 AM every day"
   - Railway uses UTC time — if you're in Eastern Time (ET), 8 AM ET = 1 PM UTC, so use `0 13 * * *` instead
   - **Common time zone offsets from UTC:**
     - Eastern Time (ET): UTC-5 in winter, UTC-4 in summer → use `0 13 * * *` (winter) or `0 12 * * *` (summer)
     - Central Time (CT): UTC-6/UTC-5 → use `0 14 * * *` (winter) or `0 13 * * *` (summer)
     - Mountain Time (MT): UTC-7/UTC-6 → use `0 15 * * *` (winter) or `0 14 * * *` (summer)
     - Pacific Time (PT): UTC-8/UTC-7 → use `0 16 * * *` (winter) or `0 15 * * *` (summer)
5. Click **"Save"**

### Test It Right Now

To make sure everything works before waiting until morning:

1. In the Railway project, go to your service
2. Click **"Deploy"** → **"Trigger Deploy"** (or click the three dots next to a deployment and choose **"Redeploy"**)
3. Click on the deployment to see the logs
4. Within a minute or two you should see: `Email sent — Message ID: ...`
5. Check your inbox — the digest email should arrive

---

## Customizing the Topics

To change what the agent searches for, open `index.js` and find this section near the top:

```javascript
// ============================================================
// TOPIC KEYWORDS — edit these to change what news is searched
// ============================================================
const SEARCH_TOPICS = [
  'skilled trades workforce training programs',
  'vocational training apprenticeship programs news',
  ...
];
// ============================================================
```

Edit the list, save the file, push the change to GitHub — Railway will automatically redeploy.

---

## Troubleshooting

**No email received:**
- Check Railway logs for error messages
- Make sure `GMAIL_ADDRESS` is spelled correctly
- Make sure you used the App Password (not your Gmail login password)
- Confirm 2-Step Verification is enabled on your Google account

**"Missing required environment variables" error:**
- Go to Railway → your service → Variables tab
- Make sure all four variables are set with no typos in the names

**Email goes to spam:**
- Open the email, click "Not spam," and this will train Gmail to trust it

**Gemini API errors:**
- Make sure the API key is correct and has no extra spaces
- Check if you've hit the free tier quota at [aistudio.google.com](https://aistudio.google.com)

---

## Cost

- **Railway**: Free tier includes 500 hours/month of execution time. This agent runs for ~30 seconds/day, so it's essentially free.
- **Gemini API**: Free tier allows 15 requests/day — this agent uses 1 request/day, so it's free.
- **Gmail**: Free.

Total expected cost: **$0/month**.
