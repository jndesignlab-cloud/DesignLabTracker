const API_URL = "PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE";

let currentDate = new Date();
let selectedPage = "";
let pages = [];
let posts = [];

const calendarGrid = document.getElementById("calendarGrid");
const monthTitle = document.getElementById("monthTitle");
const currentPageLabel = document.getElementById("currentPageLabel");
const pageTabs = document.getElementById("pageTabs");

const ideaCount = document.getElementById("ideaCount");
const createdCount = document.getElementById("createdCount");
const scheduledCount = document.getElementById("scheduledCount");
const postedCount = document.getElementById("postedCount");

const modal = document.getElementById("postModal");
const postForm = document.getElementById("postForm");
const closeModal = document.getElementById("closeModal");
const deletePostBtn = document.getElementById("deletePost");

const postIdInput = document.getElementById("postId");
const postDateInput = document.getElementById("postDate");
const postTitleInput = document.getElementById("postTitle");
const postCaptionInput = document.getElementById("postCaption");
const postStatusInput = document.getElementById("postStatus");
const postPlatformInput = document.getElementById("postPlatform");
const postNotesInput = document.getElementById("postNotes");
const modalDateLabel = document.getElementById("modalDateLabel");

document.addEventListener("DOMContentLoaded", async () => {
  setupControls();
  await loadPages();
  await loadPosts();
});

function setupControls() {
  document.getElementById("prevMonth").addEventListener("click", () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    loadPosts();
  });

  document.getElementById("nextMonth").addEventListener("click", () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    loadPosts();
  });

  document.getElementById("todayBtn").addEventListener("click", () => {
    currentDate = new Date();
    loadPosts();
  });

  closeModal.addEventListener("click", closePostModal);

  modal.addEventListener("click", event => {
    if (event.target === modal) {
      closePostModal();
    }
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      closePostModal();
    }
  });

  postForm.addEventListener("submit", savePost);
  deletePostBtn.addEventListener("click", deletePost);
}

function jsonp(params = {}) {
  return new Promise((resolve, reject) => {
    const callbackName =
      "jsonpCallback_" +
      Date.now() +
      "_" +
      Math.floor(Math.random() * 10000);

    params.callback = callbackName;

    const query = new URLSearchParams(params).toString();
    const script = document.createElement("script");

    window[callbackName] = data => {
      resolve(data);
      document.body.removeChild(script);
      delete window[callbackName];
    };

    script.onerror = () => {
      reject(new Error("API request failed."));
      document.body.removeChild(script);
      delete window[callbackName];
    };

    script.src = `${API_URL}?${query}`;
    document.body.appendChild(script);
  });
}

async function loadPages() {
  try {
    const response = await jsonp({
      action: "getPages"
    });

    pages = response.pages || [];

    if (pages.length === 0) {
      pageTabs.innerHTML = `<p class="empty-tabs">No active pages found.</p>`;
      selectedPage = "";
      currentPageLabel.textContent = "No page selected";
      return;
    }

    selectedPage = pages[0].PageName;
    currentPageLabel.textContent = selectedPage;

    renderPageTabs();

  } catch (error) {
    console.error(error);
    pageTabs.innerHTML = `<p class="empty-tabs">Could not load tabs.</p>`;
    alert("Could not load pages/tabs. Please check your Apps Script URL.");
  }
}

function renderPageTabs() {
  pageTabs.innerHTML = "";

  pages.forEach((page, index) => {
    const button = document.createElement("button");

    button.className = index === 0 ? "tab active" : "tab";
    button.dataset.page = page.PageName;
    button.textContent = page.PageName;

    button.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(tab => {
        tab.classList.remove("active");
      });

      button.classList.add("active");

      selectedPage = page.PageName;
      currentPageLabel.textContent = selectedPage;

      renderCalendar();
    });

    pageTabs.appendChild(button);
  });
}

async function loadPosts() {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

  monthTitle.textContent = currentDate.toLocaleString("en-US", {
    month: "long",
    year: "numeric"
  });

  try {
    const response = await jsonp({
      action: "getPosts",
      year,
      month
    });

    posts = response.posts || [];
    renderCalendar();

  } catch (error) {
    console.error(error);
    alert("Could not load posts. Please check your Apps Script URL.");
  }
}

