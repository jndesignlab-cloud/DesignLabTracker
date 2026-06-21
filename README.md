# DesignLab Tracker

A lightweight, open-source social media content planner built with HTML, CSS, JavaScript, Google Sheets, Google Apps Script, and GitHub Pages.

## Version

Current release: **v1.1.0**

## Features

- Monthly content calendar
- Dynamic managed-page tabs from Google Sheets
- Default pages: DesignLab and DesignLab Downloads
- Add, edit, and delete posts
- Time-based auto-sorting inside each calendar day
- Statuses: Idea, Created, Scheduled, Posted
- Quick status-update icon directly on each card
- Current Manila time and date in the header
- Floating refresh button
- Monthly status counters
- Google Sheets database
- Apps Script backend
- GitHub Pages compatible
- Responsive light DesignLab interface
- Centralized settings in `config.js`
- Footer version and last-refresh timestamp

## Project Structure

```text
DesignLabTracker/
├── index.html
├── style.css
├── script.js
├── config.js
├── README.md
├── CHANGELOG.md
├── LICENSE
└── apps-script/
    └── Code.gs
```

## Setup

### 1. Create the Google Sheet

Create a Google Sheet, then open:

`Extensions → Apps Script`

Paste the contents of `apps-script/Code.gs`.

Run this function once:

```javascript
setupPlannerSheets()
```

This creates or prepares:

- `Pages`
- `Posts`

The `Posts` sheet uses these headers:

```text
ID | Page | Date | Time | Title | Caption | Status | Platform | Notes | CreatedAt | UpdatedAt
```

### 2. Deploy Apps Script

Go to:

`Deploy → New deployment → Web app`

Use:

- Execute as: **Me**
- Who has access: **Anyone**

Copy the URL ending in `/exec`.

### 3. Configure the frontend

Open `config.js` and replace:

```javascript
API_URL: "PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE"
```

with your Apps Script Web App URL.

### 4. Publish on GitHub Pages

Upload the files to your repository, then go to:

`Settings → Pages`

Choose:

- Source: Deploy from a branch
- Branch: `main`
- Folder: `/root`

## Quick Status Button

Each calendar card has a small icon. Clicking it cycles through:

```text
Idea → Created → Scheduled → Posted → Idea
```

Clicking anywhere else on the card opens the full edit form.

## Adding Future Pages

Add rows to the `Pages` sheet:

```text
ID | PageName | IsActive | CreatedAt | UpdatedAt
```

Set `IsActive` to `TRUE`, refresh the app, and the new tab appears automatically.

## Security Reminder

Do not publish private client data, private Google Sheet URLs, tokens, or confidential links in the public repository. The Apps Script Web App URL is not a secret credential, but use a separate demo database for public demos.

## License

MIT License. See `LICENSE`.
