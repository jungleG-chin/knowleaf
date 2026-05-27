// KnowLeaf 知叶 — 复习系统
// 包含：复习会话、复习列表渲染、答案展示、复习结果处理

  function loadReviewSession() {
    var data = loadData();
    var allDue = getDueReviews(data);
    var limit = getDailyLimit();

    var state = getTodayReviewState();

    // ★ 始终使用最新的每日上限设置
    state.total = limit;
    saveTodayReviewState(state);

    reviewSession.done = state.done || 0;
    reviewSession.totalTarget = state.total;
    reviewSession.streak = loadDailyStreak();
    reviewSession.currentEntry = null;
    reviewSession.currentIndex = -1;

    // 过滤掉今天已经"记得"的条目
    var remainingDue = allDue.filter(function(entry) {
      var id = entry.subject + '|' + entry.topic + '|' + entry.index;
      return (state.doneIds || []).indexOf(id) === -1;
    });

    // 收集今天"忘记"的条目
    var forgotEntries = allDue.filter(function(entry) {
      var id = entry.subject + '|' + entry.topic + '|' + entry.index;
      return (state.forgotIds || []).indexOf(id) !== -1;
    });

    // 打乱未完成的
    for (var i = remainingDue.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = remainingDue[i]; remainingDue[i] = remainingDue[j]; remainingDue[j] = tmp;
    }

    reviewSession.queue = remainingDue.concat(forgotEntries);
    reviewSession.todayDoneIds = state.doneIds || [];
    reviewSession.todayForgotIds = state.forgotIds || [];
  }

  function renderReviewList() {
    updateReviewStats();
    if (reviewSession.queue.length === 0) {
      reviewWikiList.innerHTML = '';
      reviewEmpty.style.display = 'none';
      reviewComplete.style.display = 'flex';
      reviewProgressFill.style.width = '100%';
      if (reviewSession.done < getDailyLimit()) {
        reviewCompleteStats.textContent = '今日复习 ' + reviewSession.done + ' / ' + getDailyLimit() + '（待复习条目不足）';
      } else {
        reviewCompleteStats.textContent = '今日复习 ' + getDailyLimit() + ' 条，完成 ' + reviewSession.done + ' / ' + getDailyLimit();
      }
      saveDailyStreak(reviewSession.streak + 1);
      reviewSession.streak = reviewSession.streak + 1;
      return;
    }
    reviewEmpty.style.display = 'none';
    reviewComplete.style.display = 'none';
    reviewProgressFill.style.width = ((reviewSession.done / Math.max(1, getDailyLimit())) * 100) + '%';

    var html = '';
    for (var i = 0; i < reviewSession.queue.length; i++) {
      var entry = reviewSession.queue[i];
      var rec = entry.item;
      var summary = rec.summary || rec.text || entry.topic;
      var excerpt = summary.length > 60 ? summary.substring(0, 60) + '...' : summary;
      var isForgot = (reviewSession.todayForgotIds || []).indexOf(entry.subject + '|' + entry.topic + '|' + entry.index) !== -1;

      html += '<div class="review-wiki-card" data-review-index="' + i + '" style="' + (isForgot ? 'border-left:3px solid #f59e0b;' : '') + '">';
      html += '<span class="wiki-subject-tag" style="background:' + getSubjectColor(entry.subject) + ';">' + escHtml(entry.subject) + '</span>';
      html += '<div class="wiki-title">' + escHtml(entry.topic) + '</div>';
      html += '<div class="wiki-excerpt">' + escHtml(excerpt) + '</div>';
      html += '<div class="wiki-meta">';
      if (isForgot) {
        html += '<span style="color:#f59e0b;">🔁 需重记</span><span class="meta-dot">·</span>';
      }
      html += '<span>' + (rec.reviewCount || 0) + ' 次复习</span>';
      html += '<span class="meta-dot">·</span>';
      html += '<span>' + getReviewStatusText(rec.status) + '</span>';
      html += '</div>';
      html += '</div>';
    }
    reviewWikiList.innerHTML = html;
  }

  function getReviewStatusText(status) {
    var map = { learning: '学习中', reviewing: '复习中', mastered: '已掌握' };
    return map[status] || '学习中';
  }

  function openWikiAnswer(index) {
    var entry = reviewSession.queue[index];
    reviewSession.currentEntry = entry;
    reviewSession.currentIndex = index;
    wikiAnswerTitle.textContent = entry.topic;
    wikiAnswerSubtitle.textContent = entry.subject;
    var ans = entry.item.summary || '';
    if (entry.item.text && entry.item.text !== entry.item.summary) {
      ans += '\n\n' + entry.item.text;
    }
    wikiAnswerContent.textContent = ans;
    wikiAnswerOverlay.style.display = 'flex';
  }
  function closeWikiAnswer() {
    wikiAnswerOverlay.style.display = 'none';
    reviewSession.currentEntry = null;
  }

  function answerReview(correct) {
    if (!reviewSession.currentEntry) return;
    var entry = reviewSession.currentEntry;
    var idx = reviewSession.currentIndex;
    var entryId = entry.subject + '|' + entry.topic + '|' + entry.index;
    var state = getTodayReviewState();

    if (correct) {
      // ✅ 记得 → 标记完成 + 从队列删除
      if ((state.doneIds || []).indexOf(entryId) === -1) {
        state.doneIds.push(entryId);
      }
      reviewSession.done++;
      state.done = reviewSession.done; // ★ 同步到 state
      applyReviewResult(entry.subject, entry.topic, entry.index, true);
      reviewSession.queue.splice(idx, 1);
    } else {
      // ❌ 忘记 → 保留在队列，标记为忘记过
      if ((state.forgotIds || []).indexOf(entryId) === -1) {
        state.forgotIds.push(entryId);
      }
      applyReviewResult(entry.subject, entry.topic, entry.index, false);
    }
    saveTodayReviewState(state);
    reviewSession.todayDoneIds = state.doneIds;
    reviewSession.todayForgotIds = state.forgotIds;

    closeWikiAnswer();
    renderReviewList();

    if (reviewSession.done >= getDailyLimit()) {
      showReviewComplete();
    }
  }

  function showReviewComplete() {
    reviewWikiList.innerHTML = '';
    reviewProgressFill.style.width = '100%';
    reviewComplete.style.display = 'flex';
    reviewCompleteStats.textContent = '今日复习 ' + getDailyLimit() + ' 条，完成 ' + reviewSession.done + ' / ' + getDailyLimit();
    saveDailyStreak(reviewSession.streak + 1);
    reviewSession.streak = reviewSession.streak + 1;
    updateReviewStats();
  }

  function updateReviewStats() {
    var data = loadData();
    var stats = getReviewStats(data);
    var T = getDailyLimit(); // 始终从配置读取，不用缓存值
    var dueNum = Math.max(0, T - reviewSession.done);
    reviewDueCount.textContent = dueNum + ' / ' + T;
    reviewDoneToday.textContent = reviewSession.done + ' / ' + T;
  }
