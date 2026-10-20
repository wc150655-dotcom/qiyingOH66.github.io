/* =========================================================
   齐瑛 · 私人岛屿
   Interaction layer
   ========================================================= */
(function () {
  "use strict";

  var DATA = window.QY_DATA || {};
  var TAROT_DECK = DATA.TAROT_DECK || [];
  var PLANTS = DATA.PLANTS || [];
  var TRACKS = DATA.TRACKS || [];
  var SOKOBAN_LEVELS = DATA.SOKOBAN_LEVELS || [];

  var ADMIN_KEY = ["2102", "0087", "57cw"].join("");

  var STORE_KEYS = {
    copy: "qy.island.copy.v1",
    mail: "qy.island.mail.v1",
    cat: "qy.island.cat.v1",
    admin: "qy.island.admin.session"
  };

  var $ = function (selector, root) {
    return (root || document).querySelector(selector);
  };
  var $$ = function (selector, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(selector));
  };

  var state = {
    app: null,
    editing: false,
    introPage: 0,
    searchType: null,
    game: null,
    keyHandler: null,
    cleanup: [],
    musicIndex: 0,
    seeking: false,
    cat: null,
    lastWechatTap: 0,
    loginOpen: false,
    confirmOpen: false,
    confirmResolve: null
  };

  var isAdmin = false;
  var copyDefaults = new Map();
  var savedCopy = {};
  var copySaveTimer = null;
  var toastTimer = null;
  var clockTimer = null;
  var mail = [];
  var catTimers = [];

  var dom = {};

  var TRACK_IDS = TRACKS.map(function (track, index) {
    return { index: index, title: track.title };
  });

  /* ---------- storage ---------- */

  function readJSON(key, fallback) {
    try {
      var raw = window.localStorage.getItem(key);
      if (!raw) return fallback;
      var parsed = JSON.parse(raw);
      return parsed === null || parsed === undefined ? fallback : parsed;
    } catch (error) {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      return false;
    }
  }

  function removeStored(key) {
    try {
      window.localStorage.removeItem(key);
    } catch (error) {}
  }

  function readSession(key) {
    try {
      return window.sessionStorage.getItem(key);
    } catch (error) {
      return null;
    }
  }

  function writeSession(key, value) {
    try {
      window.sessionStorage.setItem(key, value);
    } catch (error) {}
  }

  function removeSession(key) {
    try {
      window.sessionStorage.removeItem(key);
    } catch (error) {}
  }

  /* ---------- small helpers ---------- */

  function escapeHTML(value) {
    return String(value === null || value === undefined ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function pad2(value) {
    return String(value).padStart(2, "0");
  }

  function formatClock(date) {
    return pad2(date.getHours()) + ":" + pad2(date.getMinutes());
  }

  function formatDuration(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
    var mins = Math.floor(seconds / 60);
    var secs = Math.floor(seconds % 60);
    return mins + ":" + pad2(secs);
  }

  function formatDate(timestamp) {
    var date = new Date(Number(timestamp) || Date.now());
    return [
      date.getFullYear(),
      pad2(date.getMonth() + 1),
      pad2(date.getDate())
    ].join(".") + " " + pad2(date.getHours()) + ":" + pad2(date.getMinutes());
  }

  function relativeTime(timestamp) {
    var diff = Date.now() - Number(timestamp || 0);
    if (diff < 60000) return "刚刚";
    if (diff < 3600000) return Math.floor(diff / 60000) + " 分钟前";
    if (diff < 86400000) return Math.floor(diff / 3600000) + " 小时前";
    if (diff < 604800000) return Math.floor(diff / 86400000) + " 天前";
    return formatDate(timestamp).slice(5, 10);
  }

  function randomIndex(length) {
    if (!length) return 0;
    if (window.crypto && window.crypto.getRandomValues) {
      var buffer = new Uint32Array(1);
      window.crypto.getRandomValues(buffer);
      return buffer[0] % length;
    }
    return Math.floor(Math.random() * length);
  }

  function randomBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  function pick(array) {
    return array[randomIndex(array.length)];
  }

  function shuffle(array) {
    var list = array.slice();
    for (var i = list.length - 1; i > 0; i -= 1) {
      var j = randomIndex(i + 1);
      var temp = list[i];
      list[i] = list[j];
      list[j] = temp;
    }
    return list;
  }

  function toast(message) {
    if (!dom.toast) return;
    dom.toast.textContent = message;
    dom.toast.classList.add("show");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      dom.toast.classList.remove("show");
    }, 2300);
  }

  function setPressed(button, playing) {
    if (!button) return;
    button.dataset.playing = playing ? "true" : "false";
    button.setAttribute("aria-label", playing ? "暂停" : "播放");
  }

  function addCleanup(fn) {
    if (typeof fn === "function") state.cleanup.push(fn);
  }

  function cleanupSearch() {
    state.cleanup.forEach(function (fn) {
      try {
        fn();
      } catch (error) {}
    });
    state.cleanup = [];
    state.game = null;
    state.keyHandler = null;
    state.tetAction = null;
    state.sokAction = null;
    state.catAction = null;
    state.fishAction = null;
  }

  function registerGame(type, keyHandler) {
    state.game = type;
    state.keyHandler = keyHandler || null;
  }

  function copyText(text) {
    var value = String(text);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(value).then(function () {
        return true;
      }).catch(function () {
        return fallbackCopy(value);
      });
    }
    return Promise.resolve(fallbackCopy(value));
  }

  function fallbackCopy(value) {
    try {
      var input = document.createElement("textarea");
      input.value = value;
      input.setAttribute("readonly", "");
      input.style.position = "fixed";
      input.style.opacity = "0";
      input.style.top = "-1000px";
      document.body.appendChild(input);
      input.select();
      var successful = document.execCommand("copy");
      document.body.removeChild(input);
      return successful;
    } catch (error) {
      return false;
    }
  }

  function updateMailBadge() {
    if (!dom.mailBadge) return;
    var count = mail.filter(function (item) {
      return item.visible && item.reply;
    }).length;
    if (count > 0) {
      dom.mailBadge.hidden = false;
      dom.mailBadge.textContent = count > 9 ? "9+" : String(count);
    } else {
      dom.mailBadge.hidden = true;
    }
  }

  /* ---------- clock ---------- */

  function tickClock() {
    var now = new Date();
    if (dom.statusClock) dom.statusClock.textContent = formatClock(now);
    if (dom.todayLabel) {
      var weekdays = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
      var months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
      var dateLabel = pad2(now.getDate()) + " " + months[now.getMonth()];
      dom.todayLabel.textContent = weekdays[now.getDay()] + " · " + dateLabel;
      var dailyDate = $("#dailyDate");
      if (dailyDate) dailyDate.textContent = dateLabel;
    }
  }

  /* ---------- content editing ---------- */

  function initCopySystem() {
    $$("[data-edit]").forEach(function (element) {
      var id = element.dataset.edit;
      if (!id) return;
      copyDefaults.set(id, element.innerHTML.trim());
      element.addEventListener("input", function () {
        if (!state.editing) return;
        savedCopy[id] = element.innerHTML.trim();
        scheduleCopySave();
      });
      element.addEventListener("blur", function () {
        if (!state.editing) return;
        savedCopy[id] = element.innerHTML.trim();
        writeCopyNow();
      });
    });

    var stored = readJSON(STORE_KEYS.copy, {});
    savedCopy = stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {};
    applyCopy();
    buildQuickCopyFields();
  }

  function applyCopy() {
    $$("[data-edit]").forEach(function (element) {
      var id = element.dataset.edit;
      if (!id) return;
      if (Object.prototype.hasOwnProperty.call(savedCopy, id)) {
        element.innerHTML = savedCopy[id];
      } else if (copyDefaults.has(id)) {
        element.innerHTML = copyDefaults.get(id);
      }
    });
  }

  function scheduleCopySave() {
    window.clearTimeout(copySaveTimer);
    copySaveTimer = window.setTimeout(writeCopyNow, 350);
  }

  function writeCopyNow() {
    writeJSON(STORE_KEYS.copy, savedCopy);
  }

  function commitAllEditable() {
    if (!state.editing) return;
    $$("[data-edit]").forEach(function (element) {
      var id = element.dataset.edit;
      if (id) savedCopy[id] = element.innerHTML.trim();
    });
    writeCopyNow();
  }

  function setEditing(on) {
    if (on && !isAdmin) {
      openLogin();
      return;
    }
    state.editing = Boolean(on);
    document.body.classList.toggle("editing-on", state.editing);

    $$("[data-edit]").forEach(function (element) {
      if (state.editing) {
        element.setAttribute("contenteditable", "true");
        element.setAttribute("spellcheck", "false");
      } else {
        element.removeAttribute("contenteditable");
        element.removeAttribute("spellcheck");
      }
    });

    if (dom.editDock) {
      dom.editDock.classList.toggle("show", state.editing);
      dom.editDock.setAttribute("aria-hidden", state.editing ? "false" : "true");
    }

    var button = $("#inlineEditBtn");
    var status = $("#inlineEditStatus");
    if (button) button.textContent = state.editing ? "结束页面编辑" : "开启页面编辑";
    if (status) status.textContent = state.editing ? "当前：正在编辑，修改会自动保存" : "当前：只读";

    if (state.editing) {
      if (state.app) closeApp();
      window.setTimeout(function () {
        toast("点击任意虚线文字开始编辑");
      }, 260);
    } else {
      commitAllEditable();
      buildQuickCopyFields();
      toast("文字修改已保存");
    }
  }

  function buildQuickCopyFields() {
    var host = $("#quickCopyFields");
    if (!host) return;
    var fields = [
      ["home.greeting", "首页问候语"],
      ["home.sub", "首页副标题"],
      ["search.lead", "搜索页引导语"],
      ["intro.about.name", "关于我 · 名字"],
      ["intro.tree.title", "树洞 · 标题"],
      ["mail.prompt", "信箱留言提示"],
      ["mail.lead", "信箱引导语"]
    ];
    host.innerHTML = fields.map(function (field) {
      var node = $('[data-edit="' + field[0] + '"]');
      var value = node ? node.textContent.trim() : "";
      return (
        '<div class="quick-field">' +
          '<label for="quick-' + field[0].replace(/\./g, "-") + '">' + escapeHTML(field[1]) + "</label>" +
          '<textarea id="quick-' + field[0].replace(/\./g, "-") + '" data-quick-id="' + field[0] + '" rows="2">' + escapeHTML(value) + "</textarea>" +
        "</div>"
      );
    }).join("");
  }

  function saveQuickCopy() {
    var fields = $$("[data-quick-id]");
    fields.forEach(function (field) {
      var id = field.dataset.quickId;
      var node = $('[data-edit="' + id + '"]');
      if (!node) return;
      node.textContent = field.value;
      savedCopy[id] = node.innerHTML.trim();
    });
    writeCopyNow();
    toast("文字已更新");
  }

  /* ---------- app navigation ---------- */

  function setAppVisibility(name) {
    $$(".app-view").forEach(function (view) {
      var active = view.id === "app-" + name;
      view.classList.toggle("active", active);
      view.setAttribute("aria-hidden", active ? "false" : "true");
    });
    document.body.classList.toggle("app-is-open", Boolean(name));
  }

  function openApp(name) {
    if (!name) return;
    if (name === "admin" && !isAdmin) {
      openLogin();
      return;
    }
    if (state.app === name) return;

    if (state.app === "search") {
      cleanupSearch();
      resetSearchView();
    }
    if (name === "admin" && state.editing) {
      setEditing(false);
    }

    closePlayerSheet(true);
    state.app = name;
    setAppVisibility(name);

    if (name === "mail") renderMailFront();
    if (name === "intro") syncIntro();
    if (name === "admin") {
      renderAdminMail();
      buildQuickCopyFields();
      switchAdminTab("content");
    }
    if (name === "search" && !$("#searchResult .result-shell") && !$("#searchResult .search-empty")) {
      resetSearchView();
    }
  }

  function closeApp() {
    if (!state.app) return;
    if (state.app === "search") {
      cleanupSearch();
      resetSearchView();
    }
    state.app = null;
    setAppVisibility(null);
    closePlayerSheet(true);
  }

  function bindNavigation() {
    document.addEventListener("click", function (event) {
      var opener = event.target.closest("[data-open-app]");
      if (opener) {
        event.preventDefault();
        openApp(opener.dataset.openApp);
        return;
      }

      var closer = event.target.closest("[data-close-app]");
      if (closer) {
        event.preventDefault();
        closeApp();
        return;
      }

      var adminEntry = event.target.closest("[data-admin-entry]");
      if (adminEntry) {
        event.preventDefault();
        if (isAdmin) openApp("admin");
        else openLogin();
        return;
      }

      var soon = event.target.closest("[data-soon]");
      if (soon) {
        event.preventDefault();
        toast("「" + soon.dataset.soon + "」还没有被安装。");
      }
    });

    $$("[data-close-login]").forEach(function (button) {
      button.addEventListener("click", closeLogin);
    });

    var adminKeyBtn = $("#adminKeyBtn");
    if (adminKeyBtn) {
      adminKeyBtn.addEventListener("click", function () {
        if (isAdmin) openApp("admin");
        else openLogin();
      });
    }

    var editDone = $("#editDone");
    if (editDone) editDone.addEventListener("click", function () { setEditing(false); });

    var saveQuick = $("#saveQuickCopy");
    if (saveQuick) saveQuick.addEventListener("click", saveQuickCopy);

    var inlineEditBtn = $("#inlineEditBtn");
    if (inlineEditBtn) {
      inlineEditBtn.addEventListener("click", function () {
        if (state.editing) setEditing(false);
        else setEditing(true);
      });
    }
  }

  /* ---------- music ---------- */

  var musicAudio = null;

  function initMusic() {
    musicAudio = $("#audio");
    if (!musicAudio) return;

    updateMusicTrack(false);

    if (dom.musicPlay) {
      dom.musicPlay.addEventListener("click", togglePlay);
    }
    if (dom.playerPlay) {
      dom.playerPlay.addEventListener("click", togglePlay);
    }
    if (dom.musicPrev) {
      dom.musicPrev.addEventListener("click", function () { changeTrack(-1, true); });
    }
    if (dom.playerPrev) {
      dom.playerPrev.addEventListener("click", function () { changeTrack(-1, true); });
    }
    if (dom.musicNext) {
      dom.musicNext.addEventListener("click", function () { changeTrack(1, true); });
    }
    if (dom.playerNext) {
      dom.playerNext.addEventListener("click", function () { changeTrack(1, true); });
    }
    if (dom.musicQueue) {
      dom.musicQueue.addEventListener("click", openPlayerSheet);
    }
    if (dom.musicCover) {
      dom.musicCover.addEventListener("click", openPlayerSheet);
      dom.musicCover.addEventListener("keydown", function (event) {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openPlayerSheet();
        }
      });
    }

    if (dom.musicSeek) {
      dom.musicSeek.addEventListener("input", seekFromInput);
    }
    if (dom.playerSeek) {
      dom.playerSeek.addEventListener("input", seekFromInput);
    }

    musicAudio.addEventListener("play", function () {
      document.body.classList.add("music-playing");
      setPressed(dom.musicPlay, true);
      setPressed(dom.playerPlay, true);
    });
    musicAudio.addEventListener("pause", function () {
      document.body.classList.remove("music-playing");
      setPressed(dom.musicPlay, false);
      setPressed(dom.playerPlay, false);
    });
    musicAudio.addEventListener("ended", function () {
      changeTrack(1, true);
    });
    musicAudio.addEventListener("loadedmetadata", updateProgress);
    musicAudio.addEventListener("timeupdate", updateProgress);
    musicAudio.addEventListener("error", function () {
      toast("这首歌暂时无法播放，请检查网络。");
      document.body.classList.remove("music-playing");
      setPressed(dom.musicPlay, false);
      setPressed(dom.playerPlay, false);
    });

    $$("[data-close-player]").forEach(function (button) {
      button.addEventListener("click", function () { closePlayerSheet(); });
    });
    if (dom.playerSheet) {
      dom.playerSheet.addEventListener("click", function (event) {
        if (event.target === dom.playerSheet) closePlayerSheet();
      });
    }

    if (dom.playlist) {
      dom.playlist.addEventListener("click", function (event) {
        var button = event.target.closest("[data-track-index]");
        if (!button) return;
        var index = Number(button.dataset.trackIndex);
        if (index === state.musicIndex) {
          togglePlay();
        } else {
          selectTrack(index, true);
        }
      });
    }

    buildPlaylist();
    updateMusicTrack(false);
    updateProgress();
  }

  function track() {
    if (!TRACKS.length) {
      return { title: "暂无歌曲", artist: "私人歌单", glyph: "♪", a: "#b8755d", b: "#4d3030", light: "#e4b79b", src: "" };
    }
    return TRACKS[state.musicIndex] || TRACKS[0];
  }

  function updateMusicTrack(autoplay) {
    if (!musicAudio) return;
    var current = track();
    var sourceChanged = musicAudio.getAttribute("src") !== current.src;
    if (sourceChanged) {
      musicAudio.src = current.src;
      musicAudio.load();
    }
    if (autoplay) {
      var promise = musicAudio.play();
      if (promise && promise.catch) {
        promise.catch(function () {
          toast("浏览器拦截了播放，请再点一次播放键。");
        });
      }
    }

    if (dom.musicTitle) dom.musicTitle.textContent = current.title;
    if (dom.musicArtist) dom.musicArtist.textContent = current.artist;
    if (dom.musicCoverGlyph) dom.musicCoverGlyph.textContent = current.glyph;
    if (dom.playerTitle) dom.playerTitle.textContent = current.title;
    if (dom.playerArtist) dom.playerArtist.textContent = current.artist;
    if (dom.playerCoverGlyph) dom.playerCoverGlyph.textContent = current.glyph;
    if (dom.musicWidget) {
      dom.musicWidget.style.setProperty("--music-a", current.a);
      dom.musicWidget.style.setProperty("--music-b", current.b);
      dom.musicWidget.style.setProperty("--music-light", current.light);
      dom.musicWidget.style.setProperty("--music-glow", current.light + "55");
    }
    if (dom.playerCover) {
      dom.playerCover.style.setProperty("--music-a", current.a);
      dom.playerCover.style.setProperty("--music-b", current.b);
      dom.playerCover.style.setProperty("--music-light", current.light);
    }
    updatePlaylistActive();
    updateProgress();
  }

  function updatePlaylistActive() {
    if (!dom.playlist) return;
    $$("[data-track-index]", dom.playlist).forEach(function (item) {
      item.classList.toggle("active", Number(item.dataset.trackIndex) === state.musicIndex);
    });
  }

  function buildPlaylist() {
    if (!dom.playlist) return;
    dom.playlist.innerHTML = TRACKS.map(function (item, index) {
      return (
        '<li class="' + (index === state.musicIndex ? "active" : "") + '">' +
          '<button type="button" data-track-index="' + index + '">' +
            '<span class="track-no">' + pad2(index + 1) + "</span>" +
            '<span class="track-copy"><b>' + escapeHTML(item.title) + "</b><small>" + escapeHTML(item.artist) + "</small></span>" +
            '<span class="track-dur">—</span>' +
          "</button>" +
        "</li>"
      );
    }).join("");
    if (dom.musicQueueCount) dom.musicQueueCount.textContent = String(TRACKS.length);
    if (dom.playlistMeta) dom.playlistMeta.textContent = TRACKS.length + " 首";
  }

  function togglePlay() {
    if (!musicAudio) return;
    if (musicAudio.paused) {
      var promise = musicAudio.play();
      if (promise && promise.catch) {
        promise.catch(function () {
          toast("这首歌暂时无法播放。");
        });
      }
    } else {
      musicAudio.pause();
    }
  }

  function changeTrack(direction, autoplay) {
    if (!TRACKS.length) return;
    state.musicIndex = (state.musicIndex + direction + TRACKS.length) % TRACKS.length;
    commitTrackChange(autoplay);
  }

  function selectTrack(index, autoplay) {
    if (!TRACKS.length) return;
    var next = Number(index);
    if (!Number.isInteger(next) || next < 0 || next >= TRACKS.length) return;
    if (next === state.musicIndex && !musicAudio.paused) {
      togglePlay();
      return;
    }
    state.musicIndex = next;
    commitTrackChange(autoplay);
  }

  function commitTrackChange(autoplay) {
    musicAudio.pause();
    try {
      musicAudio.currentTime = 0;
    } catch (error) {}
    updateMusicTrack(autoplay);
    if (dom.playlist) updatePlaylistActive();
  }

  function updateProgress() {
    if (!musicAudio) return;
    var duration = Number.isFinite(musicAudio.duration) ? musicAudio.duration : 0;
    var current = Number.isFinite(musicAudio.currentTime) ? musicAudio.currentTime : 0;
    var ratio = duration > 0 ? Math.min(1, current / duration) : 0;
    var percent = ratio * 100;
    if (dom.musicCurrent) dom.musicCurrent.textContent = formatDuration(current);
    if (dom.musicDuration) dom.musicDuration.textContent = formatDuration(duration);
    if (dom.playerCurrent) dom.playerCurrent.textContent = formatDuration(current);
    if (dom.playerDuration) dom.playerDuration.textContent = formatDuration(duration);
    if (dom.musicSeek) {
      if (document.activeElement !== dom.musicSeek) dom.musicSeek.value = String(Math.round(ratio * 1000));
      dom.musicSeek.style.setProperty("--progress", percent + "%");
    }
    if (dom.playerSeek) {
      if (document.activeElement !== dom.playerSeek) dom.playerSeek.value = String(Math.round(ratio * 1000));
      dom.playerSeek.style.setProperty("--progress", percent + "%");
    }
  }

  function seekFromInput(event) {
    if (!musicAudio || !Number.isFinite(musicAudio.duration)) return;
    var value = Number(event.target.value) / 1000;
    musicAudio.currentTime = value * musicAudio.duration;
    updateProgress();
  }

  function openPlayerSheet() {
    if (!dom.playerSheet) return;
    dom.playerSheet.classList.add("open");
    dom.playerSheet.setAttribute("aria-hidden", "false");
    buildPlaylist();
    updateMusicTrack(false);
    updateProgress();
  }

  function closePlayerSheet(immediate) {
    if (!dom.playerSheet) return;
    dom.playerSheet.classList.remove("open");
    dom.playerSheet.setAttribute("aria-hidden", "true");
  }

  /* ---------- search ---------- */

  var SEARCH_RULES = [
    { type: "tarot", terms: ["今日塔罗牌运势", "塔罗牌运势", "塔罗牌", "塔罗"] },
    { type: "tetris", terms: ["我想玩俄罗斯方块", "俄罗斯方块", "方块"] },
    { type: "sokoban", terms: ["我想玩推箱子", "推箱子"] },
    { type: "plant", terms: ["我想抽抽今日植物", "今日植物", "植物"] },
    { type: "cat", terms: ["我要喂小猫", "喂小猫", "小猫"] },
    { type: "fishing", terms: ["钓鱼", "去钓鱼"] },
    { type: "miss", terms: ["我想你", "想你"] }
  ];

  function normalizeQuery(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[\s，。,.!?！？、：:；;“”"'（）()【】[\]]/g, "");
  }

  function emptySearchHTML() {
    return (
      '<div class="search-empty">' +
        '<span class="empty-orbit" aria-hidden="true"><i></i><i></i><i></i></span>' +
        "<p>输入一个词条，或者从上面挑选。</p>" +
        "<small>搜索只认识这七句话。</small>" +
      "</div>"
    );
  }

  function resetSearchView() {
    if (!dom.searchResult) return;
    state.searchType = null;
    dom.searchResult.innerHTML = emptySearchHTML();
    if (dom.searchInput) dom.searchInput.value = "";
    var scroll = $(".search-scroll");
    if (scroll) scroll.classList.remove("has-result");
  }

  function initSearch() {
    if (!dom.searchForm) return;

    dom.searchForm.addEventListener("submit", function (event) {
      event.preventDefault();
      runSearch(dom.searchInput ? dom.searchInput.value : "");
    });

    if (dom.searchChips) {
      dom.searchChips.addEventListener("click", function (event) {
        var button = event.target.closest("[data-query]");
        if (!button) return;
        if (dom.searchInput) dom.searchInput.value = button.dataset.query;
        runSearch(button.dataset.query);
      });
    }

    if (dom.searchClear) {
      dom.searchClear.addEventListener("click", function () {
        cleanupSearch();
        resetSearchView();
        if (dom.searchInput) dom.searchInput.focus();
      });
    }

    if (dom.searchResult) {
      dom.searchResult.addEventListener("click", handleSearchResultClick);
      dom.searchResult.addEventListener("keydown", handleSearchResultKey);
    }
  }

  function runSearch(rawQuery) {
    var query = String(rawQuery || "").trim();
    var normalized = normalizeQuery(query);
    if (!normalized) {
      cleanupSearch();
      resetSearchView();
      return;
    }

    var rule = null;
    for (var i = 0; i < SEARCH_RULES.length; i += 1) {
      if (SEARCH_RULES[i].terms.some(function (term) { return normalized.indexOf(normalizeQuery(term)) !== -1; })) {
        rule = SEARCH_RULES[i];
        break;
      }
    }

    cleanupSearch();
    var searchScroll = $(".search-scroll");
    if (searchScroll) searchScroll.classList.add("has-result");
    if (!rule) {
      state.searchType = null;
      if (dom.searchResult) {
        dom.searchResult.innerHTML =
          '<div class="result-shell">' +
            '<div class="result-head">' +
              '<div><p class="result-kicker">NO MATCH</p><h3>没有找到这个词条</h3><p>这里只收藏了七个固定入口，不连接外面的搜索引擎。</p></div>' +
              '<span class="result-icon">?</span>' +
            "</div>" +
            '<div class="public-empty">试试：今日塔罗牌运势 / 我想玩俄罗斯方块 / 我想玩推箱子 / 我想抽抽今日植物 / 我要喂小猫 / 钓鱼 / 我想你。</div>' +
          "</div>";
      }
      return;
    }

    state.searchType = rule.type;
    if (rule.type === "tarot") renderTarot();
    if (rule.type === "tetris") renderTetris();
    if (rule.type === "sokoban") renderSokoban();
    if (rule.type === "plant") renderPlant();
    if (rule.type === "cat") renderCat();
    if (rule.type === "fishing") renderFishing();
    if (rule.type === "miss") renderMiss();

    var scroll = $(".search-scroll");
    if (scroll) scroll.scrollTop = 0;
  }

  function resultHeader(kicker, title, description, icon) {
    return (
      '<div class="result-head">' +
        "<div>" +
          '<p class="result-kicker">' + escapeHTML(kicker) + "</p>" +
          "<h3>" + escapeHTML(title) + "</h3>" +
          "<p>" + escapeHTML(description) + "</p>" +
        "</div>" +
        '<span class="result-icon" aria-hidden="true">' + escapeHTML(icon) + "</span>" +
      "</div>"
    );
  }

  function handleSearchResultKey(event) {
    var card = event.target.closest(".tarot-card");
    if (card && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      toggleTarotCard(card);
    }
    if (event.target.classList && event.target.classList.contains("wechat-line") && event.key === "Enter") {
      event.preventDefault();
      copyWechat();
    }
  }

  function handleSearchResultClick(event) {
    var wechat = event.target.closest("[data-copy-wechat]");
    if (wechat) {
      handleWechatTap();
      return;
    }

    var action = event.target.closest("[data-action]");
    if (action) {
      var name = action.dataset.action;
      if (name === "tarot-redraw") {
        renderTarot();
        return;
      }
      if (name === "plant-redraw") {
        renderPlant(pickPlantId());
        return;
      }
      if (name === "plant-scroll") {
        var library = $("#plantLibrary");
        if (library) library.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      if (name === "fish-cast" || name === "fish-reel") {
        if (state.fishAction) state.fishAction();
        return;
      }
    }

    var plantTile = event.target.closest("[data-plant-id]");
    if (plantTile) {
      renderPlant(plantTile.dataset.plantId);
      if (dom.searchResult) {
        dom.searchResult.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      return;
    }

    var catAction = event.target.closest("[data-cat-action]");
    if (catAction && state.catAction) {
      state.catAction(catAction.dataset.catAction);
      return;
    }

    var tet = event.target.closest("[data-tet]");
    if (tet && state.tetAction) {
      state.tetAction(tet.dataset.tet);
      return;
    }

    var sok = event.target.closest("[data-sok]");
    if (sok && state.sokAction) {
      state.sokAction(sok.dataset.sok, sok.dataset.value);
      return;
    }

    var card = event.target.closest(".tarot-card");
    if (card) {
      toggleTarotCard(card);
    }
  }

  function toggleTarotCard(card) {
    var open = card.classList.toggle("open");
    card.setAttribute("aria-expanded", open ? "true" : "false");
  }

  /* ---------- tarot reading ---------- */

  function drawTarotCards() {
    var deck = shuffle(TAROT_DECK);
    return deck.slice(0, 3).map(function (card) {
      return {
        card: card,
        reversed: Math.random() < 0.5
      };
    });
  }

  function tarotSummary(draw) {
    var upright = draw.filter(function (item) { return !item.reversed; }).length;
    var reversed = 3 - upright;
    var majors = draw.filter(function (item) { return item.card.suit === "major"; }).length;
    var suitCounts = {};
    draw.forEach(function (item) {
      if (item.card.suit !== "major") {
        suitCounts[item.card.suit] = (suitCounts[item.card.suit] || 0) + 1;
      }
    });
    var dominantSuit = Object.keys(suitCounts).sort(function (a, b) {
      return suitCounts[b] - suitCounts[a];
    })[0];
    var suitNames = {
      wands: "权杖的火",
      cups: "圣杯的水",
      swords: "宝剑的风",
      pentacles: "星币的土",
      major: "大阿尔卡那"
    };

    var title = "缓慢但确定的靠近";
    if (upright === 3) title = "风向正好";
    else if (upright === 1) title = "先把自己放回中心";
    else if (upright === 0) title = "把声音调小一点";

    var flow = upright >= 2
      ? "三张牌里，正位的力量占了上风。事情不是没有阻力，但你有足够的主动权把节奏往自己这边拉一点。"
      : "逆位偏多并不等于坏运气。它更像是在提醒：现在不适合硬推，先把卡住的地方看清楚。";

    var focus = majors >= 2
      ? "大阿尔卡那出现得比较多，这两天的主题不是琐碎小事，而是某个更底层的选择或转折。"
      : dominantSuit
        ? "这次的能量集中在" + suitNames[dominantSuit] + "上，你可以先从这里观察自己的状态。"
        : "三张牌的能量比较分散，适合把注意力收回来，只处理眼前一件具体的事。";

    var advice;
    if (reversed === 0) {
      advice = "今天适合向前一步：发出那条消息、开始那件拖了很久的事，或者认真接住一个已经到来的机会。";
    } else if (reversed === 1) {
      advice = "允许自己慢一点。先把最消耗你的那件事放下一小段时间，再回来处理，答案会更清楚。";
    } else if (reversed === 2) {
      advice = "不要急着做决定。今天更适合整理、删减和休息，把“必须现在解决”的念头松开一点。";
    } else {
      advice = "今天不必证明什么。先照顾睡眠、饮食和身体的感受，等情绪退潮，再判断方向。";
    }

    return {
      title: title,
      flow: flow,
      focus: focus,
      advice: advice,
      upright: upright,
      reversed: reversed
    };
  }

  function tarotArtHTML(card, reversed) {
    return (
      '<div class="tarot-art" style="--card-base:' + card.base + ";--card-deep:" + card.deep + ";--card-glow:" + card.glow + ';">' +
        '<span class="tarot-roman">' + escapeHTML(card.numeral) + "</span>" +
        '<div class="tarot-stage">' +
          '<span class="tarot-orbit"></span>' +
          '<span class="tarot-glyph">' + escapeHTML(card.glyph) + "</span>" +
          '<span class="tarot-moons">✦ · ✧ · ✦</span>' +
        "</div>" +
        '<span class="tarot-name">' + escapeHTML(card.name) + "</span>" +
      "</div>"
    );
  }

  function renderTarot() {
    if (!dom.searchResult) return;
    if (!TAROT_DECK.length) {
      toast("塔罗牌库没有加载成功。");
      return;
    }
    state.searchType = "tarot";
    registerGame("tarot", null);
    var draw = drawTarotCards();
    var summary = tarotSummary(draw);

    var cardsHTML = draw.map(function (item, index) {
      var card = item.card;
      var meaning = item.reversed ? card.reversed : card.upright;
      return (
        '<div class="tarot-card ' + (item.reversed ? "reversed" : "") + '" role="button" tabindex="0" ' +
          'aria-expanded="false" aria-label="' + escapeHTML(card.name + (item.reversed ? "逆位" : "正位")) + '">' +
          tarotArtHTML(card, item.reversed) +
          '<span class="tarot-position">' + ["牌一", "牌二", "牌三"][index] + " · " + (item.reversed ? "逆位" : "正位") + "</span>" +
          '<div class="tarot-caption"><b>' + escapeHTML(card.name) + '</b><em class="' + (item.reversed ? "rev" : "") + '">' + (item.reversed ? "逆" : "正") + "</em></div>" +
          '<div class="tarot-detail"><b>' + (item.reversed ? "逆位牌意" : "正位牌意") + "</b><p>" + escapeHTML(meaning) + "</p></div>" +
        "</div>"
      );
    }).join("");

    dom.searchResult.innerHTML =
      '<div class="result-shell">' +
        resultHeader("THREE CARD DRAW", "今日塔罗牌运势", "三张无牌阵 · 只抽取此刻最需要被看见的三张牌", "✦") +
        '<div class="tarot-controls">' +
          '<span class="tarot-verdict"><i></i>' + summary.upright + " 正 · " + summary.reversed + " 逆</span>" +
          '<button class="text-btn" type="button" data-action="tarot-redraw">重新抽牌 ↻</button>' +
        "</div>" +
        '<div class="tarot-spread">' + cardsHTML + "</div>" +
        '<div class="tarot-summary">' +
          '<p class="micro-label">TODAY’S NOTE</p>' +
          "<h4>" + escapeHTML(summary.title) + "</h4>" +
          "<p>" + escapeHTML(summary.flow) + "</p>" +
          '<p class="advice">' + escapeHTML(summary.focus) + " " + escapeHTML(summary.advice) + "</p>" +
        "</div>" +
        '<p class="result-note">牌义是一种自我觉察的语言，不替代医疗、法律或人生决定。</p>' +
      "</div>";
  }

  /* ---------- "I miss you" ---------- */

  function renderMiss() {
    if (!dom.searchResult) return;
    state.searchType = "miss";
    registerGame("miss", null);
    dom.searchResult.innerHTML =
      '<div class="result-shell miss-page">' +
        '<p class="result-kicker">ENTRY 07 · JUST FOR YOU</p>' +
        '<span class="miss-heart" aria-hidden="true">♡</span>' +
        "<h3>我想你</h3>" +
        "<p>在所有没有被说出口的时刻里，<br>这一句最轻，也最重。</p>" +
        '<button class="wechat-line" type="button" data-copy-wechat>微信ID：ToyoSera<small>DOUBLE TAP TO COPY</small></button>' +
        '<p class="copy-hint">双击这段文字，复制我的微信</p>' +
      "</div>";
  }

  function handleWechatTap() {
    var now = Date.now();
    if (now - state.lastWechatTap < 460) {
      state.lastWechatTap = 0;
      copyWechat();
    } else {
      state.lastWechatTap = now;
    }
  }

  function copyWechat() {
    copyText("微信ID：ToyoSera").then(function (success) {
      if (success) {
        toast("微信号已复制：ToyoSera");
      } else {
        selectWechatText();
        toast("已选中文字，请长按复制。");
      }
    });
  }

  function selectWechatText() {
    var node = $("[data-copy-wechat]");
    if (!node || !window.getSelection || !document.createRange) return;
    var range = document.createRange();
    range.selectNodeContents(node);
    var selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }

  /* ---------- tetris ---------- */

  function renderTetris() {
    if (!dom.searchResult) return;
    cleanupSearch();
    state.searchType = "tetris";
    dom.searchResult.innerHTML =
      '<div class="result-shell">' +
        resultHeader("ENTRY 02 · TETRIS", "我想玩俄罗斯方块", "方向键移动，向上旋转，让她把每一行都填满。", "▦") +
        '<div class="game-card">' +
          '<div class="game-head">' +
            '<div class="score-pills">' +
              '<div class="score-pill"><small>SCORE</small><b id="tetrisScore">0</b></div>' +
              '<div class="score-pill"><small>LINES</small><b id="tetrisLines">0</b></div>' +
              '<div class="score-pill"><small>LEVEL</small><b id="tetrisLevel">01</b></div>' +
            "</div>" +
            '<span class="pixel-hint">10 × 20</span>' +
          "</div>" +
          '<div class="tetris-layout">' +
            '<div class="tetris-board-wrap">' +
              '<canvas id="tetrisCanvas" width="200" height="400" aria-label="俄罗斯方块游戏区域"></canvas>' +
              '<div class="tetris-overlay show" id="tetrisOverlay">' +
                "<div>" +
                  "<h4>俄罗斯方块</h4>" +
                  "<p>← → 移动 · ↑ 旋转<br>空格键直接落下</p>" +
                  '<button class="primary-btn" type="button" data-tet="start">开始游戏</button>' +
                "</div>" +
              "</div>" +
            "</div>" +
            '<div class="tetris-side">' +
              '<div class="next-box"><p class="micro-label">NEXT</p><canvas id="tetrisNext" width="65" height="65" aria-label="下一个方块"></canvas></div>' +
              '<div class="score-pill"><small>SPEED</small><b id="tetrisSpeed">1.0×</b></div>' +
            "</div>" +
          "</div>" +
          '<div class="pad">' +
            '<button class="pad-btn" type="button" data-tet="left" aria-label="向左">←</button>' +
            '<button class="pad-btn rotate" type="button" data-tet="rotate" aria-label="旋转">↻</button>' +
            '<button class="pad-btn" type="button" data-tet="right" aria-label="向右">→</button>' +
            '<button class="pad-btn" type="button" data-tet="down" aria-label="向下">↓</button>' +
          "</div>" +
          '<div class="game-actions">' +
            '<button type="button" data-tet="start" id="tetrisStartBtn">重新开始</button>' +
            '<button type="button" data-tet="drop">直接落下</button>' +
            '<button type="button" data-tet="pause" id="tetrisPauseBtn">暂停</button>' +
          "</div>" +
        "</div>" +
      "</div>";
    mountTetris();
  }

  function mountTetris() {
    var canvas = $("#tetrisCanvas");
    var nextCanvas = $("#tetrisNext");
    var overlay = $("#tetrisOverlay");
    if (!canvas || !nextCanvas || !overlay) return;

    var ctx = canvas.getContext("2d");
    var nextCtx = nextCanvas.getContext("2d");
    var scoreEl = $("#tetrisScore");
    var linesEl = $("#tetrisLines");
    var levelEl = $("#tetrisLevel");
    var speedEl = $("#tetrisSpeed");
    var pauseBtn = $("#tetrisPauseBtn");

    var COLS = 10;
    var ROWS = 20;
    var SIZE = 20;

    var SHAPES = {
      I: [[1, 1, 1, 1]],
      O: [[1, 1], [1, 1]],
      T: [[0, 1, 0], [1, 1, 1]],
      S: [[0, 1, 1], [1, 1, 0]],
      Z: [[1, 1, 0], [0, 1, 1]],
      J: [[1, 0, 0], [1, 1, 1]],
      L: [[0, 0, 1], [1, 1, 1]]
    };
    var COLORS = {
      I: "#9fb5a5",
      O: "#c9aa76",
      T: "#a68a9d",
      S: "#95ab86",
      Z: "#c08070",
      J: "#8e9eb5",
      L: "#c49a74"
    };

    var board = createBoard();
    var bag = [];
    var piece = null;
    var nextType = null;
    var running = false;
    var paused = false;
    var over = false;
    var raf = 0;
    var last = 0;
    var dropTimer = 0;
    var score = 0;
    var lineCount = 0;
    var level = 1;

    function createBoard() {
      var rows = [];
      for (var y = 0; y < ROWS; y += 1) {
        rows.push(new Array(COLS).fill(0));
      }
      return rows;
    }

    function takeType() {
      if (!bag.length) bag = shuffle(Object.keys(SHAPES));
      return bag.pop();
    }

    function makePiece(type) {
      var matrix = SHAPES[type].map(function (row) { return row.slice(); });
      return {
        type: type,
        matrix: matrix,
        x: Math.floor((COLS - matrix[0].length) / 2),
        y: 0
      };
    }

    function rotateMatrix(matrix) {
      return matrix[0].map(function (_, index) {
        return matrix.map(function (row) { return row[index]; }).reverse();
      });
    }

    function collide(testPiece, offsetX, offsetY, matrix) {
      var shape = matrix || testPiece.matrix;
      var dx = offsetX || 0;
      var dy = offsetY || 0;
      for (var y = 0; y < shape.length; y += 1) {
        for (var x = 0; x < shape[y].length; x += 1) {
          if (!shape[y][x]) continue;
          var boardX = testPiece.x + x + dx;
          var boardY = testPiece.y + y + dy;
          if (boardX < 0 || boardX >= COLS || boardY >= ROWS) return true;
          if (boardY >= 0 && board[boardY][boardX]) return true;
        }
      }
      return false;
    }

    function drawBlock(context, x, y, size, color, alpha) {
      context.globalAlpha = typeof alpha === "number" ? alpha : 1;
      context.fillStyle = color;
      context.fillRect(x + 1, y + 1, size - 2, size - 2);
      context.fillStyle = "rgba(255,255,255,0.18)";
      context.fillRect(x + 2, y + 2, size - 4, 2);
      context.fillStyle = "rgba(0,0,0,0.14)";
      context.fillRect(x + 2, y + size - 3, size - 4, 1);
      context.globalAlpha = 1;
    }

    function draw() {
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#171513";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = "rgba(255,255,255,0.035)";
      ctx.lineWidth = 1;
      for (var gx = 1; gx < COLS; gx += 1) {
        ctx.beginPath();
        ctx.moveTo(gx * SIZE + 0.5, 0);
        ctx.lineTo(gx * SIZE + 0.5, ROWS * SIZE);
        ctx.stroke();
      }
      for (var gy = 1; gy < ROWS; gy += 1) {
        ctx.beginPath();
        ctx.moveTo(0, gy * SIZE + 0.5);
        ctx.lineTo(COLS * SIZE, gy * SIZE + 0.5);
        ctx.stroke();
      }

      for (var y = 0; y < ROWS; y += 1) {
        for (var x = 0; x < COLS; x += 1) {
          if (board[y][x]) {
            drawBlock(ctx, x * SIZE, y * SIZE, SIZE, COLORS[board[y][x]] || "#a68a9d");
          }
        }
      }

      if (piece && !over) {
        var ghostY = piece.y;
        while (!collide(piece, 0, ghostY - piece.y + 1)) ghostY += 1;
        for (var gy2 = 0; gy2 < piece.matrix.length; gy2 += 1) {
          for (var gx2 = 0; gx2 < piece.matrix[gy2].length; gx2 += 1) {
            if (piece.matrix[gy2][gx2] && ghostY + gy2 >= 0) {
              ctx.strokeStyle = "rgba(232, 219, 201, 0.18)";
              ctx.strokeRect((piece.x + gx2) * SIZE + 2.5, (ghostY + gy2) * SIZE + 2.5, SIZE - 5, SIZE - 5);
            }
          }
        }

        for (var py = 0; py < piece.matrix.length; py += 1) {
          for (var px = 0; px < piece.matrix[py].length; px += 1) {
            if (piece.matrix[py][px] && piece.y + py >= 0) {
              drawBlock(ctx, (piece.x + px) * SIZE, (piece.y + py) * SIZE, SIZE, COLORS[piece.type]);
            }
          }
        }
      }

      drawNext();
    }

    function drawNext() {
      if (!nextCtx || !nextType) return;
      nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
      var matrix = SHAPES[nextType];
      var cellSize = 13;
      var width = matrix[0].length * cellSize;
      var height = matrix.length * cellSize;
      var offsetX = Math.floor((nextCanvas.width - width) / 2);
      var offsetY = Math.floor((nextCanvas.height - height) / 2);
      for (var y = 0; y < matrix.length; y += 1) {
        for (var x = 0; x < matrix[y].length; x += 1) {
          if (matrix[y][x]) {
            drawBlock(nextCtx, offsetX + x * cellSize, offsetY + y * cellSize, cellSize, COLORS[nextType]);
          }
        }
      }
    }

    function updateStats() {
      if (scoreEl) scoreEl.textContent = String(score);
      if (linesEl) linesEl.textContent = String(lineCount);
      if (levelEl) levelEl.textContent = pad2(level);
      if (speedEl) speedEl.textContent = (1 + (level - 1) * 0.16).toFixed(1) + "×";
    }

    function showOverlay(title, text, buttonLabel, buttonAction) {
      overlay.innerHTML =
        "<div>" +
          "<h4>" + escapeHTML(title) + "</h4>" +
          "<p>" + escapeHTML(text) + "</p>" +
          '<button class="primary-btn" type="button" data-tet="' + escapeHTML(buttonAction || "start") + '">' + escapeHTML(buttonLabel) + "</button>" +
        "</div>";
      overlay.classList.add("show");
    }

    function hideOverlay() {
      overlay.classList.remove("show");
    }

    function spawn() {
      piece = makePiece(nextType);
      nextType = takeType();
      if (collide(piece, 0, 0)) {
        endGame();
        return;
      }
      draw();
    }

    function merge() {
      piece.matrix.forEach(function (row, y) {
        row.forEach(function (value, x) {
          if (!value) return;
          var boardY = piece.y + y;
          var boardX = piece.x + x;
          if (boardY >= 0 && boardY < ROWS && boardX >= 0 && boardX < COLS) {
            board[boardY][boardX] = piece.type;
          }
        });
      });
    }

    function clearLines() {
      var cleared = 0;
      for (var y = ROWS - 1; y >= 0; y -= 1) {
        if (board[y].every(function (cell) { return Boolean(cell); })) {
          board.splice(y, 1);
          board.unshift(new Array(COLS).fill(0));
          cleared += 1;
          y += 1;
        }
      }
      if (cleared) {
        var points = [0, 100, 300, 500, 800][cleared] * level;
        score += points;
        lineCount += cleared;
        level = Math.floor(lineCount / 8) + 1;
        updateStats();
      }
    }

    function lockPiece() {
      merge();
      clearLines();
      dropTimer = 0;
      spawn();
    }

    function stepDown() {
      if (!piece) return;
      if (!collide(piece, 0, 1)) {
        piece.y += 1;
      } else {
        lockPiece();
      }
      draw();
    }

    function softDrop() {
      if (!running || paused || over || !piece) return;
      if (!collide(piece, 0, 1)) {
        piece.y += 1;
        score += 1;
        updateStats();
        draw();
      } else {
        lockPiece();
      }
    }

    function hardDrop() {
      if (!running || paused || over || !piece) return;
      var distance = 0;
      while (!collide(piece, 0, 1)) {
        piece.y += 1;
        distance += 1;
      }
      score += distance * 2;
      updateStats();
      lockPiece();
      draw();
    }

    function move(direction) {
      if (!running || paused || over || !piece) return;
      if (!collide(piece, direction, 0)) {
        piece.x += direction;
        draw();
      }
    }

    function rotate() {
      if (!running || paused || over || !piece) return;
      var rotated = rotateMatrix(piece.matrix);
      for (var kick = 0; kick <= 2; kick += 1) {
        var offset = kick === 0 ? 0 : (kick === 1 ? 1 : -1);
        if (!collide(piece, offset, 0, rotated)) {
          piece.matrix = rotated;
          piece.x += offset;
          draw();
          return;
        }
      }
    }

    function loop(timestamp) {
      if (!running || paused || over) return;
      if (!last) last = timestamp;
      var delta = Math.min(100, timestamp - last);
      last = timestamp;
      dropTimer += delta;
      var interval = Math.max(90, 720 - (level - 1) * 65);
      if (dropTimer >= interval) {
        dropTimer = 0;
        stepDown();
      }
      draw();
      raf = window.requestAnimationFrame(loop);
    }

    function startGame() {
      window.cancelAnimationFrame(raf);
      board = createBoard();
      bag = [];
      piece = null;
      nextType = takeType();
      score = 0;
      lineCount = 0;
      level = 1;
      running = true;
      paused = false;
      over = false;
      dropTimer = 0;
      last = 0;
      updateStats();
      hideOverlay();
      spawn();
      updateStats();
      if (pauseBtn) pauseBtn.textContent = "暂停";
      raf = window.requestAnimationFrame(loop);
    }

    function endGame() {
      running = false;
      over = true;
      window.cancelAnimationFrame(raf);
      showOverlay("游戏结束", "得分 " + score + " · 消除 " + lineCount + " 行", "再来一局", "start");
      if (pauseBtn) pauseBtn.textContent = "暂停";
    }

    function togglePause() {
      if (!running || over) return;
      paused = !paused;
      if (paused) {
        window.cancelAnimationFrame(raf);
        showOverlay("已暂停", "慢慢来，方块会等你。", "继续游戏", "pause");
        if (pauseBtn) pauseBtn.textContent = "继续";
      } else {
        hideOverlay();
        last = 0;
        if (pauseBtn) pauseBtn.textContent = "暂停";
        raf = window.requestAnimationFrame(loop);
      }
    }

    function action(name) {
      if (name === "start") startGame();
      else if (name === "pause") togglePause();
      else if (name === "left") move(-1);
      else if (name === "right") move(1);
      else if (name === "down") softDrop();
      else if (name === "rotate") rotate();
      else if (name === "drop") hardDrop();
    }

    function keyHandler(event) {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        move(-1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        move(1);
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        softDrop();
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        rotate();
      } else if (event.key === " ") {
        event.preventDefault();
        hardDrop();
      } else if (event.key.toLowerCase() === "p") {
        event.preventDefault();
        togglePause();
      }
    }

    state.tetAction = action;
    registerGame("tetris", keyHandler);
    addCleanup(function () {
      running = false;
      window.cancelAnimationFrame(raf);
      state.tetAction = null;
    });

    draw();
    updateStats();
  }

  /* ---------- sokoban ---------- */

  function renderSokoban() {
    if (!dom.searchResult) return;
    if (!SOKOBAN_LEVELS.length) {
      toast("箱子还没有准备好。");
      return;
    }
    cleanupSearch();
    state.searchType = "sokoban";
    dom.searchResult.innerHTML =
      '<div class="result-shell">' +
        resultHeader("ENTRY 03 · SOKOBAN", "我想玩推箱子", "把每一只木箱推上发光的格子。只能推，不能拉。", "▤") +
        '<div class="game-card">' +
          '<div class="game-head">' +
            '<div><span class="micro-label">CURRENT LEVEL</span><b id="sokLevelName" style="display:block;margin-top:2px;font-family:var(--font-serif);font-size:13px;">第一步</b></div>' +
            '<div class="score-pills">' +
              '<div class="score-pill"><small>MOVES</small><b id="sokMoves">0</b></div>' +
              '<div class="score-pill"><small>PUSH</small><b id="sokPushes">0</b></div>' +
            "</div>" +
          "</div>" +
          '<div class="level-pills" id="sokLevelPills">' +
            SOKOBAN_LEVELS.map(function (level, index) {
              return '<button type="button" data-sok="level" data-value="' + index + '" class="' + (index === 0 ? "active" : "") + '" aria-label="第 ' + (index + 1) + ' 关">' + pad2(index + 1) + "</button>";
            }).join("") +
          "</div>" +
          '<div class="sokoban-board" id="sokobanBoard" role="application" aria-label="推箱子棋盘"></div>' +
          '<div class="sok-win" id="sokWin" hidden></div>' +
          '<div class="pad">' +
            '<button class="pad-btn" type="button" data-sok="move" data-value="up" aria-label="向上"><svg viewBox="0 0 24 24"><path d="m6 14 6-6 6 6"/></svg></button>' +
            '<button class="pad-btn" type="button" data-sok="move" data-value="left" aria-label="向左"><svg viewBox="0 0 24 24"><path d="m14 6-6 6 6 6"/></svg></button>' +
            '<button class="pad-btn" type="button" data-sok="move" data-value="down" aria-label="向下"><svg viewBox="0 0 24 24"><path d="m6 10 6 6 6-6"/></svg></button>' +
            '<button class="pad-btn" type="button" data-sok="move" data-value="right" aria-label="向右"><svg viewBox="0 0 24 24"><path d="m10 6 6 6-6 6"/></svg></button>' +
          "</div>" +
          '<div class="game-actions">' +
            '<button type="button" data-sok="undo">撤销一步</button>' +
            '<button type="button" data-sok="reset">重新开始</button>' +
            '<button type="button" data-sok="next">下一关</button>' +
          "</div>" +
          '<p class="pixel-hint" style="margin:8px 0 0;">方向键 / WASD 移动 · 也可以在棋盘上滑动</p>' +
        "</div>" +
      "</div>";
    mountSokoban();
  }

  function mountSokoban() {
    var boardEl = $("#sokobanBoard");
    var winEl = $("#sokWin");
    var movesEl = $("#sokMoves");
    var pushesEl = $("#sokPushes");
    var nameEl = $("#sokLevelName");
    if (!boardEl) return;

    var levelIndex = 0;
    var map = [];
    var player = { x: 0, y: 0 };
    var totalGoals = 0;
    var moves = 0;
    var pushes = 0;
    var history = [];
    var won = false;
    var cellSize = 28;

    function parseLevel(text) {
      var lines = text.split(/\r?\n/).filter(function (line) { return line.length > 0; });
      var width = 0;
      lines.forEach(function (line) { width = Math.max(width, line.length); });
      var grid = lines.map(function (line) { return line.padEnd(width, " ").split(""); });
      var start = { x: 0, y: 0 };
      var goals = 0;
      grid.forEach(function (row, y) {
        row.forEach(function (cell, x) {
          if (cell === "@" || cell === "+") start = { x: x, y: y };
          if (cell === "." || cell === "*" || cell === "+") goals += 1;
        });
      });
      return { grid: grid, player: start, goals: goals };
    }

    function loadLevel(index) {
      levelIndex = (index + SOKOBAN_LEVELS.length) % SOKOBAN_LEVELS.length;
      var parsed = parseLevel(SOKOBAN_LEVELS[levelIndex].map);
      map = parsed.grid;
      player = parsed.player;
      totalGoals = parsed.goals;
      moves = 0;
      pushes = 0;
      history = [];
      won = false;
      $$("[data-sok='level']").forEach(function (button) {
        button.classList.toggle("active", Number(button.dataset.value) === levelIndex);
      });
      if (nameEl) nameEl.textContent = SOKOBAN_LEVELS[levelIndex].name;
      renderBoard();
    }

    function snapshot() {
      return {
        map: map.map(function (row) { return row.slice(); }),
        player: { x: player.x, y: player.y },
        moves: moves,
        pushes: pushes
      };
    }

    function restore(saved) {
      map = saved.map.map(function (row) { return row.slice(); });
      player = { x: saved.player.x, y: saved.player.y };
      moves = saved.moves;
      pushes = saved.pushes;
      won = false;
      renderBoard();
    }

    function countOnGoal() {
      var count = 0;
      map.forEach(function (row) {
        row.forEach(function (cell) {
          if (cell === "*") count += 1;
        });
      });
      return count;
    }

    function renderBoard() {
      var cols = map[0] ? map[0].length : 1;
      cellSize = cols >= 10 ? 26 : 28;
      boardEl.style.gridTemplateColumns = "repeat(" + cols + ", " + cellSize + "px)";
      var html = "";
      map.forEach(function (row, y) {
        row.forEach(function (cell, x) {
          var classes = ["sok-cell"];
          var inner = "";
          if (cell === "#") {
            classes.push("wall");
          } else {
            classes.push("floor");
            if (cell === "." || cell === "*" || cell === "+") classes.push("goal");
            if (cell === "$" || cell === "*") {
              inner += '<span class="sok-box ' + (cell === "*" ? "on-goal" : "") + '"></span>';
            }
            if (cell === "@" || cell === "+") {
              inner += '<span class="sok-player"></span>';
            }
          }
          html += '<div class="' + classes.join(" ") + '" style="width:' + cellSize + "px;height:" + cellSize + 'px;">' + inner + "</div>";
        });
      });
      boardEl.innerHTML = html;
      if (movesEl) movesEl.textContent = String(moves);
      if (pushesEl) pushesEl.textContent = String(pushes);

      if (countOnGoal() === totalGoals) {
        won = true;
        if (winEl) {
          winEl.hidden = false;
          winEl.innerHTML =
            "<b>这一关完成了。</b><br>" +
            '<button class="text-btn" type="button" data-sok="next">继续下一关 →</button>';
        }
      } else if (winEl) {
        winEl.hidden = true;
        winEl.innerHTML = "";
      }
    }

    function attemptMove(dx, dy) {
      if (won) return;
      var tx = player.x + dx;
      var ty = player.y + dy;
      if (!map[ty] || !map[ty][tx]) return;
      var target = map[ty][tx];
      if (target === "#") return;

      var snapshotBefore = snapshot();
      var oldPlayerCell = map[player.y][player.x];
      var playerWasOnGoal = oldPlayerCell === "+";
      var pushed = false;

      if (target === "$" || target === "*") {
        var bx = tx + dx;
        var by = ty + dy;
        if (!map[by] || !map[by][bx]) return;
        var beyond = map[by][bx];
        if (beyond === "#" || beyond === "$" || beyond === "*") return;
        map[player.y][player.x] = playerWasOnGoal ? "." : " ";
        map[ty][tx] = target === "*" ? "." : " ";
        map[by][bx] = beyond === "." ? "*" : "$";
        map[ty][tx] = target === "*" ? "+" : "@";
        pushed = true;
      } else if (target === ".") {
        map[player.y][player.x] = playerWasOnGoal ? "." : " ";
        map[ty][tx] = "+";
      } else {
        map[player.y][player.x] = playerWasOnGoal ? "." : " ";
        map[ty][tx] = "@";
      }

      player = { x: tx, y: ty };
      moves += 1;
      if (pushed) pushes += 1;
      history.push(snapshotBefore);
      if (history.length > 200) history.shift();
      renderBoard();
    }

    function undo() {
      if (!history.length) {
        toast("还没有可以撤销的步骤。");
        return;
      }
      var saved = history.pop();
      restore(saved);
    }

    function action(name, value) {
      if (name === "level") {
        loadLevel(Number(value));
      } else if (name === "reset") {
        loadLevel(levelIndex);
      } else if (name === "next") {
        loadLevel(levelIndex + 1);
      } else if (name === "undo") {
        undo();
      } else if (name === "move") {
        var dirs = {
          up: [0, -1],
          down: [0, 1],
          left: [-1, 0],
          right: [1, 0]
        };
        var dir = dirs[value];
        if (dir) attemptMove(dir[0], dir[1]);
      }
    }

    function keyHandler(event) {
      var key = event.key.toLowerCase();
      var handled = true;
      if (key === "arrowup" || key === "w") attemptMove(0, -1);
      else if (key === "arrowdown" || key === "s") attemptMove(0, 1);
      else if (key === "arrowleft" || key === "a") attemptMove(-1, 0);
      else if (key === "arrowright" || key === "d") attemptMove(1, 0);
      else if (key === "z") undo();
      else handled = false;
      if (handled) event.preventDefault();
    }

    var touchStart = null;
    boardEl.addEventListener("pointerdown", function (event) {
      touchStart = { x: event.clientX, y: event.clientY };
    });
    boardEl.addEventListener("pointerup", function (event) {
      if (!touchStart) return;
      var dx = event.clientX - touchStart.x;
      var dy = event.clientY - touchStart.y;
      touchStart = null;
      if (Math.abs(dx) < 18 && Math.abs(dy) < 18) return;
      if (Math.abs(dx) > Math.abs(dy)) attemptMove(dx > 0 ? 1 : -1, 0);
      else attemptMove(0, dy > 0 ? 1 : -1);
    });

    state.sokAction = action;
    registerGame("sokoban", keyHandler);
    addCleanup(function () {
      state.sokAction = null;
    });
    loadLevel(0);
  }

  /* ---------- plant encyclopedia ---------- */

  var plantArtSerial = 0;

  function plantArt(plant) {
    plantArtSerial += 1;
    var gradientId = "plant-grad-" + plant.id + "-" + plantArtSerial;
    var bgId = "plant-bg-" + plant.id + "-" + plantArtSerial;
    var c1 = plant.colors[0] || "#b8755d";
    var c2 = plant.colors[1] || "#7f4b39";
    var type = plant.type || "flower";
    var petals = plant.petals || 7;
    var art = "";

    art += '<rect width="200" height="200" fill="url(#' + bgId + ')"/>';
    art += '<circle cx="155" cy="45" r="34" fill="' + c1 + '" opacity=".07"/>';
    art += '<circle cx="42" cy="151" r="24" fill="' + c2 + '" opacity=".055"/>';
    art += '<path d="M100 174 C96 158 101 145 100 131" fill="none" stroke="' + c2 + '" stroke-width="3.2" stroke-linecap="round"/>';

    if (type === "tree") {
      art += '<path d="M100 181 C100 160 98 145 96 128" fill="none" stroke="#8a7058" stroke-width="6" stroke-linecap="round"/>';
      art += '<path d="M99 156 C92 148 85 146 77 146M99 146 C106 139 112 137 118 136" fill="none" stroke="#8a7058" stroke-width="3" stroke-linecap="round"/>';
      art += '<circle cx="88" cy="95" r="33" fill="' + c2 + '" opacity=".88"/>';
      art += '<circle cx="119" cy="89" r="30" fill="' + c1 + '" opacity=".92"/>';
      art += '<circle cx="105" cy="67" r="27" fill="' + c1 + '" opacity=".72"/>';
      art += '<circle cx="77" cy="117" r="22" fill="' + c2 + '" opacity=".7"/>';
      art += '<circle cx="127" cy="116" r="21" fill="' + c2 + '" opacity=".78"/>';
    } else if (type === "fern") {
      art += '<path d="M100 181 C96 151 90 122 82 96 C78 84 77 74 76 62" fill="none" stroke="' + c2 + '" stroke-width="3" stroke-linecap="round"/>';
      for (var f = 0; f < 10; f += 1) {
        var fy = 162 - f * 10;
        var fw = 7 + f * 2.4;
        art += '<ellipse cx="' + (91 - f * 1.2) + '" cy="' + fy + '" rx="' + fw + '" ry="4" fill="' + c1 + '" opacity="' + (0.45 + f * 0.045) + '" transform="rotate(-30 ' + (91 - f * 1.2) + " " + fy + ')"/>';
        art += '<ellipse cx="' + (108 + f * 0.7) + '" cy="' + (fy - 4) + '" rx="' + (fw - 1) + '" ry="3.4" fill="' + c2 + '" opacity="' + (0.35 + f * 0.04) + '" transform="rotate(28 ' + (108 + f * 0.7) + " " + (fy - 4) + ')"/>';
      }
      art += '<path d="M100 181 C109 156 117 133 122 108 C126 91 131 78 138 66" fill="none" stroke="' + c1 + '" stroke-width="2" stroke-linecap="round" opacity=".8"/>';
    } else if (type === "vine") {
      art += '<path d="M100 181 C78 164 121 149 95 131 C73 116 118 103 96 85 C82 73 92 57 112 47" fill="none" stroke="' + c2 + '" stroke-width="3" stroke-linecap="round"/>';
      [[78, 158, -35], [119, 143, 34], [80, 119, -38], [117, 101, 32], [89, 72, -28], [110, 51, 38]].forEach(function (point, index) {
        var fill = index % 2 ? c2 : c1;
        art += '<path d="M' + point[0] + " " + point[1] + ' q14 -14 23 -3 q-9 17 -23 3Z" fill="' + fill + '" opacity=".82" transform="rotate(' + point[2] + " " + point[0] + " " + point[1] + ')"/>';
      });
    } else if (type === "leaf") {
      art += '<path d="M100 181 C98 159 101 139 98 119" fill="none" stroke="' + c2 + '" stroke-width="3" stroke-linecap="round"/>';
      [[83, 153, -42], [117, 143, 42], [85, 127, -50], [114, 113, 48], [94, 92, -32], [109, 78, 35]].forEach(function (point, index) {
        art += '<ellipse cx="' + point[0] + '" cy="' + point[1] + '" rx="16" ry="8" fill="' + (index % 2 ? c2 : c1) + '" opacity=".83" transform="rotate(' + point[2] + " " + point[0] + " " + point[1] + ')"/>';
        art += '<path d="M' + (point[0] - 10) + " " + point[1] + " L" + (point[0] + 10) + " " + point[1] + '" stroke="#fff" stroke-opacity=".25" stroke-width=".8"/>';
      });
    } else {
      art += '<path d="M100 154 C79 143 72 153 87 164 C70 164 67 174 92 175 C108 178 118 171 115 162Z" fill="' + c2 + '" opacity=".7"/>';
      art += '<path d="M100 151 C119 139 128 149 113 160 C132 159 134 170 110 173 C94 176 84 168 88 159Z" fill="' + c1 + '" opacity=".72"/>';

      if (type === "bell") {
        art += '<path d="M100 176 C101 150 99 121 100 92" fill="none" stroke="' + c2 + '" stroke-width="2.4" stroke-linecap="round"/>';
        [102, 130, 156].forEach(function (y, index) {
          art += '<path d="M100 ' + (y - 19) + ' c18 2 20 13 4 17 l-3 8 l-4 -8 c-16 -4 -15 -15 3 -17Z" fill="' + (index % 2 ? c2 : c1) + '" opacity=".92"/>';
        });
      } else if (type === "spike") {
        art += '<path d="M100 176 C100 141 100 105 100 69" fill="none" stroke="' + c2 + '" stroke-width="2.5" stroke-linecap="round"/>';
        for (var s = 0; s < 9; s += 1) {
          var sy = 155 - s * 8;
          var sx = 100 + Math.sin(s * 1.4) * (3 + s * 0.7);
          art += '<ellipse cx="' + sx + '" cy="' + sy + '" rx="' + (9 - s * 0.45) + '" ry="4.5" fill="' + (s % 2 ? c2 : c1) + '" opacity=".9"/>';
        }
      } else if (type === "dandelion") {
        art += '<path d="M100 176 C100 150 100 125 100 106" fill="none" stroke="' + c2 + '" stroke-width="2.6" stroke-linecap="round"/>';
        art += '<circle cx="100" cy="82" r="10" fill="' + c1 + '"/>';
        for (var d = 0; d < 18; d += 1) {
          var angle = (Math.PI * 2 * d) / 18;
          var ex = 100 + Math.cos(angle) * 31;
          var ey = 82 + Math.sin(angle) * 31;
          art += '<line x1="100" y1="82" x2="' + ex.toFixed(1) + '" y2="' + ey.toFixed(1) + '" stroke="' + c1 + '" stroke-width=".85" opacity=".72"/>';
          art += '<circle cx="' + ex.toFixed(1) + '" cy="' + ey.toFixed(1) + '" r="2.1" fill="#faf7ef" opacity=".9"/>';
        }
      } else if (type === "tulip") {
        art += '<path d="M79 98 C78 77 91 68 100 86 C109 68 122 77 121 98 C121 111 110 119 100 119 C90 119 79 111 79 98Z" fill="url(#' + gradientId + ')"/>';
        art += '<path d="M100 86 C95 97 95 108 100 119" fill="none" stroke="' + c2 + '" stroke-width="1.2" opacity=".5"/>';
      } else if (type === "daisy") {
        for (var p = 0; p < petals; p += 1) {
          var da = (360 / petals) * p;
          art += '<ellipse cx="100" cy="69" rx="6.5" ry="21" fill="url(#' + gradientId + ')" opacity=".9" transform="rotate(' + da + ' 100 91)"/>';
        }
        art += '<circle cx="100" cy="91" r="13" fill="#d6b04a"/>';
        art += '<circle cx="100" cy="91" r="8" fill="#e8cb72" opacity=".9"/>';
      } else {
        for (var q = 0; q < petals; q += 1) {
          var qa = (360 / petals) * q + 12;
          art += '<ellipse cx="100" cy="67" rx="12" ry="25" fill="url(#' + gradientId + ')" opacity=".88" transform="rotate(' + qa + ' 100 92)"/>';
        }
        art += '<circle cx="100" cy="92" r="13" fill="' + c2 + '"/>';
        art += '<circle cx="100" cy="92" r="7" fill="' + c1 + '" opacity=".85"/>';
      }
    }

    art += '<circle cx="167" cy="119" r="2" fill="' + c1 + '" opacity=".3"/>';
    art += '<circle cx="39" cy="65" r="1.5" fill="' + c2 + '" opacity=".26"/>';
    art += '<circle cx="151" cy="164" r="1.5" fill="' + c1 + '" opacity=".23"/>';

    return (
      '<svg viewBox="0 0 200 200" role="img" aria-label="' + escapeHTML(plant.name) + '插画" xmlns="http://www.w3.org/2000/svg">' +
        "<defs>" +
          '<linearGradient id="' + gradientId + '" x1="0" y1="0" x2="1" y2="1">' +
            '<stop offset="0" stop-color="' + c1 + '"/>' +
            '<stop offset="1" stop-color="' + c2 + '"/>' +
          "</linearGradient>" +
          '<radialGradient id="' + bgId + '" cx=".32" cy=".22" r=".82">' +
            '<stop offset="0" stop-color="#fffdf8" stop-opacity=".86"/>' +
            '<stop offset="1" stop-color="#e7ddce" stop-opacity=".55"/>' +
          "</radialGradient>" +
        "</defs>" +
        art +
      "</svg>"
    );
  }

  function pickPlantId(excludeId) {
    var pool = PLANTS.filter(function (plant) { return plant.id !== excludeId; });
    return pool.length ? pick(pool).id : (PLANTS[0] ? PLANTS[0].id : "");
  }

  function renderPlant(plantId) {
    if (!dom.searchResult) return;
    if (!PLANTS.length) {
      toast("植物图鉴还没有加载成功。");
      return;
    }
    cleanupSearch();
    state.searchType = "plant";
    registerGame("plant", null);
    var plant = PLANTS.filter(function (item) { return item.id === plantId; })[0] || PLANTS[randomIndex(PLANTS.length)];
    var art = plantArt(plant);

    var libraryHTML = PLANTS.map(function (item) {
      return (
        '<button class="plant-tile" type="button" data-plant-id="' + item.id + '" aria-label="查看' + escapeHTML(item.name) + '">' +
          '<span class="plant-tile-art">' + plantArt(item) + "</span>" +
          "<b>" + escapeHTML(item.name) + "</b>" +
        "</button>"
      );
    }).join("");

    dom.searchResult.innerHTML =
      '<div class="result-shell">' +
        resultHeader("ENTRY 04 · BOTANICAL DRAW", "我想抽抽今日植物", "从植物百科里，抽一株今天愿意陪你坐一会儿的植物。", "❀") +
        '<section class="plant-of-day" style="--plant-glow:' + plant.colors[0] + '33;">' +
          '<div class="plant-hero">' +
            '<div class="plant-art-wrap">' + art + "</div>" +
            '<div class="plant-copy">' +
              '<p class="plant-latin">' + escapeHTML(plant.latin) + "</p>" +
              '<h3 class="plant-name">' + escapeHTML(plant.name) + "</h3>" +
              '<p class="plant-meaning">' + escapeHTML(plant.meaning) + "</p>" +
              '<div class="plant-tags"><span>' + escapeHTML(plant.element) + "</span><span>" + escapeHTML(plant.season) + "</span></div>" +
            "</div>" +
          "</div>" +
          '<div class="plant-facts">' +
            '<div class="plant-fact"><small>生长位置</small><b>' + escapeHTML(plant.location) + "</b></div>" +
            '<div class="plant-fact"><small>花期 / 状态</small><b>' + escapeHTML(plant.season) + "</b></div>" +
            '<div class="plant-fact"><small>元素</small><b>' + escapeHTML(plant.element) + "</b></div>" +
            '<div class="plant-fact"><small>养护</small><b>' + escapeHTML(plant.care) + "</b></div>" +
          "</div>" +
          '<p class="plant-note">' + escapeHTML(plant.note) + "</p>" +
          '<div class="plant-actions">' +
            '<button class="primary-btn" type="button" data-action="plant-redraw">再抽一株</button>' +
            '<button class="secondary-btn" type="button" data-action="plant-scroll">翻看图鉴</button>' +
          "</div>" +
        "</section>" +
        '<div class="plant-library" id="plantLibrary">' +
          '<div class="library-head"><h4>植物图鉴</h4><span>' + PLANTS.length + " 种</span></div>" +
          '<div class="plant-grid">' + libraryHTML + "</div>" +
        "</div>" +
        '<p class="result-note">植物信息来自常见植物百科与民俗象征，仅作欣赏与自我观照。</p>' +
      "</div>";
  }

  /* ---------- cat ---------- */

  function catSceneSVG() {
    return (
      '<svg viewBox="0 0 300 250" role="img" aria-label="一只坐在窗边的橘色小猫">' +
        "<defs>" +
          '<linearGradient id="cat-room" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ede4d6"/><stop offset="1" stop-color="#cfc0ab"/></linearGradient>' +
          '<linearGradient id="cat-fur" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#eac194"/><stop offset="1" stop-color="#c78c60"/></linearGradient>' +
          '<linearGradient id="cat-window" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b7cbc8"/><stop offset="1" stop-color="#e8d9bd"/></linearGradient>' +
        "</defs>" +
        '<rect width="300" height="250" fill="url(#cat-room)"/>' +
        '<rect x="204" y="17" width="73" height="101" rx="4" fill="url(#cat-window)" opacity=".9"/>' +
        '<path d="M240 17v101M204 67h73" stroke="#f4ecdf" stroke-width="3" opacity=".65"/>' +
        '<circle cx="247" cy="45" r="16" fill="#f5e6b9" opacity=".7"/>' +
        '<path d="M204 17 L219 17 L204 55Z" fill="#f6efe4" opacity=".55"/>' +
        '<path d="M0 207 C63 197 240 198 300 207 L300 250 L0 250Z" fill="#b7a68f" opacity=".62"/>' +
        '<ellipse cx="150" cy="216" rx="88" ry="16" fill="#9f8e78" opacity=".28"/>' +
        '<path d="M20 207 h260" stroke="#f4eadc" stroke-width="1" opacity=".3"/>' +
        '<g opacity=".75">' +
          '<path d="M30 202 h26 l-4 24 h-18Z" fill="#8e755c"/>' +
          '<path d="M43 202 C37 186 43 177 34 169M43 193 C51 181 54 171 62 169M43 187 C36 176 30 172 27 163" fill="none" stroke="#6f8269" stroke-width="2.5" stroke-linecap="round"/>' +
          '<ellipse cx="33" cy="167" rx="7" ry="4" fill="#7f9476" transform="rotate(-30 33 167)"/>' +
          '<ellipse cx="63" cy="168" rx="7" ry="4" fill="#6f8269" transform="rotate(26 63 168)"/>' +
          '<ellipse cx="27" cy="161" rx="6" ry="3.5" fill="#91a184" transform="rotate(-18 27 161)"/>' +
        "</g>" +
        '<g class="cat-tail">' +
          '<path d="M207 198 C251 203 259 158 232 144" fill="none" stroke="#b77b52" stroke-width="16" stroke-linecap="round"/>' +
          '<path d="M207 198 C251 203 259 158 232 144" fill="none" stroke="#e2ae7f" stroke-width="10" stroke-linecap="round"/>' +
          '<path d="M241 153 c-3 6 -3 11 2 15" fill="none" stroke="#c88d61" stroke-width="3" stroke-linecap="round" opacity=".6"/>' +
        "</g>" +
        '<g class="cat-body">' +
          '<ellipse cx="151" cy="184" rx="54" ry="38" fill="url(#cat-fur)"/>' +
          '<ellipse cx="151" cy="196" rx="31" ry="21" fill="#f1d8ba" opacity=".62"/>' +
          '<path d="M120 165 q6 8 1 15M146 158 q5 9 0 17M171 165 q-4 8 1 14" fill="none" stroke="#b97d52" stroke-width="4" stroke-linecap="round" opacity=".45"/>' +
          '<ellipse cx="121" cy="205" rx="16" ry="8" fill="#e5b586"/>' +
          '<ellipse cx="180" cy="205" rx="16" ry="8" fill="#e5b586"/>' +
          '<path d="M124 207 v3M132 207 v3M176 207 v3M184 207 v3" stroke="#b97d52" stroke-width="1.2" opacity=".55"/>' +
          '<g class="cat-head">' +
            '<path d="M119 123 L111 89 L139 106Z" fill="#d59666"/>' +
            '<path d="M181 123 L189 89 L161 106Z" fill="#d59666"/>' +
            '<path d="M120 116 L116 98 L132 107Z" fill="#efc3a0" opacity=".9"/>' +
            '<path d="M180 116 L184 98 L168 107Z" fill="#efc3a0" opacity=".9"/>' +
            '<ellipse cx="150" cy="138" rx="38" ry="34" fill="url(#cat-fur)"/>' +
            '<path d="M150 107 v12M139 110 l4 10M161 110 l-4 10" stroke="#b97d52" stroke-width="4" stroke-linecap="round" opacity=".55"/>' +
            '<ellipse cx="120" cy="148" rx="8" ry="4" fill="#d98d75" opacity=".18"/>' +
            '<ellipse cx="180" cy="148" rx="8" ry="4" fill="#d98d75" opacity=".18"/>' +
            '<ellipse class="cat-eye" cx="136" cy="138" rx="4.5" ry="6.5" fill="#3e2d23"/>' +
            '<ellipse class="cat-eye right" cx="164" cy="138" rx="4.5" ry="6.5" fill="#3e2d23"/>' +
            '<circle cx="134.7" cy="135.8" r="1.2" fill="#fff9ec"/>' +
            '<circle cx="162.7" cy="135.8" r="1.2" fill="#fff9ec"/>' +
            '<path d="M150 147 l-4 3 h8Z" fill="#a76762"/>' +
            '<path d="M150 150 c0 4 -6 4 -7 0M150 150 c0 4 6 4 7 0" fill="none" stroke="#7b4d43" stroke-width="1.2" stroke-linecap="round"/>' +
            '<path d="M112 145 h-18M113 150 l-17 4M188 145 h18M187 150 l17 4" stroke="#8c6d55" stroke-width="1" opacity=".52" stroke-linecap="round"/>' +
          "</g>" +
        "</g>" +
        '<g class="cat-bowl">' +
          '<ellipse cx="55" cy="215" rx="22" ry="7" fill="#8b7e6c" opacity=".25"/>' +
          '<path d="M35 199 h40 l-5 16 c-1 4 -4 6 -8 6 h-14 c-4 0 -7 -2 -8 -6Z" fill="#778273"/>' +
          '<ellipse cx="55" cy="199" rx="20" ry="6" fill="#596454"/>' +
          '<circle cx="48" cy="199" r="2.3" fill="#b99a68"/><circle cx="54" cy="197" r="2" fill="#c8a979"/><circle cx="60" cy="200" r="2.1" fill="#a98a5c"/>' +
        "</g>" +
        '<g class="cat-brush">' +
          '<rect x="231" y="174" width="31" height="8" rx="4" fill="#9a7a5c" transform="rotate(-24 246 178)"/>' +
          '<ellipse cx="259" cy="163" rx="8" ry="4" fill="#d7c3aa" transform="rotate(-24 259 163)"/>' +
          '<path d="M254 160 l8 -6M256 164 l9 -5" stroke="#f2e7d6" stroke-width="1" opacity=".7"/>' +
        "</g>" +
      "</svg>"
    );
  }

  function initCatState() {
    var stored = readJSON(STORE_KEYS.cat, null);
    var base = { fullness: 62, mood: 76, softness: 54 };
    if (stored && typeof stored === "object") {
      ["fullness", "mood", "softness"].forEach(function (key) {
        var value = Number(stored[key]);
        if (Number.isFinite(value)) {
          base[key] = Math.max(0, Math.min(100, value));
        }
      });
    }
    state.cat = base;
    return base;
  }

  function catStatRow(label, key, value) {
    return (
      '<div class="cat-stat" data-stat="' + key + '">' +
        "<span>" + label + "</span>" +
        '<i style="--v:' + Math.round(value) + '%"></i>' +
        "<b>" + Math.round(value) + "</b>" +
      "</div>"
    );
  }

  function renderCat() {
    if (!dom.searchResult) return;
    cleanupSearch();
    state.searchType = "cat";
    registerGame("cat", null);
    var cat = initCatState();

    dom.searchResult.innerHTML =
      '<div class="result-shell">' +
        resultHeader("ENTRY 05 · A SMALL CAT", "我要喂小猫", "喂饭、摸头和梳毛，小猫的心情会记在这台设备里。", "ฅ") +
        '<div class="cat-card glass" id="catCard">' +
          '<div class="cat-scene">' +
            catSceneSVG() +
            '<div class="cat-particle-layer" id="catParticles"></div>' +
            '<div class="cat-speech" id="catSpeech" role="status" aria-live="polite"></div>' +
          "</div>" +
          '<div class="cat-stats">' +
            catStatRow("饱腹", "fullness", cat.fullness) +
            catStatRow("心情", "mood", cat.mood) +
            catStatRow("蓬松", "softness", cat.softness) +
          "</div>" +
          '<div class="cat-actions">' +
            '<button class="cat-btn" type="button" data-cat-action="feed">' +
              '<svg viewBox="0 0 24 24"><path d="M4 12h16l-2 7H6l-2-7Z"/><path d="M7 9c1-3 3-4 5-4s4 1 5 4"/><path d="M9 5.5c0-1 .8-2 2-2"/></svg>喂猫粮' +
            "</button>" +
            '<button class="cat-btn" type="button" data-cat-action="pet">' +
              '<svg viewBox="0 0 24 24"><path d="M12 20s-7-4.3-7-9a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 4.7-7 9-7 9Z"/></svg>摸猫猫' +
            "</button>" +
            '<button class="cat-btn" type="button" data-cat-action="brush">' +
              '<svg viewBox="0 0 24 24"><path d="M5 14h9a3 3 0 0 0 3-3V6H8a3 3 0 0 0-3 3v5Z"/><path d="M17 11h2a2 2 0 0 1 2 2v4a3 3 0 0 1-3 3h-6"/><path d="M8 14v4M12 14v4"/></svg>梳毛' +
            "</button>" +
          "</div>" +
          '<p class="cat-tip">小猫会记住你的每一次靠近。</p>' +
        "</div>" +
      "</div>";
    mountCat();
  }

  function mountCat() {
    var card = $("#catCard");
    var speech = $("#catSpeech");
    var particles = $("#catParticles");
    var speechTimer = null;
    var classTimers = [];

    function clearCatTimers() {
      catTimers.forEach(function (timer) { window.clearTimeout(timer); });
      catTimers = [];
      if (speechTimer) window.clearTimeout(speechTimer);
      speechTimer = null;
      classTimers.forEach(function (timer) { window.clearTimeout(timer); });
      classTimers = [];
    }

    function saveCat() {
      writeJSON(STORE_KEYS.cat, state.cat);
    }

    function updateBars() {
      if (!state.cat) return;
      $$(".cat-stat", card).forEach(function (row) {
        var key = row.dataset.stat;
        var value = state.cat[key];
        var bar = $("i", row);
        var number = $("b", row);
        if (bar) bar.style.setProperty("--v", Math.round(value) + "%");
        if (number) number.textContent = String(Math.round(value));
      });
    }

    function say(text) {
      if (!speech) return;
      speech.textContent = text;
      speech.classList.add("show");
      if (speechTimer) window.clearTimeout(speechTimer);
      speechTimer = window.setTimeout(function () {
        speech.classList.remove("show");
      }, 2300);
    }

    function flashClass(className, duration) {
      if (!card) return;
      card.classList.add(className);
      var timer = window.setTimeout(function () {
        card.classList.remove(className);
      }, duration);
      classTimers.push(timer);
    }

    function addParticles(character, count, color) {
      if (!particles) return;
      for (var i = 0; i < count; i += 1) {
        var particle = document.createElement("span");
        particle.className = "cat-heart";
        particle.textContent = character;
        particle.style.left = (44 + Math.random() * 22) + "%";
        particle.style.bottom = (25 + Math.random() * 20) + "%";
        particle.style.setProperty("--dx", (Math.random() * 44 - 22).toFixed(0) + "px");
        particle.style.animationDelay = (Math.random() * 0.25).toFixed(2) + "s";
        if (color) particle.style.color = color;
        particles.appendChild(particle);
        window.setTimeout(function (node) {
          return function () {
            if (node.parentNode) node.parentNode.removeChild(node);
          };
        }(particle), 2100);
      }
    }

    function interact(action) {
      if (!state.cat) return;
      var changed = false;
      if (action === "feed") {
        if (state.cat.fullness >= 98) {
          say("已经吃得饱饱的了，摸摸我嘛。");
        } else {
          state.cat.fullness = Math.min(100, state.cat.fullness + 18);
          state.cat.mood = Math.min(100, state.cat.mood + 4);
          flashClass("eating", 1900);
          flashClass("fed", 3200);
          say(pick(["喵！这个很好吃。", "再吃一口，就一口。", "谢谢你，今天也有好好吃饭。"]));
          addParticles("·", 5, "#c49a6d");
          changed = true;
        }
      } else if (action === "pet") {
        state.cat.mood = Math.min(100, state.cat.mood + 14);
        state.cat.softness = Math.min(100, state.cat.softness + 2);
        flashClass("petting", 1000);
        say(pick(["呼噜呼噜……", "可以再摸一会儿吗？", "你的手很暖。"]));
        addParticles("♡", 4, "rgba(177,87,76,.85)");
        changed = true;
      } else if (action === "brush") {
        state.cat.softness = Math.min(100, state.cat.softness + 16);
        state.cat.mood = Math.min(100, state.cat.mood + 3);
        flashClass("brushing", 1500);
        say(pick(["毛毛变得蓬松了。", "轻一点，再轻一点。", "今天的我也很漂亮。"]));
        addParticles("✦", 5, "rgba(185,154,99,.88)");
        changed = true;
      }

      if (changed) {
        saveCat();
        updateBars();
      }
    }

    state.catAction = interact;
    addCleanup(function () {
      clearCatTimers();
      state.catAction = null;
    });
    updateBars();
    classTimers.push(window.setTimeout(function () {
      say("今天也要好好照顾自己。");
    }, 600));
    catTimers.push(classTimers[classTimers.length - 1]);
  }

  /* ---------- fishing ---------- */

  var FISH_TYPES = [
    { name: "银鳞小鱼", color: "#d8ded1", size: 1 },
    { name: "橘尾鲫鱼", color: "#d59a63", size: 1 },
    { name: "月光鳟鱼", color: "#aabcc9", size: 2 },
    { name: "青苔鲤鱼", color: "#93a581", size: 2 },
    { name: "旧靴子", color: "#8d7b68", size: 0 },
    { name: "星点海星", color: "#c9a184", size: 0 },
    { name: "一尾锦鲤", color: "#cf7d65", size: 3 }
  ];

  function renderFishing() {
    if (!dom.searchResult) return;
    cleanupSearch();
    state.searchType = "fishing";
    dom.searchResult.innerHTML =
      '<div class="result-shell">' +
        resultHeader("ENTRY 06 · PIXEL FISHING", "钓鱼", "抛竿，等浮标沉下去，然后在它逃走之前收线。", "♒") +
        '<div class="game-card">' +
          '<div class="game-head">' +
            '<div class="score-pills">' +
              '<div class="score-pill"><small>CATCH</small><b id="fishCount">0</b></div>' +
              '<div class="score-pill"><small>MOOD</small><b>∞</b></div>' +
            "</div>" +
            '<span class="pixel-hint">8-BIT POND</span>' +
          "</div>" +
          '<div class="fishing-frame"><canvas id="fishingCanvas" width="320" height="240" aria-label="像素风钓鱼游戏"></canvas></div>' +
          '<div class="fishing-status"><span id="fishStatus">海面很安静。</span><b id="fishPhase">READY</b></div>' +
          '<div class="fishing-meter"><i id="fishMeter"></i></div>' +
          '<div class="fishing-actions">' +
            '<button class="secondary-btn" type="button" data-action="fish-tip">收线时机</button>' +
            '<button class="primary-btn" type="button" data-action="fish-cast" id="fishActionBtn">抛竿</button>' +
          "</div>" +
          '<div class="fish-log" id="fishLog"><em>还没有渔获。</em></div>' +
        "</div>" +
      "</div>";
    mountFishing();
  }

  function mountFishing() {
    var canvas = $("#fishingCanvas");
    var actionBtn = $("#fishActionBtn");
    var statusEl = $("#fishStatus");
    var phaseEl = $("#fishPhase");
    var meterEl = $("#fishMeter");
    var countEl = $("#fishCount");
    var logEl = $("#fishLog");
    var tip = $('[data-action="fish-tip"]');
    if (!canvas) return;

    var ctx = canvas.getContext("2d");
    var W = 320;
    var H = 240;
    var fishGame = {
      phase: "idle",
      phaseStart: performance.now(),
      biteAt: 0,
      biteUntil: 0,
      caught: null,
      log: [],
      total: 0
    };
    var raf = 0;

    function setStatus(text, phase) {
      if (statusEl) statusEl.textContent = text;
      if (phaseEl) phaseEl.textContent = phase;
    }

    function updateControls() {
      if (!actionBtn) return;
      if (fishGame.phase === "idle") actionBtn.textContent = "抛竿";
      else if (fishGame.phase === "casting" || fishGame.phase === "waiting") actionBtn.textContent = "收线";
      else if (fishGame.phase === "bite") actionBtn.textContent = "快收线！";
      else actionBtn.textContent = "再抛一次";
    }

    function cast() {
      if (fishGame.phase !== "idle" && fishGame.phase !== "caught" && fishGame.phase !== "missed") {
        reel();
        return;
      }
      fishGame.phase = "casting";
      fishGame.phaseStart = performance.now();
      fishGame.caught = null;
      setStatus("浮标飞出去了……", "CAST");
      updateControls();
    }

    function reel() {
      var now = performance.now();
      if (fishGame.phase === "bite") {
        var fish = pick(FISH_TYPES);
        fishGame.phase = "caught";
        fishGame.phaseStart = now;
        fishGame.caught = fish;
        fishGame.log.push(fish.name);
        if (fishGame.log.length > 8) fishGame.log.shift();
        fishGame.total += 1;
        if (countEl) countEl.textContent = String(fishGame.total);
        if (fishGame.log.length) {
          if (logEl) logEl.innerHTML = fishGame.log.slice().reverse().map(function (name) {
            return "<span>" + escapeHTML(name) + "</span>";
          }).join("");
        }
        setStatus("钓到了「" + fish.name + "」！", "CATCH");
      } else if (fishGame.phase === "waiting" || fishGame.phase === "casting") {
        fishGame.phase = "missed";
        fishGame.phaseStart = now;
        setStatus("收线太早了，水面又安静下来。", "MISSED");
      } else if (fishGame.phase === "idle") {
        cast();
        return;
      }
      updateControls();
    }

    function action() {
      if (fishGame.phase === "idle" || fishGame.phase === "caught" || fishGame.phase === "missed") cast();
      else reel();
    }

    function easeOutCubic(t) {
      return 1 - Math.pow(1 - t, 3);
    }

    function drawScene(now) {
      if (!ctx) return;
      ctx.imageSmoothingEnabled = false;

      // Sky
      ctx.fillStyle = "#c6d7d3";
      ctx.fillRect(0, 0, W, 52);
      ctx.fillStyle = "#d9ddcf";
      ctx.fillRect(0, 52, W, 44);
      ctx.fillStyle = "#eadbc5";
      ctx.fillRect(0, 96, W, 34);

      // Sun
      ctx.fillStyle = "#f3e1ad";
      ctx.fillRect(245, 29, 22, 22);
      ctx.fillRect(249, 25, 14, 30);
      ctx.fillRect(241, 33, 30, 14);
      ctx.fillStyle = "rgba(246,232,183,.35)";
      ctx.fillRect(233, 21, 46, 46);

      // Clouds
      var drift = Math.floor((now / 220) % 360);
      [0, 1].forEach(function (cloudIndex) {
        var cx = ((cloudIndex * 170 - drift) % 360 + 360) % 360 - 40;
        var cy = 35 + cloudIndex * 24;
        ctx.fillStyle = "rgba(255,251,242,.72)";
        ctx.fillRect(cx, cy, 31, 5);
        ctx.fillRect(cx + 6, cy - 5, 20, 5);
        ctx.fillRect(cx + 12, cy - 10, 10, 5);
        ctx.fillStyle = "rgba(255,251,242,.35)";
        ctx.fillRect(cx - 5, cy + 5, 41, 4);
      });

      // Hills
      ctx.fillStyle = "#8fa99a";
      ctx.beginPath();
      ctx.moveTo(0, 126);
      ctx.lineTo(38, 101);
      ctx.lineTo(74, 118);
      ctx.lineTo(112, 92);
      ctx.lineTo(155, 120);
      ctx.lineTo(202, 99);
      ctx.lineTo(247, 119);
      ctx.lineTo(292, 96);
      ctx.lineTo(320, 118);
      ctx.lineTo(320, 136);
      ctx.lineTo(0, 136);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#7e9a8d";
      ctx.beginPath();
      ctx.moveTo(0, 128);
      ctx.lineTo(51, 112);
      ctx.lineTo(97, 126);
      ctx.lineTo(151, 108);
      ctx.lineTo(207, 128);
      ctx.lineTo(264, 110);
      ctx.lineTo(320, 126);
      ctx.lineTo(320, 140);
      ctx.lineTo(0, 140);
      ctx.closePath();
      ctx.fill();

      // Sea
      ctx.fillStyle = "#4f7d86";
      ctx.fillRect(0, 129, W, 111);
      ctx.fillStyle = "#456f7a";
      ctx.fillRect(0, 162, W, 78);
      ctx.fillStyle = "#3b626e";
      ctx.fillRect(0, 198, W, 42);
      ctx.fillStyle = "#365862";
      ctx.fillRect(0, 226, W, 14);

      // Wave strips
      for (var row = 0; row < 9; row += 1) {
        var wy = 136 + row * 12;
        ctx.fillStyle = row % 2 ? "rgba(190,219,212,.16)" : "rgba(217,233,222,.09)";
        for (var wx = -12; wx < W; wx += 26) {
          var offset = Math.sin((now / 500) + row + wx) * 4;
          ctx.fillRect(wx + offset, wy, 14, 2);
          ctx.fillRect(wx + offset + 6, wy + 2, 8, 1);
        }
      }

      // Dock
      ctx.fillStyle = "#6b513c";
      ctx.fillRect(0, 108, 116, 12);
      ctx.fillStyle = "#87684c";
      ctx.fillRect(0, 105, 116, 5);
      ctx.fillStyle = "rgba(48,35,26,.35)";
      ctx.fillRect(0, 114, 116, 2);
      for (var plank = 0; plank < 116; plank += 18) {
        ctx.fillStyle = "rgba(45,32,23,.26)";
        ctx.fillRect(plank, 105, 1, 12);
      }
      ctx.fillStyle = "#584231";
      ctx.fillRect(99, 116, 6, 31);
      ctx.fillStyle = "#75573e";
      ctx.fillRect(94, 145, 16, 4);

      // Fisher
      ctx.fillStyle = "#3c3830";
      ctx.fillRect(65, 92, 9, 12);
      ctx.fillStyle = "#d8ae89";
      ctx.fillRect(66, 84, 8, 8);
      ctx.fillStyle = "#44453d";
      ctx.fillRect(63, 102, 14, 8);
      ctx.fillStyle = "#32332d";
      ctx.fillRect(59, 108, 18, 5);
      ctx.fillStyle = "#3c3830";
      ctx.fillRect(72, 99, 14, 3);

      // Rod and line
      var rodTipX = 198;
      var rodTipY = 63;
      ctx.strokeStyle = "#4c3b2c";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(78, 102);
      ctx.quadraticCurveTo(143, 73, rodTipX, rodTipY);
      ctx.stroke();

      var phase = fishGame.phase;
      var bx = 242;
      var by = 154;
      if (phase === "casting") {
        var castT = Math.min(1, Math.max(0, (now - fishGame.phaseStart) / 650));
        var eased = easeOutCubic(castT);
        bx = 198 + (242 - 198) * eased;
        by = 63 + (154 - 63) * eased - Math.sin(castT * Math.PI) * 38;
      } else if (phase === "waiting" || phase === "bite" || phase === "caught") {
        bx = 242;
        by = 153 + Math.sin(now / 330) * 2;
        if (phase === "bite") by = 158 + Math.sin(now / 70) * 2;
      } else if (phase === "idle" || phase === "missed") {
        bx = 242;
        by = 154;
      }

      ctx.strokeStyle = "rgba(246,240,218,.55)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(rodTipX, rodTipY);
      ctx.lineTo(bx, by);
      ctx.stroke();

      if (phase !== "idle") {
        ctx.fillStyle = "#f0dfbe";
        ctx.fillRect(bx - 3, by - 3, 6, 7);
        ctx.fillStyle = "#b95443";
        ctx.fillRect(bx - 3, by - 7, 6, 4);
        ctx.fillStyle = "rgba(239,235,214,.7)";
        ctx.fillRect(bx - 1, by - 8, 2, 1);
      }

      // Ripples
      var rippleAlpha = phase === "waiting" ? 0.34 : (phase === "bite" ? 0.55 : 0.15);
      ctx.strokeStyle = "rgba(215,235,224," + rippleAlpha + ")";
      ctx.lineWidth = 1;
      [8, 15, 22].forEach(function (r, index) {
        ctx.beginPath();
        ctx.arc(bx, by + 5, r + Math.sin(now / 600 + index) * 2, 0, Math.PI * 2);
        ctx.stroke();
      });

      // Fish shadows
      ctx.fillStyle = "rgba(25,62,67,.2)";
      [[78, 196, 14], [152, 215, 11], [270, 190, 9], [208, 222, 17]].forEach(function (shadow) {
        ctx.fillRect(shadow[0], shadow[1], shadow[2], 3);
        ctx.fillRect(shadow[0] + 4, shadow[1] - 3, shadow[2] - 8, 3);
      });

      // Bite marker
      if (phase === "bite") {
        var pulse = Math.floor(now / 170) % 2;
        ctx.fillStyle = pulse ? "#f3e4b6" : "#f7f1df";
        ctx.fillRect(bx - 2, by - 35, 5, 13);
        ctx.fillRect(bx - 2, by - 18, 5, 5);
        ctx.fillStyle = "rgba(247,240,219,.22)";
        ctx.fillRect(bx - 8, by - 41, 17, 34);
      }

      // Caught fish jump
      if (phase === "caught" && fishGame.caught) {
        var jumpT = Math.min(1, (now - fishGame.phaseStart) / 900);
        var fy = 141 - Math.sin(jumpT * Math.PI) * 45;
        ctx.fillStyle = fishGame.caught.color;
        ctx.fillRect(bx - 11, fy, 19, 6);
        ctx.fillRect(bx - 7, fy - 4, 11, 4);
        ctx.fillRect(bx + 8, fy - 3, 6, 4);
        ctx.fillStyle = "#332c25";
        ctx.fillRect(bx + 1, fy + 1, 2, 2);
        ctx.fillStyle = "rgba(250,245,224,.6)";
        ctx.fillRect(bx - 16, fy - 5, 3, 3);
        ctx.fillRect(bx + 15, fy - 8, 2, 2);
      }
    }

    function loop(now) {
      var phase = fishGame.phase;
      if (phase === "casting" && now - fishGame.phaseStart > 650) {
        fishGame.phase = "waiting";
        fishGame.phaseStart = now;
        fishGame.biteAt = now + randomBetween(1200, 3400);
        setStatus("浮标安静地漂着，等一个信号。", "WAIT");
        updateControls();
      } else if (phase === "waiting" && now >= fishGame.biteAt) {
        fishGame.phase = "bite";
        fishGame.phaseStart = now;
        fishGame.biteUntil = now + 1750;
        setStatus("咬钩了！快收线！", "BITE!");
        updateControls();
      } else if (phase === "bite" && now > fishGame.biteUntil) {
        fishGame.phase = "missed";
        fishGame.phaseStart = now;
        fishGame.caught = null;
        setStatus("浮标沉下去了，又浮起来。鱼跑掉了。", "MISSED");
        updateControls();
      } else if ((phase === "caught" || phase === "missed") && now - fishGame.phaseStart > 1700) {
        fishGame.phase = "idle";
        fishGame.phaseStart = now;
        fishGame.caught = null;
        setStatus("海面很安静。", "READY");
        updateControls();
      }

      var meter = 0;
      if (fishGame.phase === "bite") {
        meter = Math.max(0, (fishGame.biteUntil - now) / 1750) * 100;
      } else if (fishGame.phase === "caught") {
        meter = 100;
      }
      if (meterEl) meterEl.style.width = meter.toFixed(1) + "%";

      drawScene(now);
      raf = window.requestAnimationFrame(loop);
    }

    function keyHandler(event) {
      if (event.code === "Space" || event.key === "Enter") {
        event.preventDefault();
        action();
      }
    }

    if (canvas) canvas.addEventListener("click", action);
    if (tip) {
      tip.addEventListener("click", function () {
        toast("看到「BITE!」出现时，立刻按收线。");
      });
    }

    state.fishAction = action;
    registerGame("fishing", keyHandler);
    addCleanup(function () {
      window.cancelAnimationFrame(raf);
      state.fishAction = null;
    });

    updateControls();
    setStatus("海面很安静。", "READY");
    raf = window.requestAnimationFrame(loop);
  }

  /* ---------- introduction deck ---------- */

  function initIntro() {
    if (!dom.introPages) return;

    if (dom.introPrev) {
      dom.introPrev.addEventListener("click", function () {
        setIntroPage(state.introPage - 1);
      });
    }
    if (dom.introNext) {
      dom.introNext.addEventListener("click", function () {
        setIntroPage(state.introPage + 1);
      });
    }
    if (dom.introNav) {
      dom.introNav.addEventListener("click", function (event) {
        var button = event.target.closest("[data-intro-page]");
        if (!button) return;
        setIntroPage(Number(button.dataset.introPage));
      });
    }
    var introApp = $("#app-intro");
    if (introApp) {
      introApp.addEventListener("click", function (event) {
        var jump = event.target.closest("[data-jump-page]");
        if (jump) {
          event.preventDefault();
          setIntroPage(Number(jump.dataset.jumpPage));
          return;
        }
        var next = event.target.closest("[data-intro-next]");
        if (next) {
          event.preventDefault();
          setIntroPage(state.introPage + 1);
        }
      });
    }

    if (dom.introIndexBtn) {
      dom.introIndexBtn.addEventListener("click", function () {
        if (!dom.introNav) return;
        var hidden = dom.introNav.classList.toggle("nav-hidden");
        dom.introIndexBtn.setAttribute("aria-expanded", hidden ? "false" : "true");
        toast(hidden ? "目录已收起，点右上角可以展开。" : "目录已展开。");
      });
    }

    var touchStart = null;
    if (dom.introPages) {
      dom.introPages.addEventListener("pointerdown", function (event) {
        if (event.pointerType === "mouse") return;
        touchStart = { x: event.clientX, y: event.clientY };
      });
      dom.introPages.addEventListener("pointerup", function (event) {
        if (!touchStart) return;
        var dx = event.clientX - touchStart.x;
        var dy = event.clientY - touchStart.y;
        touchStart = null;
        if (Math.abs(dx) > 52 && Math.abs(dx) > Math.abs(dy) * 1.45) {
          setIntroPage(state.introPage + (dx < 0 ? 1 : -1));
        }
      });
    }

    setIntroPage(0, true);
  }

  function setIntroPage(index, immediate) {
    if (!dom.introPages) return;
    var max = dom.introPages.querySelectorAll(".intro-page").length - 1;
    var next = Math.max(0, Math.min(max, Number(index) || 0));
    state.introPage = next;
    $$(".intro-page", dom.introPages).forEach(function (page, pageIndex) {
      var active = pageIndex === next;
      page.classList.toggle("active", active);
      if (active) page.scrollTop = 0;
    });
    if (dom.introProgressBar) {
      dom.introProgressBar.style.width = ((next + 1) / (max + 1) * 100).toFixed(2) + "%";
    }
    if (dom.introCounter) {
      dom.introCounter.textContent = pad2(next + 1) + " / " + pad2(max + 1);
    }
    if (dom.introNav) {
      var activeButton = $('[data-intro-page="' + next + '"]', dom.introNav);
      $$("[data-intro-page]", dom.introNav).forEach(function (button) {
        button.classList.toggle("active", Number(button.dataset.introPage) === next);
      });
      if (activeButton) {
        var target = activeButton.offsetLeft - dom.introNav.clientWidth / 2 + activeButton.offsetWidth / 2;
        dom.introNav.scrollTo({
          left: Math.max(0, target),
          behavior: immediate ? "auto" : "smooth"
        });
      }
    }
  }

  function syncIntro() {
    setIntroPage(state.introPage, true);
  }

  /* ---------- mailbox ---------- */

  function defaultMail() {
    return [
      {
        id: "welcome-letter",
        name: "齐瑛",
        content: "如果你读到这里，说明我们已经在同一座小岛上待了一会儿。\n\n信箱不需要漂亮的句子。你可以只写今天很累，也可以写一件不敢告诉别人的小事。",
        reply: "我收到了。愿你今晚睡个好觉。",
        createdAt: Date.now() - 86400000,
        visible: true,
        read: true
      }
    ];
  }

  function initMailbox() {
    var stored = readJSON(STORE_KEYS.mail, null);
    if (!Array.isArray(stored)) {
      mail = defaultMail();
      writeJSON(STORE_KEYS.mail, mail);
    } else {
      mail = stored.filter(function (item) {
        return item && typeof item === "object" && typeof item.content === "string";
      }).map(function (item) {
        return {
          id: String(item.id || "letter-" + Date.now() + "-" + Math.random().toString(16).slice(2)),
          name: String(item.name || "匿名"),
          content: String(item.content || ""),
          reply: String(item.reply || ""),
          createdAt: Number(item.createdAt) || Date.now(),
          visible: Boolean(item.visible),
          read: Boolean(item.read)
        };
      });
    }

    if (dom.mailContent && dom.mailCount) {
      dom.mailContent.addEventListener("input", function () {
        dom.mailCount.textContent = dom.mailContent.value.length + " / 1200";
      });
    }

    if (dom.mailForm) {
      dom.mailForm.addEventListener("submit", function (event) {
        event.preventDefault();
        submitLetter();
      });
    }

    if (dom.mailComposeShortcut) {
      dom.mailComposeShortcut.addEventListener("click", function () {
        if (!dom.mailForm) return;
        dom.mailForm.scrollIntoView({ behavior: "smooth", block: "start" });
        window.setTimeout(function () {
          if (dom.mailContent) dom.mailContent.focus();
        }, 420);
      });
    }

    renderMailFront();
    updateMailBadge();
    updateAdminMailCount();
  }

  function saveMail() {
    writeJSON(STORE_KEYS.mail, mail);
  }

  function submitLetter() {
    if (!dom.mailContent) return;
    var content = dom.mailContent.value.trim();
    var name = dom.mailName ? dom.mailName.value.trim() : "";
    if (!content) {
      toast("还没有写下内容。");
      if (dom.mailContent) dom.mailContent.focus();
      return;
    }
    if (content.length < 2) {
      toast("再多写一点点吧。");
      return;
    }

    mail.unshift({
      id: "letter-" + Date.now() + "-" + Math.random().toString(16).slice(2),
      name: name || "匿名",
      content: content.slice(0, 1200),
      reply: "",
      createdAt: Date.now(),
      visible: false,
      read: false
    });
    saveMail();
    if (dom.mailForm) dom.mailForm.reset();
    if (dom.mailCount) dom.mailCount.textContent = "0 / 1200";
    renderMailFront();
    updateMailBadge();
    updateAdminMailCount();
    toast("信已投递。只有管理员能看到它。");
  }

  function letterCardHTML(letter) {
    var name = letter.name && letter.name.trim() ? letter.name : "匿名";
    return (
      '<article class="letter-card">' +
        '<div class="letter-meta"><b>' + escapeHTML(name) + "</b><i></i><span>" + escapeHTML(relativeTime(letter.createdAt)) + "</span></div>" +
        '<p class="letter-body">' + escapeHTML(letter.content) + "</p>" +
        (letter.reply
          ? '<div class="letter-reply"><p>' + escapeHTML(letter.reply) + "</p></div>"
          : "") +
      "</article>"
    );
  }

  function renderMailFront() {
    if (!dom.publicLetters) return;
    var visible = mail.filter(function (letter) {
      return letter.visible && letter.content;
    }).sort(function (a, b) {
      return b.createdAt - a.createdAt;
    });

    if (dom.publicMailCount) dom.publicMailCount.textContent = String(visible.length);
    if (!visible.length) {
      dom.publicLetters.innerHTML = '<div class="public-empty">这里还很安静。<br>第一封被留下的回音，也许会在某天出现。</div>';
    } else {
      dom.publicLetters.innerHTML = visible.map(letterCardHTML).join("");
    }
    updateMailBadge();
  }

  /* ---------- administrator ---------- */

  function initAdmin() {
    isAdmin = readSession(STORE_KEYS.admin) === "1";
    document.body.classList.toggle("is-admin", isAdmin);

    if (dom.loginForm) {
      dom.loginForm.addEventListener("submit", function (event) {
        event.preventDefault();
        tryLogin();
      });
    }

    if (dom.loginModal) {
      dom.loginModal.addEventListener("click", function (event) {
        if (event.target === dom.loginModal) closeLogin();
      });
    }

    if (dom.adminBackHome) {
      dom.adminBackHome.addEventListener("click", closeApp);
    }

    if (dom.adminLogout) {
      dom.adminLogout.addEventListener("click", function () {
        isAdmin = false;
        removeSession(STORE_KEYS.admin);
        document.body.classList.remove("is-admin");
        closeApp();
        toast("已退出后台。");
      });
    }

    if (dom.adminTabs) {
      dom.adminTabs.addEventListener("click", function (event) {
        var tab = event.target.closest("[data-admin-tab]");
        if (!tab) return;
        switchAdminTab(tab.dataset.adminTab);
      });
    }

    if (dom.refreshMail) {
      dom.refreshMail.addEventListener("click", function () {
        renderAdminMail();
        toast("信箱已刷新。");
      });
    }

    if (dom.adminLetters) {
      dom.adminLetters.addEventListener("click", function (event) {
        var button = event.target.closest("[data-mail-action]");
        if (!button) return;
        handleAdminMailAction(button.dataset.mailAction, button.dataset.id);
      });
    }

    if (dom.exportData) dom.exportData.addEventListener("click", exportData);
    if (dom.importData) dom.importData.addEventListener("change", importData);
    if (dom.resetSite) {
      dom.resetSite.addEventListener("click", function () {
        askConfirm("恢复初始状态", "所有本机修改、信件与回复会被清除，且无法撤销。", "恢复").then(function (ok) {
          if (!ok) return;
          removeStored(STORE_KEYS.copy);
          removeStored(STORE_KEYS.mail);
          removeStored(STORE_KEYS.cat);
          window.location.reload();
        });
      });
    }

    if (dom.confirmOk) {
      dom.confirmOk.addEventListener("click", function () { closeConfirm(true); });
    }
    if (dom.confirmCancel) {
      dom.confirmCancel.addEventListener("click", function () { closeConfirm(false); });
    }
    if (dom.confirmModal) {
      dom.confirmModal.addEventListener("click", function (event) {
        if (event.target === dom.confirmModal) closeConfirm(false);
      });
    }

    updateAdminMailCount();
  }

  function openLogin() {
    if (isAdmin) {
      openApp("admin");
      return;
    }
    if (!dom.loginModal) return;
    if (dom.loginError) dom.loginError.textContent = "";
    if (dom.adminKeyInput) dom.adminKeyInput.value = "";
    state.loginOpen = true;
    dom.loginModal.classList.add("open");
    dom.loginModal.setAttribute("aria-hidden", "false");
    window.setTimeout(function () {
      if (dom.adminKeyInput) dom.adminKeyInput.focus();
    }, 100);
  }

  function closeLogin() {
    if (!dom.loginModal) return;
    state.loginOpen = false;
    dom.loginModal.classList.remove("open");
    dom.loginModal.setAttribute("aria-hidden", "true");
    if (dom.adminKeyInput) dom.adminKeyInput.value = "";
    if (dom.loginError) dom.loginError.textContent = "";
  }

  function tryLogin() {
    var value = dom.adminKeyInput ? dom.adminKeyInput.value.trim() : "";
    if (value !== ADMIN_KEY) {
      if (dom.loginError) dom.loginError.textContent = "密钥不正确，请再试一次。";
      if (dom.adminKeyInput) {
        dom.adminKeyInput.value = "";
        dom.adminKeyInput.focus();
      }
      return;
    }
    isAdmin = true;
    writeSession(STORE_KEYS.admin, "1");
    document.body.classList.add("is-admin");
    closeLogin();
    openApp("admin");
    toast("管理员身份已验证。");
  }

  function switchAdminTab(name) {
    $$("[data-admin-tab]").forEach(function (button) {
      button.classList.toggle("active", button.dataset.adminTab === name);
    });
    $$("[data-admin-pane]").forEach(function (pane) {
      pane.classList.toggle("active", pane.dataset.adminPane === name);
    });
    if (name === "mail") renderAdminMail();
    if (name === "content") buildQuickCopyFields();
  }

  function updateAdminMailCount() {
    if (!dom.adminMailCount) return;
    var unread = mail.filter(function (letter) { return !letter.read; }).length;
    dom.adminMailCount.textContent = String(unread);
    dom.adminMailCount.style.display = unread ? "inline-grid" : "none";
  }

  function mailStatus(letter) {
    if (letter.visible) return { label: "前台展示中", className: "visible" };
    if (letter.reply) return { label: "已回复 · 待展示", className: "" };
    return { label: "仅后台可见", className: "hidden" };
  }

  function renderAdminMail() {
    if (!dom.adminLetters) return;
    var sorted = mail.slice().sort(function (a, b) { return b.createdAt - a.createdAt; });
    if (!sorted.length) {
      dom.adminLetters.innerHTML = '<div class="admin-empty">还没有来信。<br>前台投递的信会出现在这里。</div>';
      updateAdminMailCount();
      return;
    }
    dom.adminLetters.innerHTML = sorted.map(function (letter) {
      var status = mailStatus(letter);
      return (
        '<article class="admin-letter" data-letter-id="' + escapeHTML(letter.id) + '">' +
          '<div class="admin-letter-head">' +
            "<b>" + escapeHTML(letter.name || "匿名") + "</b>" +
            "<span>" + escapeHTML(formatDate(letter.createdAt)) + "</span>" +
            (letter.read ? "" : '<span class="status-chip">新</span>') +
            '<span class="status-chip ' + status.className + '">' + status.label + "</span>" +
          "</div>" +
          '<p class="admin-letter-body">' + escapeHTML(letter.content) + "</p>" +
          '<textarea class="admin-letter-reply" data-reply-for="' + escapeHTML(letter.id) + '" placeholder="写一封回信……" maxlength="1200">' + escapeHTML(letter.reply) + "</textarea>" +
          '<div class="admin-letter-actions">' +
            '<button type="button" class="primary" data-mail-action="reply" data-id="' + escapeHTML(letter.id) + '">保存回复</button>' +
            '<button type="button" data-mail-action="show" data-id="' + escapeHTML(letter.id) + '">展示到前台</button>' +
            '<button type="button" data-mail-action="hide" data-id="' + escapeHTML(letter.id) + '">隐藏</button>' +
            '<button type="button" class="danger" data-mail-action="delete" data-id="' + escapeHTML(letter.id) + '">删除</button>' +
          "</div>" +
        "</article>"
      );
    }).join("");
    updateAdminMailCount();
  }

  function findMailById(id) {
    for (var i = 0; i < mail.length; i += 1) {
      if (mail[i].id === id) return mail[i];
    }
    return null;
  }

  function getReplyValue(id) {
    var escaped = window.CSS && CSS.escape ? CSS.escape(id) : id;
    var field = dom.adminLetters ? dom.adminLetters.querySelector('textarea[data-reply-for="' + escaped + '"]') : null;
    return field ? field.value.trim() : "";
  }

  function handleAdminMailAction(action, id) {
    var letter = findMailById(id);
    if (!letter) return;

    if (action === "reply") {
      var reply = getReplyValue(id);
      if (!reply) {
        toast("回信不能是空的。");
        return;
      }
      letter.reply = reply;
      letter.replyAt = Date.now();
      letter.read = true;
      saveMail();
      renderAdminMail();
      renderMailFront();
      updateMailBadge();
      toast("回信已保存。");
    } else if (action === "show") {
      if (!letter.reply) {
        toast("请先写一封回信，再展示到前台。");
        return;
      }
      letter.visible = true;
      letter.read = true;
      saveMail();
      renderAdminMail();
      renderMailFront();
      updateMailBadge();
      toast("这封回音已展示到前台。");
    } else if (action === "hide") {
      letter.visible = false;
      saveMail();
      renderAdminMail();
      renderMailFront();
      updateMailBadge();
      toast("已从前台隐藏。");
    } else if (action === "delete") {
      askConfirm("删除这封信", "删除后无法恢复，前台的回信也会一起消失。", "删除").then(function (ok) {
        if (!ok) return;
        mail = mail.filter(function (item) { return item.id !== id; });
        saveMail();
        renderAdminMail();
        renderMailFront();
        updateMailBadge();
        toast("信件已删除。");
      });
    }
  }

  function askConfirm(title, text, okLabel) {
    if (!dom.confirmModal) return Promise.resolve(window.confirm(text));
    if (state.confirmOpen) closeConfirm(false);
    state.confirmOpen = true;
    if (dom.confirmTitle) dom.confirmTitle.textContent = title;
    if (dom.confirmText) dom.confirmText.textContent = text;
    if (dom.confirmOk) dom.confirmOk.textContent = okLabel || "确认";
    dom.confirmModal.classList.add("open");
    dom.confirmModal.setAttribute("aria-hidden", "false");
    return new Promise(function (resolve) {
      state.confirmResolve = resolve;
    });
  }

  function closeConfirm(result) {
    if (!dom.confirmModal) return;
    state.confirmOpen = false;
    dom.confirmModal.classList.remove("open");
    dom.confirmModal.setAttribute("aria-hidden", "true");
    if (state.confirmResolve) {
      state.confirmResolve(Boolean(result));
      state.confirmResolve = null;
    }
  }

  function exportData() {
    var payload = {
      app: "qiyings-island",
      version: 1,
      exportedAt: new Date().toISOString(),
      copy: savedCopy,
      mail: mail
    };
    try {
      var blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      var url = URL.createObjectURL(blob);
      var anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "qiyings-island-backup-" + new Date().toISOString().slice(0, 10) + ".json";
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      window.setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      toast("备份已导出。");
    } catch (error) {
      toast("导出失败，请稍后再试。");
    }
  }

  function importData(event) {
    var file = event.target.files && event.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var parsed = JSON.parse(String(reader.result || "{}"));
        if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.mail)) {
          throw new Error("bad backup");
        }
        askConfirm("导入备份", "当前文字修改与信箱会被备份文件覆盖，确定继续吗？", "导入").then(function (ok) {
          if (!ok) return;
          savedCopy = parsed.copy && typeof parsed.copy === "object" && !Array.isArray(parsed.copy) ? parsed.copy : {};
          mail = parsed.mail.filter(function (item) {
            return item && typeof item === "object" && typeof item.content === "string";
          }).map(function (item) {
            return {
              id: String(item.id || "letter-" + Date.now() + "-" + Math.random().toString(16).slice(2)),
              name: String(item.name || "匿名"),
              content: String(item.content || ""),
              reply: String(item.reply || ""),
              createdAt: Number(item.createdAt) || Date.now(),
              visible: Boolean(item.visible),
              read: Boolean(item.read)
            };
          });
          writeCopyNow();
          saveMail();
          applyCopy();
          buildQuickCopyFields();
          renderMailFront();
          renderAdminMail();
          updateMailBadge();
          toast("备份已导入。");
        });
      } catch (error) {
        toast("这个备份文件无法识别。");
      } finally {
        event.target.value = "";
      }
    };
    reader.readAsText(file);
  }

  function cacheDom() {
    dom = {
      statusClock: $("#statusClock"),
      todayLabel: $("#todayLabel"),
      toast: $("#toast"),
      editDock: $("#editDock"),
      searchForm: $("#searchForm"),
      searchInput: $("#searchInput"),
      searchChips: $("#searchChips"),
      searchResult: $("#searchResult"),
      searchClear: $("#searchClear"),
      introPages: $("#introPages"),
      introNav: $("#introNav"),
      introProgressBar: $("#introProgressBar"),
      introCounter: $("#introCounter"),
      introPrev: $("#introPrev"),
      introNext: $("#introNext"),
      introIndexBtn: $("#introIndexBtn"),
      mailForm: $("#mailForm"),
      mailName: $("#mailName"),
      mailContent: $("#mailContent"),
      mailCount: $("#mailCount"),
      publicLetters: $("#publicLetters"),
      publicMailCount: $("#publicMailCount"),
      mailBadge: $("#mailBadge"),
      mailComposeShortcut: $("#mailComposeShortcut"),
      loginModal: $("#loginModal"),
      loginForm: $("#loginForm"),
      adminKeyInput: $("#adminKeyInput"),
      loginError: $("#loginError"),
      adminTabs: $(".admin-tabs"),
      adminLetters: $("#adminLetters"),
      adminMailCount: $("#adminMailCount"),
      adminBackHome: $("#adminBackHome"),
      adminLogout: $("#adminLogout"),
      refreshMail: $("#refreshMail"),
      exportData: $("#exportData"),
      importData: $("#importData"),
      resetSite: $("#resetSite"),
      confirmModal: $("#confirmModal"),
      confirmTitle: $("#confirmTitle"),
      confirmText: $("#confirmText"),
      confirmOk: $("#confirmOk"),
      confirmCancel: $("#confirmCancel"),
      musicWidget: $("#musicWidget"),
      musicTitle: $("#musicTitle"),
      musicArtist: $("#musicArtist"),
      musicCover: $("#musicCover"),
      musicCoverGlyph: $("#musicCoverGlyph"),
      musicPlay: $("#musicPlay"),
      musicPrev: $("#musicPrev"),
      musicNext: $("#musicNext"),
      musicQueue: $("#musicQueue"),
      musicQueueCount: $("#musicQueueCount"),
      musicSeek: $("#musicSeek"),
      musicCurrent: $("#musicCurrent"),
      musicDuration: $("#musicDuration"),
      musicEq: $("#musicEq"),
      playerSheet: $("#playerSheet"),
      playerCover: $("#playerCover"),
      playerCoverGlyph: $("#playerCoverGlyph"),
      playerTitle: $("#playerTitle"),
      playerArtist: $("#playerArtist"),
      playerPlay: $("#playerPlay"),
      playerPrev: $("#playerPrev"),
      playerNext: $("#playerNext"),
      playerSeek: $("#playerSeek"),
      playerCurrent: $("#playerCurrent"),
      playerDuration: $("#playerDuration"),
      playlist: $("#playlist"),
      playlistMeta: $("#playlistMeta")
    };
  }

  function bindGlobalKeys() {
    document.addEventListener("keydown", function (event) {
      var target = document.activeElement;
      var tag = target ? target.tagName : "";
      var typing = tag === "INPUT" || tag === "TEXTAREA" || (target && target.isContentEditable);

      if (event.key === "Escape") {
        if (dom.playerSheet && dom.playerSheet.classList.contains("open")) {
          closePlayerSheet();
          return;
        }
        if (state.confirmOpen) {
          closeConfirm(false);
          return;
        }
        if (state.loginOpen) {
          closeLogin();
          return;
        }
        if (state.editing) {
          if (target && target.isContentEditable) target.blur();
          else setEditing(false);
          return;
        }
        if (state.app) {
          closeApp();
          return;
        }
      }

      if (typing) return;
      if (dom.playerSheet && dom.playerSheet.classList.contains("open") && event.code === "Space") {
        event.preventDefault();
        togglePlay();
        return;
      }
      if (state.keyHandler) {
        state.keyHandler(event);
        if (event.defaultPrevented) return;
      }
      if (!state.app && event.code === "Space") {
        event.preventDefault();
        togglePlay();
        return;
      }
      if (state.app === "intro" && !typing) {
        if (event.key === "ArrowRight") {
          event.preventDefault();
          setIntroPage(state.introPage + 1);
        } else if (event.key === "ArrowLeft") {
          event.preventDefault();
          setIntroPage(state.introPage - 1);
        }
      }
    });
  }

  function boot() {
    cacheDom();
    initCopySystem();
    bindNavigation();
    initSearch();
    initIntro();
    initMailbox();
    initAdmin();
    initMusic();
    bindGlobalKeys();
    resetSearchView();
    tickClock();
    clockTimer = window.setInterval(tickClock, 15000);
    updateMailBadge();
    updateAdminMailCount();

    if (isAdmin) {
      document.body.classList.add("is-admin");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

})();