function renderCalendar() {
  calendarGrid.innerHTML = "";

  if (!selectedPage) {
    calendarGrid.innerHTML = `<div class="empty-state">Please add an active page first.</div>`;
    updateStats([]);
    return;
  }

  const pageMonthPosts = getCurrentPageMonthPosts();
  updateStats(pageMonthPosts);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDay = new Date(year, month, 1);
  const startDay = firstDay.getDay();

  const lastDate = new Date(year, month + 1, 0).getDate();
  const prevLastDate = new Date(year, month, 0).getDate();

  const totalCells = 42;

  for (let i = 0; i < totalCells; i++) {
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

    if (isMuted) {
      cell.classList.add("muted");
    }

    if (dateString === formatDate(new Date())) {
      cell.classList.add("today");
    }

    cell.innerHTML = `
      <div class="day-number">${dayNumber}</div>
      <div class="post-list"></div>
      <div class="add-hint">+ Add</div>
    `;

    const postList = cell.querySelector(".post-list");

    const dayPosts = posts.filter(post =>
      normalizeDate(post.Date) === dateString &&
      post.Page === selectedPage
    );

    dayPosts.forEach(post => {
      const pill = document.createElement("div");
      const statusClass = getStatusClass(post.Status);

      pill.className = `post-pill ${statusClass}`;

      pill.innerHTML = `
        <h4>${escapeHtml(post.Title || "Untitled Post")}</h4>
        <p>${escapeHtml(post.Status || "Idea")}</p>
      `;

      pill.addEventListener("click", event => {
        event.stopPropagation();
        openPostModal(dateString, post);
      });

      postList.appendChild(pill);
    });

    cell.addEventListener("click", () => {
      openPostModal(dateString);
    });

    calendarGrid.appendChild(cell);
  }
}

function getCurrentPageMonthPosts() {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

  return posts.filter(post => {
    const dateValue = normalizeDate(post.Date);
    const postDate = new Date(dateValue);

    return post.Page === selectedPage &&
      postDate.getFullYear() === year &&
      postDate.getMonth() + 1 === month;
  });
}

function updateStats(list) {
  ideaCount.textContent = list.filter(post => getStatusClass(post.Status) === "idea").length;
  createdCount.textContent = list.filter(post => getStatusClass(post.Status) === "created").length;
  scheduledCount.textContent = list.filter(post => getStatusClass(post.Status) === "scheduled").length;
  postedCount.textContent = list.filter(post => getStatusClass(post.Status) === "posted").length;
}

function openPostModal(dateString, post = null) {
  modal.classList.remove("hidden");

  modalDateLabel.textContent = new Date(dateString).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric"
  });

  postDateInput.value = dateString;

  if (post) {
    postIdInput.value = post.ID;
    postTitleInput.value = post.Title || "";
    postCaptionInput.value = post.Caption || "";
    postStatusInput.value = post.Status || "Idea";
    postPlatformInput.value = post.Platform || "Facebook";
    postNotesInput.value = post.Notes || "";
    deletePostBtn.classList.remove("hidden");
  } else {
    postIdInput.value = "";
    postTitleInput.value = "";
    postCaptionInput.value = "";
    postStatusInput.value = "Idea";
    postPlatformInput.value = "Facebook";
    postNotesInput.value = "";
    deletePostBtn.classList.add("hidden");
  }
}

function closePostModal() {
  modal.classList.add("hidden");
}

async function savePost(event) {
  event.preventDefault();

  if (!selectedPage) {
    alert("Please select a page first.");
    return;
  }

  const payload = {
    action: postIdInput.value ? "updatePost" : "addPost",
    id: postIdInput.value,
    page: selectedPage,
    date: postDateInput.value,
    title: postTitleInput.value,
    caption: postCaptionInput.value,
    status: postStatusInput.value,
    platform: postPlatformInput.value,
    notes: postNotesInput.value
  };

  try {
    const response = await jsonp(payload);

    if (!response.success) {
      alert(response.message || "Something went wrong.");
      return;
    }

    closePostModal();
    await loadPosts();

  } catch (error) {
    console.error(error);
    alert("Could not save post.");
  }
}

async function deletePost() {
  const id = postIdInput.value;

  if (!id) return;

  const confirmed = confirm("Delete this post?");
  if (!confirmed) return;

  try {
    const response = await jsonp({
      action: "deletePost",
      id
    });

    if (!response.success) {
      alert(response.message || "Could not delete post.");
      return;
    }

    closePostModal();
    await loadPosts();

  } catch (error) {
    console.error(error);
    alert("Could not delete post.");
  }
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function normalizeDate(value) {
  if (!value) return "";

  if (value instanceof Date) {
    return formatDate(value);
  }

  const text = String(value);

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }

  const date = new Date(text);

  if (isNaN(date.getTime())) {
    return text;
  }

  return formatDate(date);
}

function getStatusClass(status) {
  const cleanStatus = String(status || "Idea").trim().toLowerCase();

  if (cleanStatus === "created") return "created";
  if (cleanStatus === "scheduled") return "scheduled";
  if (cleanStatus === "posted") return "posted";

  return "idea";
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
