// KnowLeaf 知叶 — 知识浏览 + 思维导图
// 包含：知识树渲染、筛选、搜索、Markdown导图、TF-IDF关联、详情弹窗、智能合并

  function getSubjectColor(name) {
    var colors = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];
    var hash = 0;
    for (var i = 0; i < name.length; i++) {
      hash = ((hash << 5) - hash) + name.charCodeAt(i);
    }
    return colors[Math.abs(hash) % colors.length];
  }
  window.getSubjectColor = getSubjectColor;

  /* 知识关联推荐 */
  function getRelatedRecommendations(currentSubj, currentTopic) {
    var data = loadData();
    var recommendations = [];
    if (!data[currentSubj]) return recommendations;
    Object.keys(data[currentSubj]).forEach(function (t) {
      if (t === currentTopic) return;
      var items = data[currentSubj][t].items || [];
      items.forEach(function (rec, idx) {
        var lastReview = rec.lastReview ? new Date(rec.lastReview) : null;
        var now = new Date();
        var daysSince = lastReview ? (now - lastReview) / (1000 * 60 * 60 * 24) : 999;
        if (daysSince > 3) {
          recommendations.push({ subj: currentSubj, topic: t, rec: rec, idx: idx, daysSince: daysSince });
        }
      });
    });
    recommendations.sort(function (a, b) { return b.daysSince - a.daysSince; });
    return recommendations.slice(0, 3);
  }

  /* 搜索 */
  var currentFilter = '';
  var currentSubjectFilter = '';
  var highlightRecord = null;

  /* P2b 筛选状态 */
  var filterNodeTypes = [];     // 选中的 nodeType 列表
  var filterTags = [];          // 选中的标签列表
  var filterMinImportance = 0;  // 最低重要性（0=不限）

  function getSearchKeywords() {
    if (!currentFilter) return [];
    var q = currentFilter.toLowerCase();
    var keywords = q.split(/[\s，、；：。（）【】,.!?;:\\"'，。、；：""''（）【】《》]+/).filter(Boolean);
    if (keywords.length === 0) keywords = [q];
    return keywords;
  }

  function matchesFilter(subj, topic, rec) {
    if (currentSubjectFilter && subj !== currentSubjectFilter) return false;

    // 文字搜索
    if (currentFilter) {
      var keywords = getSearchKeywords();
      if (keywords.length > 0) {
        var haystack = (subj + ' ' + topic + ' ' + (rec.summary||'') + ' ' + (rec.text||'')).toLowerCase();
        var textMatch = keywords.some(function(kw) {
          return haystack.indexOf(kw) !== -1;
        });
        if (!textMatch) return false;
      }
    }

    // P2b: nodeType 筛选（多选 OR）
    if (filterNodeTypes.length > 0) {
      var recType = rec.nodeType || 'concept';
      if (filterNodeTypes.indexOf(recType) === -1) return false;
    }

    // P2b: tags 筛选（多选 AND）
    if (filterTags.length > 0) {
      var recTags = Array.isArray(rec.tags) ? rec.tags : [];
      var allMatch = filterTags.every(function (ft) {
        return recTags.indexOf(ft) >= 0;
      });
      if (!allMatch) return false;
    }

    // P2b: importance 筛选（>= min）
    if (filterMinImportance > 0) {
      var imp = (typeof rec.importance === 'number') ? rec.importance : 3;
      if (imp < filterMinImportance) return false;
    }

    return true;
  }

  // 从已有数据中收集所有标签
  function collectAllTags() {
    var data = loadData();
    var tagSet = {};
    Object.keys(data).forEach(function (s) {
      Object.keys(data[s]).forEach(function (t) {
        var items = data[s][t].items || [];
        items.forEach(function (r) {
          if (Array.isArray(r.tags)) {
            r.tags.forEach(function (tag) { tagSet[tag] = true; });
          }
        });
      });
    });
    return Object.keys(tagSet).sort();
  }

  // 渲染标签筛选芯片
  function renderFilterTags() {
    var container = document.getElementById('filterTags');
    if (!container) return;
    var allTags = collectAllTags();
    if (allTags.length === 0) {
      container.innerHTML = '<span style="font-size:11px;color:#94a3b8;">暂无标签</span>';
      return;
    }
    var html = '';
    allTags.forEach(function (tag) {
      var active = filterTags.indexOf(tag) >= 0;
      html += '<span class="filter-chip-tag' + (active ? ' active' : '') + '" data-tag="' + escHtml(tag) + '" data-active="' + active + '">' + escHtml(tag) + '</span>';
    });
    container.innerHTML = html;
  }

  // 检查是否有任何筛选条件
  function hasAnyFilter() {
    return filterNodeTypes.length > 0 || filterTags.length > 0 || filterMinImportance > 0;
  }

  // 更新筛选 UI 状态
  function updateFilterUI() {
    var panel = document.getElementById('filterPanel');
    if (!panel) return;

    // 显示/隐藏面板：始终显示面板以便操作
    panel.style.display = 'block';

    // 更新 nodeType 芯片状态
    var typeChips = document.querySelectorAll('.filter-chip-type');
    typeChips.forEach(function (chip) {
      var type = chip.getAttribute('data-type');
      if (filterNodeTypes.indexOf(type) >= 0) {
        chip.classList.add('active');
        chip.setAttribute('data-active', 'true');
      } else {
        chip.classList.remove('active');
        chip.setAttribute('data-active', 'false');
      }
    });

    // 更新标签芯片状态
    var tagChips = document.querySelectorAll('.filter-chip-tag');
    tagChips.forEach(function (chip) {
      var tag = chip.getAttribute('data-tag');
      if (filterTags.indexOf(tag) >= 0) {
        chip.classList.add('active');
        chip.setAttribute('data-active', 'true');
      } else {
        chip.classList.remove('active');
        chip.setAttribute('data-active', 'false');
      }
    });

    // 清除按钮
    var btnClear = document.getElementById('btnClearFilter');
    if (btnClear) btnClear.style.display = hasAnyFilter() ? 'inline-block' : 'none';

    // 刷新标签列表（新增知识点后标签池可能变）
    renderFilterTags();
  }

  function highlightText(text, keywords) {
    if (!keywords || keywords.length === 0) return escHtml(text);
    var escaped = escHtml(text);
    keywords.forEach(function(kw) {
      if (!kw) return;
      var regex = new RegExp('(' + kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
      escaped = escaped.replace(regex, '<mark>$1</mark>');
    });
    return escaped;
  }


  /* 渲染知识库 */
  function renderKnowledgeTree() {
    // 初始化筛选面板（每次渲染都刷新标签池）
    updateFilterUI();
    var data = loadData();
    var keywords = getSearchKeywords();
    var subjects = Object.keys(data).filter(function (s) { if (!s) return false; var t = (s + '').trim(); return t && t !== 'null' && t !== 'undefined'; });
    var totalCount = 0, anyVisible = false;
    subjects.forEach(function (s) {
      Object.keys(data[s]).forEach(function (t) {
        var items = data[s][t].items || [];
        items.forEach(function (r) {
          if (matchesFilter(s, t, r)) { totalCount++; anyVisible = true; }
        });
      });
    });
    knowledgeCount.textContent = totalCount + ' 条';

    if (subjects.length === 0) {
      knowledgeTree.innerHTML = '<div class="empty-state">还没有知识条目，开始输入吧</div>';
      return;
    }
    if (!anyVisible && currentFilter) {
      knowledgeTree.innerHTML = '<div class="no-search-result">没有匹配 "' + escHtml(currentFilter) + '" 的知识</div>';
      return;
    }

    var html = '';
    var isSearching = !!(currentFilter && currentFilter.trim() !== '');

    if (isSearching) {
      // 搜索模式：扁平结果列表
      var searchResults = [];
      subjects.forEach(function (subj) {
        Object.keys(data[subj]).forEach(function (top) {
          var items = data[subj][top].items || [];
          items.forEach(function (rec, idx) {
            if (matchesFilter(subj, top, rec)) {
              searchResults.push({ subject: subj, topic: top, rec: rec, idx: idx });
            }
          });
        });
      });

      if (searchResults.length === 0) {
        knowledgeTree.innerHTML = '<div class="no-search-result">没有匹配 "' + escHtml(currentFilter) + '" 的知识</div>';
        knowledgeCount.textContent = '0 条';
        return;
      }

      knowledgeCount.textContent = searchResults.length + ' 条（搜索）';
      html += '<div style="padding:0 4px;">';
      html += '<div style="font-size:12px;color:#94a3b8;margin-bottom:8px;">找到 ' + searchResults.length + ' 条匹配结果</div>';

      searchResults.forEach(function (r) {
        html += '<div class="search-result-item" data-subject="' + escHtml(r.subject) + '" data-topic="' + escHtml(r.topic) + '" data-idx="' + r.idx + '" style="padding:12px;margin-bottom:8px;background:rgba(255,255,255,.6);border-radius:8px;border:1px solid var(--green-100);cursor:pointer;">';
        html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">';
        html += '<span style="font-size:11px;color:#fff;background:' + getSubjectColor(r.subject) + ';padding:2px 8px;border-radius:4px;font-weight:500;">' + escHtml(r.subject) + '</span>';
        html += '<span style="font-size:11px;color:var(--green-600);">' + escHtml(r.topic) + '</span>';
        html += '</div>';
        html += '<div style="font-size:14px;color:#334155;line-height:1.6;">' + highlightText(r.rec.summary, keywords) + '</div>';
        if (r.rec.imageId || r.rec.image) {
          html += '<div style="margin-top:6px;font-size:12px;color:#94a3b8;">📷 含图片</div>';
        }
        html += '</div>';
      });
      html += '</div>';
    } else {
      // 树状渲染（按 parent/child 层级）
      subjects.forEach(function (subj) {
      var topicKeys = Object.keys(data[subj]);
      var visibleTopics = [];
      topicKeys.forEach(function (top) {
        var topicItems = data[subj][top].items || [];
        var visibleRecords = [];
        topicItems.forEach(function (rec, idx) {
          if (matchesFilter(subj, top, rec)) visibleRecords.push({ rec: rec, idx: idx });
        });
        var isFiltering = !!(currentFilter || currentSubjectFilter);
        if (visibleRecords.length > 0 || !isFiltering) {
          var recordsToShow = isFiltering ? visibleRecords
            : topicItems.map(function (r, i) { return { rec: r, idx: i }; });
          visibleTopics.push({ name: top, records: recordsToShow, totalCount: topicItems.length });
        }
      });
      if (visibleTopics.length === 0 && isFiltering) return;

      // 分离父级 topic（无 parentTopic）和子级 topic
      var parentTopics = [];
      var childTopicsMap = {}; // { parentName: [childTopic, ...] }
      visibleTopics.forEach(function (vt) {
        var p = data[subj][vt.name] && data[subj][vt.name].parentTopic;
        if (!p) {
          parentTopics.push(vt);
        } else {
          if (!childTopicsMap[p]) childTopicsMap[p] = [];
          childTopicsMap[p].push(vt);
        }
      });

      // 将没有 parent 的 topic 里那些实际上只是父容器的（自己有 children 但没有 items）也正确处理
      var subjTotal = 0;
      visibleTopics.forEach(function (vt) { subjTotal += vt.totalCount; });

      html += '<div class="subject-group">';
      html += '<div class="subject-toggle" data-subject="' + escHtml(subj) + '" style="border-left: 4px solid ' + getSubjectColor(subj) + ';display:flex;align-items:center;gap:8px;">';
      html += '<span class="arrow">▼</span>' + highlightText(subj, keywords);
      html += '<span class="badge">' + subjTotal + '</span>';
      html += '<span style="margin-left:auto;display:flex;gap:4px;">';
      html += '<button class="btn-subject-edit" data-subject="' + escHtml(subj) + '" style="font-size:11px;padding:2px 6px;border:1px solid #bfdbfe;border-radius:4px;background:rgba(255,255,255,.6);color:#3b82f6;cursor:pointer;" title="重命名学科">✏️</button>';
      html += '<button class="btn-subject-delete" data-subject="' + escHtml(subj) + '" style="font-size:11px;padding:2px 6px;border:1px solid #fecaca;border-radius:4px;background:rgba(255,255,255,.6);color:#ef4444;cursor:pointer;" title="删除学科">✕</button>';
      html += '</span></div>';
      html += '<div class="topic-children" data-subject-children="' + escHtml(subj) + '">';

      // 辅助函数：渲染单个 topic 块
      function renderTopicBlock(vt, indentLevel) {
        var indent = indentLevel || 0;
        var paddingStyle = indent > 0 ? 'padding-left:' + (18 * indent) + 'px;' : '';
        var childClass = indent > 0 ? ' topic-child' : '';
        html += '<div class="topic-group' + childClass + '" style="' + paddingStyle + '">';
        html += '<div class="topic-toggle" data-subject="' + escHtml(subj) + '" data-topic="' + escHtml(vt.name) + '" style="display:flex;align-items:center;gap:4px;">';
        html += '<span class="arrow">▼</span>' + highlightText(vt.name, keywords) + ' (' + vt.totalCount + ')';
        html += '<button class="btn-topic-rename" data-subject="' + escHtml(subj) + '" data-topic="' + escHtml(vt.name) + '" style="font-size:10px;margin-left:auto;padding:2px 6px;border:1px solid #bfdbfe;border-radius:4px;background:rgba(255,255,255,.6);color:#3b82f6;cursor:pointer;" title="重命名知识点">✏️</button>';
        html += '</div>';
        html += '<div class="record-list" data-topic-children="' + escHtml(subj) + '|' + escHtml(vt.name) + '">';
        vt.records.forEach(function (item) {
          var rec = item.rec, idx = item.idx;
          var highlightClass = (highlightRecord && highlightRecord.subject === subj && highlightRecord.topic === vt.name) ? ' highlight-flash' : '';
          html += '<li class="record-item' + highlightClass + '"><div class="record-body">';
          html += '<div class="record-summary" data-subject="' + escHtml(subj) + '" data-topic="' + escHtml(vt.name) + '" data-idx="' + idx + '" style="cursor:pointer;">' + highlightText(rec.summary, keywords) + '</div>';
          if (rec.imageId || rec.image) {
            html += '<div class="record-image-thumb">';
            if (rec.imageId) {
              html += '<div class="lazy-thumb-placeholder" data-image-id="' + escHtml(rec.imageId) + '" style="width:100%;height:80px;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:13px;">⏳ 加载中...</div>';
            } else if (rec.image) {
              html += '<img src="' + escHtml(rec.image) + '" style="width:100%;max-height:120px;object-fit:contain;border-radius:4px;border:1px solid var(--green-200);" onerror="this.style.display=\'none\';this.parentNode.innerHTML+=\'<div style=padding:12px;text-align:center;color:#94a3b8;font-size:13px;>图片加载失败</div>\'">';
            }
            html += '</div>';
          }
          html += '<div class="record-text" id="recText-' + escHtml(subj) + '-' + escHtml(vt.name) + '-' + idx + '">' + highlightText(rec.text, keywords) + '</div>';
          html += '<div class="record-time">' + escHtml(rec.time) + '</div></div>';
          html += '<button class="btn-edit" data-subject="' + escHtml(subj) + '" data-topic="' + escHtml(vt.name) + '" data-idx="' + idx + '">✏️</button>';
          html += '<button class="btn-ai-analyze btn-outline" data-subject="' + escHtml(subj) + '" data-topic="' + escHtml(vt.name) + '" style="font-size:11px;padding:4px 8px;min-height:30px;">🤖</button>';
          html += '<button class="btn-delete" data-subject="' + escHtml(subj) + '" data-topic="' + escHtml(vt.name) + '" data-idx="' + idx + '">✕</button>';
          html += '</li>';
        });
        html += '</div></div>';
      }

      // 渲染父级 topic，并在其下渲染子级
      parentTopics.forEach(function (pt) {
        renderTopicBlock(pt, 0);
        // 渲染该父级下的子 topic
        var children = childTopicsMap[pt.name];
        if (children) {
          children.forEach(function (ct) {
            renderTopicBlock(ct, 1);
          });
        }
      });

      // 渲染孤儿子 topic（parent 不在 visibleTopics 中）
      var renderedChildren = {};
      parentTopics.forEach(function (pt) {
        var children = childTopicsMap[pt.name];
        if (children) children.forEach(function (ct) { renderedChildren[ct.name] = true; });
      });
      visibleTopics.forEach(function (vt) {
        var p = data[subj][vt.name] && data[subj][vt.name].parentTopic;
        if (p && !renderedChildren[vt.name]) {
          renderTopicBlock(vt, 0);
        }
      });

      html += '</div></div>';
    });
    } // end if (isSearching) else
    knowledgeTree.innerHTML = html;
    bindTreeEvents();

    // 高亮记录自动展开
    if (highlightRecord) {
      setTimeout(function () {
        // 展开对应学科
        var subjToggle = knowledgeTree.querySelector('.subject-toggle[data-subject="' + escHtml(highlightRecord.subject) + '"]');
        if (subjToggle) {
          var subjChildren = knowledgeTree.querySelector('[data-subject-children="' + escHtml(highlightRecord.subject) + '"]');
          if (subjChildren && subjChildren.classList.contains('collapsed')) {
            subjChildren.classList.remove('collapsed');
            subjChildren.style.maxHeight = subjChildren.scrollHeight + 'px';
            subjToggle.classList.remove('collapsed');
          }
          // 展开对应话题
          var topicToggle = knowledgeTree.querySelector('.topic-toggle[data-subject="' + escHtml(highlightRecord.subject) + '"][data-topic="' + escHtml(highlightRecord.topic) + '"]');
          if (topicToggle) {
            var topicChildren = knowledgeTree.querySelector('[data-topic-children="' + escHtml(highlightRecord.subject) + '|' + escHtml(highlightRecord.topic) + '"]');
            if (topicChildren && topicChildren.classList.contains('collapsed')) {
              topicChildren.classList.remove('collapsed');
              topicChildren.style.maxHeight = topicChildren.scrollHeight + 'px';
              topicToggle.classList.remove('collapsed');
            }
          }
        }
        // 滚动到高亮元素
        var flashEl = knowledgeTree.querySelector('.record-item.highlight-flash');
        if (flashEl) flashEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        highlightRecord = null;
      }, 100);
    }
  }
  window.renderKnowledgeTree = renderKnowledgeTree;

  function bindTreeEvents() {
    knowledgeTree.querySelectorAll('.subject-toggle').forEach(function (el) {
      el.addEventListener('click', function () {
        var subj = this.getAttribute('data-subject');
        var children = knowledgeTree.querySelector('[data-subject-children="' + escHtml(subj) + '"]');
        if (!children) return;
        if (children.classList.contains('collapsed')) {
          children.classList.remove('collapsed'); children.style.maxHeight = children.scrollHeight + 'px'; this.classList.remove('collapsed');
        } else {
          children.style.maxHeight = children.scrollHeight + 'px';
          requestAnimationFrame(function () { children.classList.add('collapsed'); children.style.maxHeight = '0px'; });
          this.classList.add('collapsed');
        }
      });
    });
    knowledgeTree.querySelectorAll('.topic-toggle').forEach(function (el) {
      el.addEventListener('click', function () {
        var subj = this.getAttribute('data-subject'), top = this.getAttribute('data-topic');
        var children = knowledgeTree.querySelector('[data-topic-children="' + escHtml(subj) + '|' + escHtml(top) + '"]');
        if (!children) return;
        if (children.classList.contains('collapsed')) {
          children.classList.remove('collapsed'); children.style.maxHeight = children.scrollHeight + 'px'; this.classList.remove('collapsed');
        } else {
          children.style.maxHeight = children.scrollHeight + 'px';
          requestAnimationFrame(function () { children.classList.add('collapsed'); children.style.maxHeight = '0px'; });
          this.classList.add('collapsed');
        }
      });
    });
    // P3: 条目点击打开详情弹窗
    knowledgeTree.querySelectorAll('.record-summary').forEach(function (el) {
      var pending = false;
      var handler = function (e) {
        if (pending) return;
        pending = true;
        setTimeout(function () { pending = false; }, 300);
        var subject = this.getAttribute('data-subject');
        var topic = this.getAttribute('data-topic');
        var idx = parseInt(this.getAttribute('data-idx'));
        showRecordDetail(subject, topic, idx);
      };
      el.addEventListener('click', handler);
      el.addEventListener('touchend', handler);
    });
    // 异步加载 IndexedDB 中的图片缩略图（带重试，移动端适配）
    knowledgeTree.querySelectorAll('.lazy-thumb-placeholder').forEach(function (placeholder) {
      var imageId = placeholder.getAttribute('data-image-id');
      if (!imageId) return;

      function tryLoad(retriesLeft) {
        IMG_DB.get(imageId).then(function (base64) {
          if (base64) {
            var img = document.createElement('img');
            img.src = base64;
            img.style.width = '100%';
            img.style.maxHeight = '120px';
            img.style.objectFit = 'contain';
            img.style.borderRadius = '4px';
            img.style.border = '1px solid var(--green-200)';
            img.style.cursor = 'pointer';
            if (placeholder.parentNode) {
              placeholder.parentNode.replaceChild(img, placeholder);
            }
          } else if (retriesLeft > 0) {
            setTimeout(function () { tryLoad(retriesLeft - 1); }, 300);
          } else {
            if (placeholder && placeholder.parentNode) {
              placeholder.innerHTML = '<span style="padding:12px;color:#94a3b8;">图片加载失败</span>';
            }
          }
        }).catch(function () {
          if (retriesLeft > 0) {
            setTimeout(function () { tryLoad(retriesLeft - 1); }, 300);
          } else {
            if (placeholder && placeholder.parentNode) {
              placeholder.innerHTML = '<span style="padding:12px;color:#94a3b8;">图片加载失败</span>';
            }
          }
        });
      }
      tryLoad(3);
    });
    // 图片缩略图点击放大（事件委托，兼容动态创建的 img）
    knowledgeTree.querySelectorAll('.record-image-thumb').forEach(function (thumb) {
      function showViewerOverlay(src) {
        var overlay = document.createElement('div');
        overlay.className = 'image-viewer-overlay';
        var img = document.createElement('img');
        img.src = src;
        var closeBtn = document.createElement('button');
        closeBtn.className = 'image-viewer-close';
        closeBtn.textContent = '✕';
        closeBtn.addEventListener('click', function () { overlay.remove(); });
        overlay.addEventListener('click', function (ev) { if (ev.target === overlay) overlay.remove(); });
        overlay.appendChild(img);
        overlay.appendChild(closeBtn);
        document.body.appendChild(overlay);
      }
      thumb.addEventListener('click', function (e) {
        var target = e.target;
        // 找到被点击的 img 元素
        if (target.tagName === 'IMG' && target.src) {
          e.stopPropagation();
          showViewerOverlay(target.src);
        }
      });
      thumb.addEventListener('touchend', function (e) {
        var target = e.target;
        if (target.tagName === 'IMG' && target.src) {
          e.stopPropagation();
          e.preventDefault();
          showViewerOverlay(target.src);
        }
      });
    });
    knowledgeTree.querySelectorAll('.btn-edit').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.stopPropagation();
        var subj = this.getAttribute('data-subject'), top = this.getAttribute('data-topic'), idx = parseInt(this.getAttribute('data-idx'), 10);
        openEditModal(subj, top, idx);
      });
    });
    knowledgeTree.querySelectorAll('.btn-delete').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.stopPropagation();
        var subj = this.getAttribute('data-subject'), top = this.getAttribute('data-topic'), idx = parseInt(this.getAttribute('data-idx'), 10);
        if (confirm('确定删除 "' + top + '" 下的这条记录吗？')) deleteRecord(subj, top, idx);
      });
    });
    // 学科重命名
    knowledgeTree.querySelectorAll('.btn-subject-edit').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var oldName = this.getAttribute('data-subject');
        var newName = prompt('重命名学科「' + oldName + '」为：', oldName);
        if (newName && newName.trim() && newName.trim() !== oldName) {
          renameSubject(oldName, newName.trim());
        }
      });
    });
    // 学科删除
    knowledgeTree.querySelectorAll('.btn-subject-delete').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var subj = this.getAttribute('data-subject');
        if (confirm('确定删除学科「' + subj + '」及其所有知识点吗？此操作不可撤销。')) {
          deleteSubject(subj);
        }
      });
    });
    // 知识点重命名
    knowledgeTree.querySelectorAll('.btn-topic-rename').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var subj = this.getAttribute('data-subject');
        var oldTopic = this.getAttribute('data-topic');
        var newTopic = prompt('重命名知识点「' + oldTopic + '」为：', oldTopic);
        if (newTopic && newTopic.trim() && newTopic.trim() !== oldTopic) {
          renameTopic(subj, oldTopic, newTopic.trim());
        }
      });
    });
  }

  /* Markmap */
  function getNodeTypeIcon(nodeType) {
    var icons = {
      'concept':    '\u{1F4A1}',   // 核心概念
      'definition': '\u{1F4CB}',   // 定义
      'theorem':    '\u{1F4D0}',   // 定理/定律
      'formula':    '\u{1F9EE}',   // 公式
      'example':    '\u{1F4DD}',   // 例题/示例
      'exercise':   '✏️',   // 习题
      'note':       '\u{1F4CC}'    // 笔记
    };
    return icons[nodeType] || '\u{1F4A1}';  // 默认 concept 图标
  }

  function simpleTokenize(text) {
    if (!text) return [];
    // 移除标点，保留中文/英文/数字
    var cleaned = text.replace(/[^一-龥a-zA-Z0-9]/g, ' ');
    var words = cleaned.split(/\s+/).filter(function (w) { return w.length > 0; });
    var tokens = [];
    words.forEach(function (w) {
      if (/[一-龥]/.test(w)) {
        // 中文：按 bigram 切分
        for (var i = 0; i < w.length - 1; i++) {
          tokens.push(w.substring(i, i + 2));
        }
        // 也保留单字
        for (var j = 0; j < w.length; j++) {
          tokens.push(w[j]);
        }
      } else {
        // 英文/数字：直接作为 token（转小写）
        tokens.push(w.toLowerCase());
      }
    });
    return tokens;
  }

  // 计算 TF（词频）
  function computeTF(tokens) {
    var tf = {};
    tokens.forEach(function (t) {
      tf[t] = (tf[t] || 0) + 1;
    });
    var total = tokens.length || 1;
    Object.keys(tf).forEach(function (t) {
      tf[t] = tf[t] / total;
    });
    return tf;
  }

  // 计算 IDF（逆文档频率）
  function computeIDF(allDocs) {
    var df = {};
    var N = allDocs.length;
    allDocs.forEach(function (doc) {
      var seen = {};
      doc.forEach(function (token) {
        if (!seen[token]) {
          df[token] = (df[token] || 0) + 1;
          seen[token] = true;
        }
      });
    });
    var idf = {};
    Object.keys(df).forEach(function (t) {
      idf[t] = Math.log((N + 1) / (df[t] + 1)) + 1;
    });
    return idf;
  }

  // TF-IDF 向量
  function tfidfVectorize(tokens, idf) {
    var tf = computeTF(tokens);
    var vec = {};
    Object.keys(tf).forEach(function (t) {
      vec[t] = tf[t] * (idf[t] || 0);
    });
    return vec;
  }

  // 余弦相似度
  function cosineSimilarity(vecA, vecB) {
    var dot = 0, normA = 0, normB = 0;
    var allKeys = {};
    Object.keys(vecA).forEach(function (k) { allKeys[k] = true; });
    Object.keys(vecB).forEach(function (k) { allKeys[k] = true; });
    Object.keys(allKeys).forEach(function (k) {
      var a = vecA[k] || 0;
      var b = vecB[k] || 0;
      dot += a * b;
      normA += a * a;
      normB += b * b;
    });
    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  // 收集所有知识条目为文档
  function collectAllRecords(data) {
    var records = [];
    Object.keys(data).forEach(function (s) {
      Object.keys(data[s]).forEach(function (t) {
        (data[s][t].items || []).forEach(function (r, i) {
          records.push({
            subject: s, topic: t, index: i,
            text: (r.summary || '') + ' ' + (r.tags || []).join(' ')
          });
        });
      });
    });
    return records;
  }

  // 查找与目标最相关的 topK 个知识点
  function findRelatedNodes(data, targetSubject, targetTopic, targetIndex, topK, threshold) {
    topK = topK || 5;
    threshold = threshold || 0.15;

    var allRecords = collectAllRecords(data);
    if (allRecords.length <= 1) return [];

    // 找到目标记录
    var targetRec = null;
    var targetTokens = null;
    for (var i = 0; i < allRecords.length; i++) {
      if (allRecords[i].subject === targetSubject &&
          allRecords[i].topic === targetTopic &&
          allRecords[i].index === targetIndex) {
        targetRec = allRecords[i];
        targetTokens = simpleTokenize(targetRec.text);
        break;
      }
    }
    if (!targetRec) return [];

    // 对所有文档分词
    var allTokens = allRecords.map(function (r) { return simpleTokenize(r.text); });

    // 计算 IDF
    var idf = computeIDF(allTokens);

    // 计算目标向量
    var targetVec = tfidfVectorize(targetTokens, idf);

    // 计算每个文档的相似度
    var scores = allRecords.map(function (r, i) {
      if (r.subject === targetSubject && r.topic === targetTopic && r.index === targetIndex) {
        return null;
      }
      var vec = tfidfVectorize(allTokens[i], idf);
      return {
        subject: r.subject,
        topic: r.topic,
        index: r.index,
        summary: data[r.subject][r.topic].items[r.index].summary,
        score: cosineSimilarity(targetVec, vec)
      };
    });

    // 过滤、排序、取 topK
    return scores
      .filter(function (s) { return s !== null && s.score >= threshold; })
      .sort(function (a, b) { return b.score - a.score; })
      .slice(0, topK);
  }

  // ===== P3: 知识点详情弹窗 =====


  function getRecordByRef(ref) {
    var data = loadData();
    var topicData = data[ref.targetSubject] && data[ref.targetSubject][ref.targetTopic];
    if (!topicData || !topicData.items) return null;
    return topicData.items[ref.targetIndex] || null;
  }

  // 辅助：根据 subject/topic/index 获取记录
  function getRecordByKey(subject, topic, index) {
    var data = loadData();
    var topicData = data[subject] && data[subject][topic];
    if (!topicData || !topicData.items) return null;
    return topicData.items[index] || null;
  }

  function showRecordDetail(subject, topic, index) {
    // 防止重复弹窗
    var existing = document.getElementById('recordDetailOverlay');
    if (existing) existing.remove();

    var data = loadData();
    var rec = data[subject][topic].items[index];

    // 获取该条目的所有引用
    var refs = (rec.references || []);

    // 获取"谁引用了我"（反向链接）
    var backlinks = [];
    Object.keys(data).forEach(function (s) {
      Object.keys(data[s]).forEach(function (t) {
        (data[s][t].items || []).forEach(function (r, i) {
          (r.references || []).forEach(function (ref) {
            if (ref.targetSubject === subject && ref.targetTopic === topic && ref.targetIndex === index) {
              backlinks.push({
                fromSubject: s, fromTopic: t, fromIndex: i,
                fromSummary: r.summary, relationType: ref.relationType, note: ref.note
              });
            }
          });
        });
      });
    });

    // 构建弹窗 HTML
    var html = '<div class="record-detail-overlay" id="recordDetailOverlay">';
    html += '<div class="record-detail-card">';

    // 关闭按钮
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">';
    html += '<span style="font-size:12px;color:var(--green-600);">' + getNodeTypeIcon(rec.nodeType) + ' ' + escHtml(rec.nodeType || 'concept') + '</span>';
    html += '<button class="btn-detail-close" style="background:none;border:none;font-size:20px;cursor:pointer;color:#94a3b8;min-width:44px;min-height:44px;">&times;</button>';
    html += '</div>';

    // 标题
    html += '<h3 style="font-size:16px;color:#1e293b;margin-bottom:8px;">' + escHtml(rec.summary) + '</h3>';
    html += '<div style="font-size:13px;color:#64748b;margin-bottom:4px;">' + escHtml(subject) + ' &gt; ' + escHtml(topic) + '</div>';

    // tags
    html += '<div style="margin:8px 0;display:flex;flex-wrap:wrap;gap:4px;">';
    (rec.tags || []).forEach(function (t) {
      html += '<span style="font-size:10px;padding:2px 8px;border-radius:10px;background:rgba(34,197,94,.1);color:var(--green-700);">' + escHtml(t) + '</span>';
    });
    html += '</div>';

    // importance
    var stars = '';
    for (var s = 0; s < (rec.importance || 3); s++) stars += '⭐';
    html += '<div style="font-size:12px;color:#64748b;margin-bottom:8px;">重要性: ' + stars + ' (' + (rec.importance || 3) + '/5)</div>';

    // 详细内容
    html += '<div style="font-size:14px;color:#334155;line-height:1.7;margin:12px 0;padding:12px;background:rgba(255,255,255,.5);border-radius:8px;max-height:200px;overflow-y:auto;">';
    html += escHtml(rec.text || rec.summary);
    html += '</div>';

    // 图片
    if (rec.imageId || rec.image) {
      html += '<div style="margin:8px 0;">';
      var imgSrc = rec.image || '';
      if (rec.imageId && !imgSrc) {
        html += '<div style="padding:12px;text-align:center;color:#94a3b8;font-size:13px;">📷 含图片（点击加载）</div>';
      } else if (imgSrc) {
        html += '<img src="' + escHtml(imgSrc) + '" style="width:100%;max-height:200px;object-fit:contain;border-radius:8px;border:1px solid var(--green-100);">';
      }
      html += '</div>';
    }

    // === 正向引用 ===
    html += '<div style="margin-top:12px;">';
    html += '<div style="font-size:13px;font-weight:600;color:#1e293b;margin-bottom:6px;">🔗 引用了以下知识点 (' + refs.length + ')</div>';
    if (refs.length === 0) {
      html += '<div style="font-size:12px;color:#94a3b8;">暂无引用</div>';
    } else {
      refs.forEach(function (ref, ri) {
        var target = getRecordByRef(ref);
        html += '<div style="padding:6px 10px;margin-bottom:4px;background:rgba(255,255,255,.5);border-radius:6px;font-size:13px;display:flex;align-items:center;gap:6px;">';
        html += '<span style="font-size:10px;padding:1px 6px;border-radius:4px;background:#e0e7ff;color:#4f46e5;">' + escHtml(ref.relationType || 'extension') + '</span>';
        html += '<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + (target ? escHtml(target.summary) : escHtml(ref.targetSubject + ' > ' + ref.targetTopic)) + '</span>';
        html += '<button class="btn-remove-ref" data-ref-idx="' + ri + '" style="margin-left:auto;background:none;border:none;color:#ef4444;cursor:pointer;font-size:14px;min-width:36px;min-height:36px;">&times;</button>';
        html += '</div>';
      });
    }
    html += '</div>';

    // === 反向链接 ===
    html += '<div style="margin-top:12px;">';
    html += '<div style="font-size:13px;font-weight:600;color:#1e293b;margin-bottom:6px;">📌 被以下知识点引用 (' + backlinks.length + ')</div>';
    if (backlinks.length === 0) {
      html += '<div style="font-size:12px;color:#94a3b8;">暂无反向链接</div>';
    } else {
      backlinks.forEach(function (bl) {
        html += '<div style="padding:6px 10px;margin-bottom:4px;background:rgba(255,255,255,.5);border-radius:6px;font-size:13px;display:flex;align-items:center;gap:6px;">';
        html += '<span style="font-size:10px;padding:1px 6px;border-radius:4px;background:#fef3c7;color:#b45309;">' + escHtml(bl.relationType || 'extension') + '</span>';
        html += '<span>' + escHtml(bl.fromSummary) + '</span>';
        html += '<span style="font-size:10px;color:#94a3b8;margin-left:auto;">' + escHtml(bl.fromSubject) + ' > ' + escHtml(bl.fromTopic) + '</span>';
        html += '</div>';
      });
    }
    html += '</div>';

    // === 推荐关联（TF-IDF） ===
    html += '<div style="margin-top:12px;">';
    html += '<div style="font-size:13px;font-weight:600;color:#1e293b;margin-bottom:6px;">💡 可能相关</div>';
    html += '<div id="suggestedRefs" style="max-height:150px;overflow-y:auto;">';
    html += '<button id="btnSuggestRefs" style="padding:6px 14px;border:1px solid var(--green-300);border-radius:6px;background:rgba(255,255,255,.6);color:var(--green-700);font-size:12px;cursor:pointer;">🔍 查找相关知识点</button>';
    html += '</div>';
    html += '</div>';

    html += '</div></div>';  // card + overlay

    // 插入到 body
    var overlay = document.createElement('div');
    overlay.innerHTML = html;
    document.body.appendChild(overlay.firstElementChild);

    // === 事件绑定 ===

    // 关闭弹窗
    document.querySelector('.btn-detail-close').addEventListener('click', function () {
      document.getElementById('recordDetailOverlay').remove();
    });
    document.getElementById('recordDetailOverlay').addEventListener('click', function (e) {
      if (e.target === this) this.remove();
    });

    // 删除引用
    document.querySelectorAll('.btn-remove-ref').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var ri = parseInt(this.getAttribute('data-ref-idx'));
        rec.references.splice(ri, 1);
        saveData(data);
        document.getElementById('recordDetailOverlay').remove();
        showRecordDetail(subject, topic, index);
      });
    });

    // 推荐关联按钮
    document.getElementById('btnSuggestRefs').addEventListener('click', function () {
      var suggestions = findRelatedNodes(data, subject, topic, index);
      var sugHtml = '';
      if (suggestions.length === 0) {
        sugHtml = '<div style="font-size:12px;color:#94a3b8;padding:8px 0;">未找到相关知识点（知识库可能太小）</div>';
      } else {
        suggestions.forEach(function (sug) {
          sugHtml += '<div style="padding:6px 10px;margin-bottom:4px;background:rgba(255,255,255,.5);border-radius:6px;font-size:13px;display:flex;align-items:center;gap:6px;justify-content:space-between;">';
          sugHtml += '<div style="min-width:0;flex:1;"><span style="font-size:10px;color:#64748b;">' + escHtml(sug.subject) + ' &gt; ' + escHtml(sug.topic) + '</span><br>' + escHtml(sug.summary) + '</div>';
          sugHtml += '<button class="btn-add-ref" data-target-subj="' + escHtml(sug.subject) + '" data-target-topic="' + escHtml(sug.topic) + '" data-target-idx="' + sug.index + '" style="padding:3px 8px;border:1px solid var(--green-400);border-radius:4px;background:rgba(34,197,94,.1);color:var(--green-700);font-size:11px;cursor:pointer;white-space:nowrap;">🔗 关联</button>';
          sugHtml += '</div>';
        });
      }
      document.getElementById('suggestedRefs').innerHTML = sugHtml;

      // 绑定关联按钮
      document.querySelectorAll('.btn-add-ref').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var targetSubj = this.getAttribute('data-target-subj');
          var targetTopic = this.getAttribute('data-target-topic');
          var targetIdx = parseInt(this.getAttribute('data-target-idx'));

          // 检查是否已存在引用
          var exists = rec.references.some(function (r) {
            return r.targetSubject === targetSubj && r.targetTopic === targetTopic && r.targetIndex === targetIdx;
          });
          if (exists) { showToast('已存在该关联', 'error'); return; }

          rec.references.push({
            targetSubject: targetSubj,
            targetTopic: targetTopic,
            targetIndex: targetIdx,
            relationType: 'extension',
            note: '',
            createdAt: new Date().toISOString()
          });
          saveData(data);
          document.getElementById('recordDetailOverlay').remove();
          showRecordDetail(subject, topic, index);
          showToast('关联已添加', 'success');
        });
      });
    });
  }

  function buildMarkdown(data, expandSubject) {
    var lines = [];
    var allSubjects = Object.keys(data).filter(function (s) { if (!s) return false; var t = (s + '').trim(); return t && t !== 'null' && t !== 'undefined'; });
    if (allSubjects.length === 0) return '';
    // expandSubject: true=展开全部, null=折叠全部, string=只展开该学科
    var expandAll = (expandSubject === true);
    // 选中单一学科时，只处理该学科，其他学科不输出
    var subjects;
    if (typeof expandSubject === 'string' && expandSubject !== null) {
      lines.push('# ' + expandSubject);
      subjects = [expandSubject];
    } else {
      lines.push('# 我的知识树');
      subjects = allSubjects;
    }
    subjects.forEach(function (s) {
      // 单选模式下不再输出重复的 ## 学科名
      if (typeof expandSubject !== 'string' || expandSubject === null) {
        lines.push('## ' + s);
      }
      if (!expandAll && expandSubject !== s) {
        // 折叠模式：只列出话题名，不展开具体条目
        var topics = Object.keys(data[s]);
        topics.forEach(function (t) {
          if (!data[s][t].parentTopic) {
            lines.push('- ' + t);
          }
        });
      } else {
        // 展开模式：完整内容
        var topics = Object.keys(data[s]);
        var topLevel = [];
        var children = [];
        topics.forEach(function (t) {
          if (data[s][t].parentTopic) {
            children.push(t);
          } else {
            topLevel.push(t);
          }
        });
        topLevel.forEach(function (t) {
          lines.push('### ' + t);
          var items = data[s][t].items || [];
          items.forEach(function (r) {
            var icon = getNodeTypeIcon(r.nodeType);
            lines.push('- ' + icon + ' ' + r.summary + ((r.imageId || r.image) ? ' 📷' : ''));
          });
          children.forEach(function (ct) {
            if (data[s][ct].parentTopic === t) {
              lines.push('#### ' + ct);
              var citems = data[s][ct].items || [];
              if (citems.length > 0) {
                citems.forEach(function (r) {
                  var icon = getNodeTypeIcon(r.nodeType);
                  lines.push('- ' + icon + ' ' + r.summary + ((r.imageId || r.image) ? ' 📷' : ''));
                });
              } else {
                lines.push('- （待添加内容）');
              }
            }
          });
        });
        // 孤立子节点降级为顶层
        children.forEach(function (ct) {
          var p = data[s][ct].parentTopic;
          if (!data[s][p]) {
            lines.push('### ' + ct);
            var items = data[s][ct].items || [];
            items.forEach(function (r) {
              var icon = getNodeTypeIcon(r.nodeType);
              lines.push('- ' + icon + ' ' + r.summary);
            });
          }
        });
      }
    });
    return lines.join('\n');
  }

  var mmInstance = null;
  var currentMindmapSubject = null;

  /* 智能合并：发现同级 topic 中的公共关键词 */

  function findMergeCandidates(data) {
    var candidates = [];
    var subjects = Object.keys(data).filter(function (s) {
      if (!s) return false;
      var t = (s + '').trim();
      return t && t !== 'null' && t !== 'undefined';
    });
    subjects.forEach(function (subject) {
      // 只匹配同级 topic（无 parentTopic 的顶级 topic）
      var topics = Object.keys(data[subject]).filter(function (t) {
        return !data[subject][t].parentTopic;
      });
      if (topics.length < 2) return;

      // 两两比较，找公共前缀
      var prefixGroups = {};
      for (var i = 0; i < topics.length; i++) {
        for (var j = i + 1; j < topics.length; j++) {
          var a = topics[i], b = topics[j];
          var commonPrefix = '';
          var minLen = Math.min(a.length, b.length);
          for (var k = 0; k < minLen; k++) {
            if (a[k] === b[k]) commonPrefix += a[k]; else break;
          }
          // 前缀长度 ≥ 2 且严格短于两个 topic 名
          if (commonPrefix.length >= 2 && commonPrefix.length < a.length && commonPrefix.length < b.length) {
            if (!prefixGroups[commonPrefix]) prefixGroups[commonPrefix] = {};
            prefixGroups[commonPrefix][a] = true;
            prefixGroups[commonPrefix][b] = true;
          }
        }
      }

      // 生成候选：至少覆盖 2 个 topic，且前缀不是已有 topic 名
      Object.keys(prefixGroups).forEach(function (prefix) {
        var matched = Object.keys(prefixGroups[prefix]);
        if (matched.length >= 2 && matched.indexOf(prefix) === -1) {
          candidates.push({ subject: subject, parent: prefix, children: matched, keyword: prefix });
        }
      });
    });

    // 去重：如果多组候选的子项集合完全相同，只保留最长 parent 的
    var deduped = [];
    candidates.forEach(function (c) {
      var sorted = c.children.slice().sort().join('|');
      var existing = false;
      for (var i = 0; i < deduped.length; i++) {
        var dedupedSorted = deduped[i].children.slice().sort().join('|');
        if (sorted === dedupedSorted) {
          existing = true;
          if (c.parent.length > deduped[i].parent.length) {
            deduped[i] = c;
          }
          break;
        }
      }
      if (!existing) deduped.push(c);
    });

    return deduped;
  }

  function showSmartMergeDialog(candidates) {
    var listEl = document.getElementById('smartMergeList');
    if (candidates.length === 0) {
      listEl.innerHTML = '<p style="text-align:center;color:#94a3b8;padding:20px;">未发现可合并的知识点 😌</p>';
    } else {
      var html = '';
      candidates.forEach(function (c, i) {
        var chipColor = ['#22c55e','#3b82f6','#f59e0b','#8b5cf6','#ec4899'][i % 5];
        html += '<div style="margin-bottom:12px;padding:12px;background:rgba(255,255,255,.7);border-radius:10px;border:1px solid var(--green-100);">';
        html += '<div style="font-size:12px;color:#94a3b8;margin-bottom:4px;">📂 ' + escHtml(c.subject) + '</div>';
        html += '<div style="font-weight:600;color:' + chipColor + ';margin-bottom:6px;">新父节点：' + escHtml(c.parent) + '</div>';
        html += '<div style="display:flex;flex-wrap:wrap;gap:4px;">';
        c.children.forEach(function (ch) {
          html += '<span style="font-size:12px;background:rgba(0,0,0,.04);padding:3px 8px;border-radius:6px;">' + escHtml(ch) + '</span>';
        });
        html += '</div></div>';
      });
      listEl.innerHTML = html;
    }
    document.getElementById('smartMergeOverlay').style.display = 'flex';
    document.getElementById('smartMergeOverlay')._candidates = candidates;
  }

  document.getElementById('btnSmartMerge').addEventListener('click', function () {
    var data = loadData();
    var candidates = findMergeCandidates(data);
    showSmartMergeDialog(candidates);
  });

  document.getElementById('btnSmartMergeCancel').addEventListener('click', function () {
    document.getElementById('smartMergeOverlay').style.display = 'none';
  });

  document.getElementById('btnSmartMergeApply').addEventListener('click', function () {
    var candidates = document.getElementById('smartMergeOverlay')._candidates || [];
    if (candidates.length === 0) return;
    var data = loadData();
    candidates.forEach(function (c) {
      if (!data[c.subject]) return;
      var childrenToMove = c.children.filter(function (ch) { return data[c.subject][ch]; });
      if (childrenToMove.length < 2) return;
      // 创建父节点
      if (!data[c.subject][c.parent]) {
        data[c.subject][c.parent] = { items: [], parentTopic: null };
      }
      // 移动子节点
      childrenToMove.forEach(function (ch) {
        data[c.subject][ch].parentTopic = c.parent;
      });
    });
    saveData(data);
    document.getElementById('smartMergeOverlay').style.display = 'none';
    renderKnowledgeTree();
    refreshMindmap();
    showToast('已合并 ' + candidates.length + ' 组知识点', 'success');
  });

  function renderMindmapSubjectBar() {
    var data = loadData();
    var subjects = Object.keys(data).filter(function (s) { if (!s) return false; var t = (s + '').trim(); return t && t !== 'null' && t !== 'undefined'; });
    var bar = document.getElementById('mindmapSubjectBar');
    if (!bar) return;
    if (subjects.length === 0) { bar.style.display = 'none'; return; }
    bar.style.display = 'flex';
    var html = '<span class="subject-chip-all' + (currentMindmapSubject === null ? ' active' : '') + '" data-subject="">全部</span>';
    subjects.forEach(function (s) {
      html += '<span class="subject-chip' + (currentMindmapSubject === s ? ' active' : '') + '" data-subject="' + escHtml(s) + '">' + escHtml(s) + '</span>';
    });
    bar.innerHTML = html;
  }

  async function refreshMindmap() {
    var data = loadData();
    var hasData = Object.keys(data).length > 0;
    renderMindmapSubjectBar();
    if (!hasData) {
      mindmapBody.classList.remove('has-data');
      if (mmInstance) { mmInstance.destroy(); mmInstance = null; }
      return;
    }
    mindmapBody.classList.add('has-data');
    var md = buildMarkdown(data, currentMindmapSubject);
    if (!window.markmap) { setTimeout(refreshMindmap, 200); return; }
    var { Markmap, Transformer } = window.markmap;
    var transformer = new Transformer();
    var { root } = transformer.transform(md);
    if (mmInstance) {
      mmInstance.setData(root);
      await mmInstance.fit();
    } else {
      mmInstance = Markmap.create(mindmapSvg, { autoFit: true, colorFreezeLevel: 1, duration: 300, paddingX: 18, spacingHorizontal: 80, spacingVertical: 12, fitRatio: 0.9, initialExpandLevel: -1 }, root);
    }

    // 点击思维导图节点 → 跳转到知识库对应内容
    setTimeout(function () {
      if (!mindmapSvg) return;
      mindmapSvg.querySelectorAll('g.markmap-node').forEach(function (node) {
        node.style.cursor = 'pointer';
        node.addEventListener('click', function (e) {
          var fo = node.querySelector('foreignObject');
          var label = fo ? fo.textContent.trim() : '';
          if (!label || label === '我的知识树') return;
          var knowledgeTab = document.querySelector('[data-panel="knowledgePanel"]');
          if (knowledgeTab) knowledgeTab.click();
          setTimeout(function () {
            var escaped = CSS.escape(label);
            var target = document.querySelector('[data-subject="' + escaped + '"]');
            if (!target) {
              target = document.querySelector('[data-topic="' + escaped + '"]');
            }
            if (target) {
              target.scrollIntoView({ behavior: 'smooth', block: 'start' });
              var toggle = target.querySelector('.subject-toggle, .topic-toggle');
              if (toggle && toggle.classList.contains('collapsed')) toggle.click();
              target.style.transition = 'background 0.3s';
              target.style.background = '#bbf7d0';
              setTimeout(function () { target.style.background = ''; }, 1200);
            }
          }, 300);
        });
      });
    }, 300);
  }
  window.refreshMindmap = refreshMindmap;

  function escAttr(str) {
    return (str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

