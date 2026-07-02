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
  let isLoading = false;
  let isSaving = false;
  const HIDDEN_WEEKS_STORAGE_KEY = "designlab-tracker-hidden-weeks";

  const $ = id => document.getElementById(id);
  const calendarGrid = $("calendarGrid");
  const monthTitle = $("monthTitle");
  const currentPageLabel = $("currentPageLabel");
  const pageTabs = $("pageTabs");
  const refreshButton = $("refreshButton");
  const toast = $("toast");
  const savePostButton = $("savePostButton");
  const changelogButton = $("changelogButton");
  const changelogModal = $("changelogModal");
  const closeChangelogButton = $("closeChangelog");
  const changelogContent = $("changelogContent");

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
    renderChangelog();
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
    $("footerVersion").textContent = config.APP_VERSION || "1.2.0";
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
    changelogButton.addEventListener("click", openChangelog);
    closeChangelogButton.addEventListener("click", closeChangelog);
    changelogModal.addEventListener("click", event => {
      if (event.target === changelogModal) closeChangelog();
    });
    closeModalButton.addEventListener("click", closePostModal);
    modal.addEventListener("click", event => {
      if (event.target === modal) closePostModal();
    });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        closePostModal();
        closeChangelog();
      }
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
    if (isLoading) return;
    isLoading = true;
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
      isLoading = false;
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
      script.src = `${API_URL}?${new URLSearchParams({ ...params, callback: callbackName, _: Date.now() })}`;
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
    if (!selectedPage && pages.length) selectedPage = pages[0].PageName;
    const pagePosts = posts.filter(post => post.Page === selectedPage);
    updateStats(pagePosts);

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const startDay = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();
    const prevLastDate = new Date(year, month, 0).getDate();
    const postsByDate = groupPostsByDate(pagePosts);
    const hiddenWeeks = getHiddenWeeks(year, month, selectedPage);
    const fragment = document.createDocumentFragment();

    for (let weekIndex = 0; weekIndex < 6; weekIndex++) {
      const weekWrapper = document.createElement("section");
      weekWrapper.className = "calendar-week";
      weekWrapper.dataset.weekIndex = String(weekIndex);

      const weekGrid = document.createElement("div");
      weekGrid.className = "calendar-week-grid";
      const weekDates = [];

      for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
        const i = weekIndex * 7 + dayOffset;
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

        weekDates.push(cellDate);
        const dateString = formatDate(cellDate);
        if (isMuted) cell.classList.add("muted");
        if (dateString === formatDate(new Date())) cell.classList.add("today");

        const dayNumberEl = document.createElement("div");
        dayNumberEl.className = "day-number";
        dayNumberEl.textContent = dayNumber;

        const postList = document.createElement("div");
        postList.className = "post-list";
        const dayPosts = (postsByDate.get(dateString) || []).sort(comparePostsByTime);
        dayPosts.forEach(post => postList.appendChild(createPostCard(post, dateString)));

        const addHint = document.createElement("div");
        addHint.className = "add-hint";
        addHint.textContent = "+ Add";

        cell.append(dayNumberEl, postList, addHint);
        cell.addEventListener("click", () => openPostModal(dateString));
        weekGrid.appendChild(cell);
      }

      const rangeLabel = formatWeekRange(weekDates[0], weekDates[6]);

      const hideButton = document.createElement("button");
      hideButton.type = "button";
      hideButton.className = "week-toggle week-hide-button";
      hideButton.textContent = "Hide Week";
      hideButton.title = `Hide ${rangeLabel}`;
      hideButton.addEventListener("click", event => {
        event.stopPropagation();
        setWeekHidden(year, month, selectedPage, weekIndex, true);
        renderCalendar();
      });

      const collapsedBar = document.createElement("div");
      collapsedBar.className = "collapsed-week-bar";
      const collapsedLabel = document.createElement("span");
      collapsedLabel.textContent = rangeLabel;
      const showButton = document.createElement("button");
      showButton.type = "button";
      showButton.className = "week-toggle week-show-button";
      showButton.textContent = "Show Week";
      showButton.addEventListener("click", event => {
        event.stopPropagation();
        setWeekHidden(year, month, selectedPage, weekIndex, false);
        renderCalendar();
      });

      collapsedBar.append(collapsedLabel, showButton);
      weekWrapper.append(weekGrid, hideButton, collapsedBar);
      if (hiddenWeeks.has(weekIndex)) weekWrapper.classList.add("is-collapsed");
      fragment.appendChild(weekWrapper);
    }

    calendarGrid.replaceChildren(fragment);
  }

  function groupPostsByDate(list) {
    const map = new Map();
    list.forEach(post => {
      const date = normalizeDate(post.Date);
      if (!map.has(date)) map.set(date, []);
      map.get(date).push(post);
    });
    return map;
  }

  function comparePostsByTime(a, b) {
    const timeCompare = (normalizeTime(a.Time) || "23:59").localeCompare(normalizeTime(b.Time) || "23:59");
    return timeCompare !== 0 ? timeCompare : String(a.Title || "").localeCompare(String(b.Title || ""));
  }

  function getHiddenWeeks(year, month, pageName) {
    try {
      const stored = JSON.parse(localStorage.getItem(HIDDEN_WEEKS_STORAGE_KEY) || "{}");
      const key = `${pageName || "all"}::${year}-${String(month + 1).padStart(2, "0")}`;
      return new Set((Array.isArray(stored[key]) ? stored[key] : []).map(Number));
    } catch (error) {
      console.warn("Could not read hidden-week preferences.", error);
      return new Set();
    }
  }

  function setWeekHidden(year, month, pageName, weekIndex, hidden) {
    try {
      const stored = JSON.parse(localStorage.getItem(HIDDEN_WEEKS_STORAGE_KEY) || "{}");
      const key = `${pageName || "all"}::${year}-${String(month + 1).padStart(2, "0")}`;
      const values = new Set((Array.isArray(stored[key]) ? stored[key] : []).map(Number));
      hidden ? values.add(weekIndex) : values.delete(weekIndex);
      stored[key] = [...values].sort((a, b) => a - b);
      localStorage.setItem(HIDDEN_WEEKS_STORAGE_KEY, JSON.stringify(stored));
    } catch (error) {
      console.warn("Could not save hidden-week preferences.", error);
    }
  }

  function formatWeekRange(startDate, endDate) {
    const sameMonth = startDate.getMonth() === endDate.getMonth();
    const sameYear = startDate.getFullYear() === endDate.getFullYear();
    if (sameMonth && sameYear) {
      return `${startDate.toLocaleString("en-US", { month: "short" })} ${startDate.getDate()}–${endDate.getDate()}, ${endDate.getFullYear()}`;
    }
    if (sameYear) {
      return `${startDate.toLocaleString("en-US", { month: "short" })} ${startDate.getDate()} – ${endDate.toLocaleString("en-US", { month: "short" })} ${endDate.getDate()}, ${endDate.getFullYear()}`;
    }
    return `${startDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} – ${endDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
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
    if (isSaving) return;
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
  }

  async function savePost(event) {
    event.preventDefault();
    if (isSaving) return;

    const title = inputs.title.value.trim();
    if (!title) return showToast("Please enter a post title.", 3000);

    isSaving = true;
    savePostButton.disabled = true;
    savePostButton.textContent = "Saving...";
    const requestToken = window.crypto?.randomUUID
      ? window.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

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
        notes: inputs.notes.value,
        requestToken
      });

      if (!response.success) throw new Error(response.message || "Could not save post.");
      const wasEditing = Boolean(inputs.id.value);
      modal.classList.add("hidden");
      modal.setAttribute("aria-hidden", "true");
      await loadPosts();
      showToast(wasEditing ? "Post updated." : "Post added.");
    } catch (error) {
      console.error(error);
      showToast(error.message || "Could not save post.", 3500);
    } finally {
      isSaving = false;
      savePostButton.disabled = false;
      savePostButton.textContent = "Save Post";
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

  function renderChangelog() {
    const fragment = document.createDocumentFragment();
    (config.CHANGELOG || []).forEach(item => {
      const section = document.createElement("section");
      section.className = "changelog-version";
      const title = document.createElement("h4");
      title.textContent = `Version ${item.version}`;
      const date = document.createElement("time");
      date.textContent = item.date;
      const list = document.createElement("ul");
      (item.changes || []).forEach(change => {
        const li = document.createElement("li");
        li.textContent = change;
        list.appendChild(li);
      });
      section.append(title, date, list);
      fragment.appendChild(section);
    });
    changelogContent.replaceChildren(fragment);
  }

  function openChangelog() {
    changelogModal.classList.remove("hidden");
    changelogModal.setAttribute("aria-hidden", "false");
  }

  function closeChangelog() {
    changelogModal.classList.add("hidden");
    changelogModal.setAttribute("aria-hidden", "true");
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
