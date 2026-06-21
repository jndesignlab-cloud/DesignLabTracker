(() => {
  "use strict";

  const config = window.APP_CONFIG || {};
  const API_URL = String(config.API_URL || "").trim();
  const STATUS_ORDER = Array.isArray(config.STATUS_ORDER)
    ? config.STATUS_ORDER
    : ["Idea", "Created", "Scheduled", "Posted"];

  let currentDate = new Date();
  let selectedPage = "";
  let pages = [];
  let posts = [];
  let clockTimer = null;
  let toastTimer = null;

  const $ = id => document.getElementById(id);
  const calendarGrid = $("calendarGrid");
  const monthTitle = $("monthTitle");
  const currentPageLabel = $("currentPageLabel");
  const pageTabs = $("pageTabs");
  const refreshButton = $("refreshButton");
  const toast = $("toast");

  const counters = {
    idea: $("ideaCount"),
    created: $("createdCount"),
    scheduled: $("scheduledCount"),
    posted: $("postedCount")
  };

  const modal = $("postModal");
  const postForm = $("postForm");
  const closeModalButton = $("closeModal");
  const deletePostButton = $("deletePost");

  const inputs = {
    id: $("postId"),
    date: $("postDate"),
    title: $("postTitle"),
    time: $("postTime"),
    caption: $("postCaption"),
    status: $("postStatus"),
    platform: $("postPlatform"),
    notes: $("postNotes")
  };

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    applyVersionInfo();
    setupControls();
    startClock();

    if (!API_URL || API_URL.includes("PASTE_YOUR")) {
      showToast("Add your Apps Script URL in config.js.", 5000);
      monthTitle.textContent = formatMonthYear(currentDate);
      renderCalendar();
      return;
    }

    await refreshAll();
  }

  function applyVersionInfo() {
    $("footerAppName").textContent = config.APP_NAME || "DesignLab Content Planner";
    $("footerVersion").textContent = config.APP_VERSION || "1.1.0";
  }

  function setupControls() {
    $("prevMonth").addEventListener("click", async () => {
      currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
      await loadPosts();
    });

    $("nextMonth").addEventListener("click", async () => {
      currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
      await loadPosts();
    });

    $("todayBtn").addEventListener("click", async () => {
      currentDate = new Date();
      await loadPosts();
    });

    refreshButton.addEventListener("click", refreshAll);
    closeModalButton.addEventListener("click", closePostModal);
    modal.addEventListener("click", event => {
      if (event.target === modal) closePostModal();
    });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape") closePostModal();
    });
    postForm.addEventListener("submit", savePost);
    deletePostButton.addEventListener("click", deletePost);
  }

  function startClock() {
    updateClock();
    clearInterval(clockTimer);
    clockTimer = setInterval(updateClock, 1000);
  }

  function updateClock() {
    const now = new Date();
    const locale = config.LOCALE || "en-PH";
    const timeZone = config.TIME_ZONE || "Asia/Manila";

    $("currentTime").textContent = new Intl.DateTimeFormat(locale, {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
      timeZone
    }).format(now);

    $("currentDate").textContent = new Intl.DateTimeFormat(locale, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone
    }).format(now);
  }

  async function refreshAll() {
    setRefreshing(true);
    try {
      await loadPages();
      await loadPosts();
      $("lastUpdated").textContent = `Last refreshed: ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
      showToast("Planner refreshed.");
    } catch (error) {
      console.error(error);
      showToast("Could not refresh the planner.", 4000);
    } finally {
      setRefreshing(false);
    }
  }

  function setRefreshing(isLoading) {
    refreshButton.classList.toggle("loading", isLoading);
    refreshButton.disabled = isLoading;
  }

  function jsonp(params = {}) {
    return new Promise((resolve, reject) => {
      const callbackName = `dlTrackerCallback_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
      const script = document.createElement("script");
      const timeout = window.setTimeout(() => cleanup(new Error("Request timed out.")), 15000);

      function cleanup(error, data) {
        clearTimeout(timeout);
        if (script.parentNode) script.parentNode.removeChild(script);
        delete window[callbackName];
        error ? reject(error) : resolve(data);
      }

      window[callbackName] = data => cleanup(null, data);
      script.onerror = () => cleanup(new Error("API request failed."));
      script.src = `${API_URL}?${new URLSearchParams({ ...params, callback: callbackName })}`;
      document.body.appendChild(script);
    });
  }

  async function loadPages() {
    const response = await jsonp({ action: "getPages" });
    if (!response.success) throw new Error(response.message || "Could not load pages.");

    pages = response.pages || [];
    if (!pages.length) {
      selectedPage = "";
      pageTabs.innerHTML = '<p class="empty-tabs">No active pages found.</p>';
      currentPageLabel.textContent = "No page selected";
      return;
    }

    const preferred = config.DEFAULT_PAGE;
    const existingSelection = pages.find(page => page.PageName === selectedPage);
    const defaultPage = pages.find(page => page.PageName === preferred) || pages[0];
    selectedPage = existingSelection ? existingSelection.PageName : defaultPage.PageName;
    currentPageLabel.textContent = selectedPage;
    renderPageTabs();
  }

  function renderPageTabs() {
    pageTabs.innerHTML = "";
    const fragment = document.createDocumentFragment();

    pages.forEach(page => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `tab${page.PageName === selectedPage ? " active" : ""}`;
      button.textContent = page.PageName;
      button.addEventListener("click", () => {
        selectedPage = page.PageName;
        currentPageLabel.textContent = selectedPage;
        renderPageTabs();
        renderCalendar();
      });
      fragment.appendChild(button);
    });

    pageTabs.appendChild(fragment);
  }

  async function loadPosts() {
    monthTitle.textContent = formatMonthYear(currentDate);

    if (!API_URL || API_URL.includes("PASTE_YOUR")) {
      posts = [];
      renderCalendar();
      return;
    }

    const response = await jsonp({
      action: "getPosts",
      year: currentDate.getFullYear(),
      month: currentDate.getMonth() + 1
    });

    if (!response.success) throw new Error(response.message || "Could not load posts.");
    posts = response.posts || [];
    renderCalendar();
  }

  function renderCalendar() {
    calendarGrid.innerHTML = "";

    if (!selectedPage && pages.length) selectedPage = pages[0].PageName;
    const pagePosts = posts.filter(post => post.Page === selectedPage);
    updateStats(pagePosts);

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const startDay = firstDay.getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();
    const prevLastDate = new Date(year, month, 0).getDate();
    const fragment = document.createDocumentFragment();

    for (let i = 0; i < 42; i++) {
      const cell = document.createElement("div");
      cell.className = "day-cell";
      let dayNumber;
      let cellDate;
      let isMuted = false;

      if (i < startDay) {
        dayNumber = prevLastDate - startDay + i + 1;
        cellDate = new Date(year, month - 1, dayNumber);
        isMuted = true;
      } else if (i >= startDay + lastDate) {
        dayNumber = i - (startDay + lastDate) + 1;
        cellDate = new Date(year, month + 1, dayNumber);
        isMuted = true;
      } else {
        dayNumber = i - startDay + 1;
        cellDate = new Date(year, month, dayNumber);
      }

      const dateString = formatDate(cellDate);
      if (isMuted) cell.classList.add("muted");
      if (dateString === formatDate(new Date())) cell.classList.add("today");

      cell.innerHTML = `
        <div class="day-number">${dayNumber}</div>
        <div class="post-list"></div>
        <div class="add-hint">+ Add</div>
      `;

      const dayPosts = pagePosts
        .filter(post => normalizeDate(post.Date) === dateString)
        .sort((a, b) => {
          const timeCompare = (normalizeTime(a.Time) || "23:59").localeCompare(normalizeTime(b.Time) || "23:59");
          return timeCompare !== 0 ? timeCompare : String(a.Title || "").localeCompare(String(b.Title || ""));
        });

      const postList = cell.querySelector(".post-list");
      dayPosts.forEach(post => postList.appendChild(createPostCard(post, dateString)));

      cell.addEventListener("click", () => openPostModal(dateString));
      fragment.appendChild(cell);
    }

    calendarGrid.appendChild(fragment);
  }

  function createPostCard(post, dateString) {
    const card = document.createElement("article");
    const statusClass = getStatusClass(post.Status);
    card.className = `post-pill ${statusClass}`;

    const statusIcon = getStatusIcon(post.Status);
    card.innerHTML = `
      <button class="status-quick-btn" type="button" title="Update status" aria-label="Update status for ${escapeHtml(post.Title || "post")}">${statusIcon}</button>
      <h4>${escapeHtml(post.Title || "Untitled Post")}</h4>
      <div class="post-meta">
        <span class="post-time-label">${formatDisplayTime(post.Time)}</span>
        <p>${escapeHtml(post.Status || "Idea")}</p>
      </div>
    `;

    card.addEventListener("click", event => {
      event.stopPropagation();
      openPostModal(dateString, post);
    });

    card.querySelector(".status-quick-btn").addEventListener("click", async event => {
      event.stopPropagation();
      await cyclePostStatus(post);
    });

    return card;
  }

  async function cyclePostStatus(post) {
    const currentIndex = STATUS_ORDER.indexOf(post.Status);
    const nextStatus = STATUS_ORDER[(currentIndex + 1 + STATUS_ORDER.length) % STATUS_ORDER.length];

    try {
      const response = await jsonp({
        action: "updatePost",
        id: post.ID,
        page: post.Page || selectedPage,
        date: normalizeDate(post.Date),
        time: normalizeTime(post.Time),
        title: post.Title || "",
        caption: post.Caption || "",
        status: nextStatus,
        platform: post.Platform || "Facebook",
        notes: post.Notes || ""
      });

      if (!response.success) throw new Error(response.message || "Could not update status.");
      post.Status = nextStatus;
      renderCalendar();
      showToast(`Status changed to ${nextStatus}.`);
    } catch (error) {
      console.error(error);
      showToast("Could not update status.", 3500);
    }
  }

  function updateStats(list) {
    Object.keys(counters).forEach(key => {
      counters[key].textContent = list.filter(post => getStatusClass(post.Status) === key).length;
    });
  }

  function openPostModal(dateString, post = null) {
    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
    $("modalDateLabel").textContent = new Date(`${dateString}T00:00:00`).toLocaleDateString("en-US", {
      month: "long", day: "numeric", year: "numeric"
    });

    inputs.date.value = dateString;

    if (post) {
      inputs.id.value = post.ID || "";
      inputs.title.value = post.Title || "";
      inputs.time.value = normalizeTime(post.Time);
      inputs.caption.value = post.Caption || "";
      inputs.status.value = post.Status || "Idea";
      inputs.platform.value = post.Platform || "Facebook";
      inputs.notes.value = post.Notes || "";
      deletePostButton.classList.remove("hidden");
    } else {
      inputs.id.value = "";
      inputs.title.value = "";
      inputs.time.value = "";
      inputs.caption.value = "";
      inputs.status.value = "Idea";
      inputs.platform.value = "Facebook";
      inputs.notes.value = "";
      deletePostButton.classList.add("hidden");
    }

    setTimeout(() => inputs.title.focus(), 50);
  }

  function closePostModal() {
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
  }

  async function savePost(event) {
    event.preventDefault();
    const title = inputs.title.value.trim();
    if (!title) return showToast("Please enter a post title.", 3000);

    const submitButton = postForm.querySelector('[type="submit"]');
    submitButton.disabled = true;

    try {
      const response = await jsonp({
        action: inputs.id.value ? "updatePost" : "addPost",
        id: inputs.id.value,
        page: selectedPage,
        date: inputs.date.value,
        time: inputs.time.value,
        title,
        caption: inputs.caption.value,
        status: inputs.status.value,
        platform: inputs.platform.value,
        notes: inputs.notes.value
      });

      if (!response.success) throw new Error(response.message || "Could not save post.");
      closePostModal();
      await loadPosts();
      showToast(inputs.id.value ? "Post updated." : "Post added.");
    } catch (error) {
      console.error(error);
      showToast("Could not save post.", 3500);
    } finally {
      submitButton.disabled = false;
    }
  }

  async function deletePost() {
    if (!inputs.id.value || !confirm("Delete this post?")) return;
    deletePostButton.disabled = true;

    try {
      const response = await jsonp({ action: "deletePost", id: inputs.id.value });
      if (!response.success) throw new Error(response.message || "Could not delete post.");
      closePostModal();
      await loadPosts();
      showToast("Post deleted.");
    } catch (error) {
      console.error(error);
      showToast("Could not delete post.", 3500);
    } finally {
      deletePostButton.disabled = false;
    }
  }

  function getStatusClass(status) {
    const value = String(status || "Idea").trim().toLowerCase();
    return ["created", "scheduled", "posted"].includes(value) ? value : "idea";
  }

  function getStatusIcon(status) {
    return ({ Idea: "💡", Created: "✎", Scheduled: "◷", Posted: "✓" })[status] || "💡";
  }

  function formatMonthYear(date) {
    return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(date);
  }

  function formatDate(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function normalizeDate(value) {
    if (!value) return "";
    const text = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
    const date = new Date(text);
    return Number.isNaN(date.getTime()) ? text : formatDate(date);
  }

  function normalizeTime(value) {
    if (!value) return "";
    const text = String(value).trim();
    if (/^\d{2}:\d{2}$/.test(text)) return text;
    if (/^\d{1}:\d{2}$/.test(text)) return `0${text}`;
    if (text.includes("T")) {
      const date = new Date(text);
      if (!Number.isNaN(date.getTime())) {
        return `${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}`;
      }
    }
    const date = new Date(`1970-01-01T${text}`);
    return Number.isNaN(date.getTime()) ? "" : `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  }

  function formatDisplayTime(value) {
    const time = normalizeTime(value);
    if (!time) return "No time";
    const [hourString, minute] = time.split(":");
    let hour = Number(hourString);
    const period = hour >= 12 ? "PM" : "AM";
    hour = hour % 12 || 12;
    return `${hour}:${minute} ${period}`;
  }

  function showToast(message, duration = 2200) {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add("show");
    toastTimer = setTimeout(() => toast.classList.remove("show"), duration);
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
})();
