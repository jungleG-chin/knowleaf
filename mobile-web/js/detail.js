// KnowLeaf 知叶 — 知识详情页

  /* ===== 知识详情页 ===== */
  var detailNavItems = [];
  var detailNavIndex = -1;

  function buildDetailNav(subject) {
    var data = loadData();
    detailNavItems = [];
    if (!data[subject]) return;
    Object.keys(data[subject]).forEach(function (t) {
      var items = data[subject][t].items || [];
      items.forEach(function (r, i) {
        detailNavItems.push({ subject: subject, topic: t, idx: i });
      });
    });
  }

  function getRelatedForDetail(subject, excludeTopic) {
    var data = loadData();
    if (!data[subject]) return [];
    var result = [];
    Object.keys(data[subject]).forEach(function (t) {
      if (t === excludeTopic) return;
      (data[subject][t].items || []).forEach(function (r, i) {
        result.push({ rec: r, topic: t, idx: i, lastReview: r.lastReview || 0 });
      });
    });
    result.sort(function (a, b) { return (a.lastReview || 0) - (b.lastReview || 0); });
    return result.slice(0, 5);
  }

  function renderDetailPage(rec, subject, topic, idx) {
    var body = document.getElementById('detailBody');
    var breadcrumb = document.getElementById('detailBreadcrumb');
    breadcrumb.textContent = subject + ' › ' + topic;

    var summary = rec.summary || '', text = rec.text || '';
    var displayTitle = (summary || text || topic);
    if (displayTitle.length > 50) displayTitle = displayTitle.substring(0, 50) + '...';
    var html = '<h2>' + escHtml(displayTitle) + '</h2>';
    html += '<div class="detail-meta">' + escHtml(rec.time || '') + ' · ' + escHtml(subject) + '</div>';

    // 图片
    if (rec.imageId) {
      html += '<img class="detail-image" id="detailImage" src="" style="display:none;" onload="this.style.display=\'block\'">';
      setTimeout(function () {
        var el = document.getElementById('detailImage');
        if (el && rec.imageId) {
          IMG_DB.get(rec.imageId).then(function (b) { if (b) { el.src = b; el.style.display = 'block'; } }).catch(function () {});
        }
      }, 50);
    } else if (rec.image) {
      html += '<img class="detail-image" src="' + escHtml(rec.image) + '" onerror="this.style.display=\'none\'">';
    }

    // AI 分析
    if (rec.analysis) {
      html += '<div class="analysis-block"><div class="detail-section"><h4>🤖 AI 深度分析</h4>';
      html += '<div style="font-size:14px;line-height:1.8;">' + (typeof rec.analysis === 'string' ? rec.analysis.replace(/\n/g, '<br>') : '') + '</div></div></div>';
    }

    // 原始内容
    if (text && text !== summary) {
      html += '<div class="detail-section"><h4>📄 原始内容</h4><p>' + escHtml(text).replace(/\n/g, '<br>') + '</p></div>';
    }

    // AI 摘要
    if (summary && summary !== displayTitle) {
      html += '<div class="detail-section"><h4>📝 AI 摘要</h4><p>' + escHtml(summary) + '</p></div>';
    }

    // 关联知识
    html += '<div class="detail-section"><h4>🔗 关联知识</h4>';
    var related = getRelatedForDetail(subject, topic);
    if (related.length === 0) {
      html += '<div style="padding:16px 0;text-align:center;color:#94a3b8;font-size:14px;">暂无关联知识</div>';
    } else {
      html += '<ul class="related-list">';
      related.forEach(function (r) {
        var s = r.rec.summary || r.rec.text || r.topic;
        if (s.length > 30) s = s.substring(0, 30) + '...';
        html += '<li class="related-link-item" data-subject="' + escHtml(subject) + '" data-topic="' + escHtml(r.topic) + '" data-idx="' + r.idx + '" style="cursor:pointer;">';
        html += '<span>' + escHtml(s) + '</span>';
        html += '<span style="font-size:11px;color:var(--green-600);background:rgba(255,255,255,.7);padding:2px 8px;border-radius:4px;">' + escHtml(r.topic) + '</span>';
        html += '</li>';
      });
      html += '</ul>';
    }
    html += '</div>';

    body.innerHTML = html;
    updateDetailNav();
  }

  function updateDetailNav() {
    var p = document.getElementById('detailPrev'), n = document.getElementById('detailNext'), pos = document.getElementById('detailPos');
    if (detailNavItems.length <= 1) { p.disabled = true; n.disabled = true; pos.textContent = ''; return; }
    p.disabled = (detailNavIndex <= 0); n.disabled = (detailNavIndex >= detailNavItems.length - 1);
    pos.textContent = (detailNavIndex + 1) + ' / ' + detailNavItems.length;
  }

  function openDetailPage(subject, topic, idx) {
    var data = loadData();
    if (!data[subject] || !data[subject][topic]) return;
    var items = data[subject][topic].items;
    var rec = items[idx];
    if (!rec) return;
    buildDetailNav(subject);
    detailNavIndex = -1;
    for (var i = 0; i < detailNavItems.length; i++) {
      if (detailNavItems[i].topic === topic && detailNavItems[i].idx === idx) {
        detailNavIndex = i; break;
      }
    }
    renderDetailPage(rec, subject, topic, idx);
    document.getElementById('detailOverlay').style.display = 'flex';
  }
  function closeDetailPage() {
    document.getElementById('detailOverlay').style.display = 'none';
  }
