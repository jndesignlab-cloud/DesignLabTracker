window.APP_CONFIG = Object.freeze({
  APP_NAME: "DesignLab Content Planner",
  APP_VERSION: "1.2.0",
  API_URL: "https://script.google.com/macros/s/AKfycbykZtV6k4xfAOAr8oo17v2CxsMeVIrt-baZDCqAXuP3l5xyi1lH0s7KLa3MZYHxwVe8gw/exec",
  DEFAULT_PAGE: "DesignLab",
  LOCALE: "en-PH",
  TIME_ZONE: "Asia/Manila",
  REFRESH_INTERVAL_MS: 0,
  STATUS_ORDER: ["Idea", "Created", "Scheduled", "Posted"],
  CHANGELOG: [
    {
      version: "1.2.0",
      date: "2026-07-02",
      changes: [
        "Added manual Hide Week and Show Week controls for individual calendar rows.",
        "Hidden weeks are remembered separately for each month and managed page.",
        "Added an in-app changelog button and version history modal.",
        "Added stronger duplicate-save protection in both the frontend and Apps Script backend.",
        "Kept time-based sorting, quick status updates, floating refresh, and live Manila date/time.",
        "Refined Inter typography with lighter font weights."
      ]
    },
    {
      version: "1.1.0",
      date: "2026-06-21",
      changes: [
        "Added time-based sorting, quick status controls, floating refresh, and live Manila date/time.",
        "Added config.js, README, changelog, version footer, and performance improvements."
      ]
    },
    {
      version: "1.0.0",
      date: "2026-06-21",
      changes: [
        "Initial DesignLab social media content planner release."
      ]
    }
  ]
});
