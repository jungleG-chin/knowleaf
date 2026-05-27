// KnowLeaf 知叶 — 我的面板 + 反馈

  /* ===== 我的板块 UI ===== */
  var myApiKeyEl      = document.getElementById('myApiKey');
  var myPlatformEl    = document.getElementById('myPlatform');
  var myApiUrlEl      = document.getElementById('myApiUrl');
  var myModelEl       = document.getElementById('myModel');
  var myTestResultEl  = document.getElementById('myTestResult');
  var myDailyLimitEl  = document.getElementById('myDailyLimit');
  var myAutoArchiveEl = document.getElementById('myAutoArchive');
  var backupReminderEl = document.getElementById('backupReminder');

  function loadMyPanel() {
    myApiKeyEl.value = getApiKey() || '';
    var currentUrl = getApiUrl();
    myApiUrlEl.value = currentUrl;
    var platform = getPlatformByUrl(currentUrl);
    myPlatformEl.value = platform;
    toggleMyCustom();
    var savedModel = getModel();
    myModelEl = renderModelSelect(platform, myModelEl, savedModel);
    var cfg = getReviewConfig();
    var daily = cfg.dailyLimit;
    myDailyLimitEl.value = (daily && daily >= 1) ? daily : 20;
    myAutoArchiveEl.checked = cfg.autoArchive !== false;
    updateAutoArchiveSlider();
    updateMyStats();
    checkBackupReminder();
  }

  function updateMyStats() {
    var data = loadData();
    var stats = getReviewStats(data);
    document.getElementById('myStatRecords').textContent = stats.total + ' 条';
    document.getElementById('myStatSubjects').textContent = countSubjects(data) + ' 个';
    document.getElementById('myStatTopics').textContent = countTopics(data) + ' 个';
    document.getElementById('myStatMastered').textContent = stats.mastered + ' 个';
    var streak = parseInt(localStorage.getItem('knowleaf_review_streak') || '0', 10);
    document.getElementById('myStatStreak').textContent = streak + ' 天';
  }

  function toggleMyCustom() {
    var isCustom = myPlatformEl.value === 'custom';
    myApiUrlEl.readOnly = !isCustom;
    if (!isCustom) {
      var preset = PLATFORM_PRESETS[myPlatformEl.value];
      if (preset) myApiUrlEl.value = preset.url;
    }
    var savedModel = getModel();
    myModelEl = renderModelSelect(myPlatformEl.value, myModelEl, savedModel);
  }

  function updateAutoArchiveSlider() {
    var slider = document.getElementById('myAutoArchiveSlider');
    var knob = document.getElementById('myAutoArchiveKnob');
    if (myAutoArchiveEl.checked) {
      slider.style.background = 'var(--green-500)';
      knob.style.left = '23px';
    } else {
      slider.style.background = '#d1d5db';
      knob.style.left = '3px';
    }
  }

  function checkBackupReminder() {
    var lastBackup = localStorage.getItem('knowleaf_last_backup') || '';
    if (!lastBackup) { backupReminderEl.style.display = 'flex'; return; }
    var days = Math.floor((Date.now() - new Date(lastBackup).getTime()) / 86400000);
    backupReminderEl.style.display = days >= 7 ? 'flex' : 'none';
  }

  function markBackupDone() {
    localStorage.setItem('knowleaf_last_backup', new Date().toISOString());
    checkBackupReminder();
  }

  myPlatformEl.addEventListener('change', toggleMyCustom);
  myAutoArchiveEl.addEventListener('change', updateAutoArchiveSlider);

  document.getElementById('btnMySaveKey').addEventListener('click', function () {
    var key = myApiKeyEl.value.trim();
    if (!key) { showToast('请输入 API Key', 'error'); return; }
    saveApiKey(key);
    saveApiUrl(myApiUrlEl.value.trim());
    var mv = myModelEl.tagName === 'SELECT' ? myModelEl.value : myModelEl.value;
    saveModel(mv.trim());
    showToast('配置已保存', 'success');
  });

  document.getElementById('btnMyTestConn').addEventListener('click', async function () {
    myTestResultEl.textContent = '⏳ 测试中...';
    myTestResultEl.style.color = '#94a3b8';
    try {
      var result = await callDeepSeek('测试连接', null);
      if (result) {
        myTestResultEl.textContent = '✅ 连接成功';
        myTestResultEl.style.color = '#16a34a';
      }
    } catch (err) {
      myTestResultEl.textContent = '❌ ' + err.message;
      myTestResultEl.style.color = '#dc2626';
    }
  });

  document.getElementById('btnMySaveReview').addEventListener('click', function () {
    var raw = myDailyLimitEl.value;
    var num = parseInt(raw, 10);
    if (!raw || isNaN(num) || num < 1) { myDailyLimitEl.value = 20; num = 20; }
    if (num > 100) { myDailyLimitEl.value = 100; num = 100; }
    var cfg = getReviewConfig();
    cfg.dailyLimit = num;
    cfg.autoArchive = myAutoArchiveEl.checked;
    saveReviewConfig(cfg);
    myDailyLimitEl.style.transition = 'background .3s';
    myDailyLimitEl.style.background = '#dcfce7';
    setTimeout(function () { myDailyLimitEl.style.background = '#fff'; }, 800);
    showToast('复习设置已保存（每日' + num + '题）', 'success');
  });

  // 失焦时自动保存（增强持久化安全）
  myDailyLimitEl.addEventListener('blur', function () {
    var raw = myDailyLimitEl.value;
    var num = parseInt(raw, 10);
    if (!raw || isNaN(num) || num < 1) {
      myDailyLimitEl.value = getReviewConfig().dailyLimit || 20;
      return;
    }
    if (num > 100) {
      myDailyLimitEl.value = 100;
      num = 100;
    }
    var cfg = getReviewConfig();
    cfg.dailyLimit = num;
    cfg.autoArchive = myAutoArchiveEl.checked;
    try {
      saveReviewConfig(cfg);
    } catch (e) {}
  });

  document.getElementById('btnMyExport').addEventListener('click', function () {
    markBackupDone();
    exportData();
  });

  document.getElementById('btnMyImport').addEventListener('click', function () { importFileInput.click(); });

  document.getElementById('btnMyClearAll').addEventListener('click', function () {
    if (!confirm('⚠️ 高风险操作：确定要清空全部知识数据吗？')) return;
    if (!confirm('此操作不可恢复！所有知识点和复习记录将被永久删除。再次确认清空？')) return;
    clearAllData();
    updateMyStats();
  });

  document.getElementById('btnReminderExport').addEventListener('click', function () {
    markBackupDone();
    exportData();
  });

  var myTab = document.querySelector('[data-panel="myPanel"]');
  myTab.addEventListener('click', function () { loadMyPanel(); });

  // 头部的设置按钮跳转到我的板块
  btnSettings.addEventListener('click', function () {
    navTabs.forEach(function (t) { t.classList.remove('active'); });
    panels.forEach(function (p) { p.classList.remove('active'); });
    document.querySelector('[data-panel="myPanel"]').classList.add('active');
    document.getElementById('myPanel').classList.add('active');
    loadMyPanel();
  });

  /* ===== 用户反馈 ===== */
  var FEEDBACK_KEY = 'knowleaf_feedbacks';
  var FORMSPREE_URL = 'https://formspree.io/f/mpqnyobk';
  function getFeedbacks() {
    try { return JSON.parse(localStorage.getItem(FEEDBACK_KEY) || '[]'); } catch(e) { return []; }
  }
  function saveFeedbacks(list) { localStorage.setItem(FEEDBACK_KEY, JSON.stringify(list)); }

  function sendFeedbackEmail(type, text, contact) {
    var typeLabel = { bug: 'Bug反馈', feat: '功能建议', ux: '使用体验', other: '其他' }[type] || type;
    var formData = new URLSearchParams();
    formData.append('_subject', '[' + typeLabel + '] KnowLeaf 反馈');
    formData.append('message',
      '反馈类型：' + typeLabel + '\n' +
      '────────────────\n' +
      text + '\n' +
      '────────────────\n' +
      '联系方式：' + (contact || '未填写') + '\n' +
      '时间：' + new Date().toLocaleString('zh-CN')
    );
    if (contact) formData.append('_replyto', contact);
    return fetch(FORMSPREE_URL, {
      method: 'POST',
      headers: { 'Accept': 'application/json' },
      body: formData
    });
  }

  document.getElementById('btnOpenFeedback').addEventListener('click', function () {
    document.getElementById('feedbackText').value = '';
    document.getElementById('feedbackContact').value = '';
    document.getElementById('feedbackOverlay').style.display = 'flex';
  });
  document.getElementById('btnCancelFeedback').addEventListener('click', function () {
    document.getElementById('feedbackOverlay').style.display = 'none';
  });
  document.getElementById('feedbackOverlay').addEventListener('click', function (e) {
    if (e.target === this) this.style.display = 'none';
  });

  document.getElementById('btnSubmitFeedback').addEventListener('click', function () {
    var type = document.getElementById('feedbackType').value;
    var text = document.getElementById('feedbackText').value.trim();
    var contact = document.getElementById('feedbackContact').value.trim();
    if (!text) { showToast('请输入反馈内容', 'error'); return; }

    var btn = this;
    btn.disabled = true;
    btn.textContent = '提交中...';

    // 本地保存 + 发邮件
    var list = getFeedbacks();
    list.push({ type: type, text: text, contact: contact, time: new Date().toISOString() });
    saveFeedbacks(list);

    sendFeedbackEmail(type, text, contact).then(function () {
      document.getElementById('feedbackText').value = '';
      document.getElementById('feedbackContact').value = '';
      document.getElementById('feedbackOverlay').style.display = 'none';
      updateFeedbackLink();
      showToast('感谢反馈！已发送到我邮箱 📬', 'success');
    }).catch(function () {
      document.getElementById('feedbackOverlay').style.display = 'none';
      updateFeedbackLink();
      showToast('反馈已保存，网络恢复后会自动发送 📤');
    }).finally(function () {
      btn.disabled = false;
      btn.textContent = '提交';
    });
  });

  function updateFeedbackLink() {
    var list = getFeedbacks();
    document.getElementById('btnViewFeedbacks').textContent = '📋 查看反馈（共 ' + list.length + ' 条）';
  }

  document.getElementById('btnViewFeedbacks').addEventListener('click', function () {
    var list = getFeedbacks();
    var typeMap = { bug: ['🐛 Bug', '#ef4444'], feat: ['💡 建议', '#22c55e'], ux: ['🔵 体验', '#3b82f6'], other: ['⚪ 其他', '#94a3b8'] };
    var html = '';
    if (list.length === 0) {
      html = '<div style="text-align:center;padding:24px;color:#94a3b8;">暂无反馈</div>';
    } else {
      for (var i = list.length - 1; i >= 0; i--) {
        var f = list[i];
        var t = typeMap[f.type] || typeMap.other;
        html += '<div style="padding:12px;margin-bottom:8px;background:var(--green-50);border-radius:8px;border-left:3px solid ' + t[1] + ';">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">';
        html += '<span style="font-size:11px;color:#fff;background:' + t[1] + ';padding:2px 8px;border-radius:4px;font-weight:500;">' + t[0] + '</span>';
        html += '<span style="font-size:11px;color:#94a3b8;">' + new Date(f.time).toLocaleString('zh-CN') + '</span>';
        html += '</div>';
        html += '<div style="font-size:14px;color:#334155;line-height:1.6;margin:6px 0;">' + escHtml(f.text) + '</div>';
        if (f.contact) html += '<div style="font-size:12px;color:var(--green-600);">📧 ' + escHtml(f.contact) + '</div>';
        html += '</div>';
      }
    }
    document.getElementById('feedbackListContent').innerHTML = html;
    document.getElementById('feedbackListOverlay').style.display = 'flex';
  });

  document.getElementById('btnCloseFeedbackList').addEventListener('click', function () {
    document.getElementById('feedbackListOverlay').style.display = 'none';
  });
  document.getElementById('feedbackListOverlay').addEventListener('click', function (e) {
    if (e.target === this) this.style.display = 'none';
  });

  document.getElementById('btnCopyFeedbacks').addEventListener('click', function () {
    var list = getFeedbacks();
    var text = list.map(function (f) {
      return '[' + f.type + '] ' + f.text + (f.contact ? ' (联系: ' + f.contact + ')' : '') + ' - ' + f.time;
    }).join('\n');
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(function () { showToast('已复制', 'success'); });
    }
  });

