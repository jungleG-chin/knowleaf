// KnowLeaf 知叶 — 应用入口 + 全局事件

  /* 工具函数（提升到顶部，同时暴露给外部 js 文件） */
  function escHtml(s) {
    if (s === null || s === undefined) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  window.escHtml = escHtml;


  function isValidSubject(s) {
    if (!s) return false;
    var t = (s + '').trim();
    return t && t !== 'null' && t !== 'undefined';
  }
  window.isValidSubject = isValidSubject;

  /* ===== 底部导航 Tab 切换 ===== */
  var navTabs = document.querySelectorAll('.nav-tab');
  var panels = document.querySelectorAll('.panel');
  navTabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      var panelId = this.getAttribute('data-panel');
      navTabs.forEach(function (t) { t.classList.remove('active'); });
      this.classList.add('active');
      panels.forEach(function (p) { p.classList.remove('active'); });
      document.getElementById(panelId).classList.add('active');
    });
  });



  async function addKnowledge(text, subject, topic, summary, imageBase64, parentTopic, meta) {
    // 拒绝 null/undefined/空字符串的 subject
    if (!subject || subject === 'null' || subject === 'undefined' || (typeof subject === 'string' && subject.trim() === '')) {
      console.warn('addKnowledge: 拒绝无效 subject:', subject);
      return;
    }
    subject = (subject + '').trim();
    // 拒绝无效 topic
    if (!topic || topic === 'null' || topic === 'undefined' || (typeof topic === 'string' && topic.trim() === '')) {
      console.warn('addKnowledge: 拒绝无效 topic:', topic);
      return;
    }
    topic = (topic + '').trim();
    var data = loadData();
    if (!data[subject]) data[subject] = {};
    if (!data[subject][topic]) {
      data[subject][topic] = { items: [], parentTopic: parentTopic || null };
    } else if (parentTopic && !data[subject][topic].parentTopic) {
      data[subject][topic].parentTopic = parentTopic;
    }
    // 自动创建父知识点占位
    if (parentTopic && !data[subject][parentTopic]) {
      data[subject][parentTopic] = { items: [], parentTopic: null };
    }
    var now = new Date();
    var imageId = null;
    if (imageBase64) {
      imageId = subject + '|' + topic + '|' + now.getTime();
      await IMG_DB.put(imageId, imageBase64);
    }
    data[subject][topic].items.push({
      text: text, summary: summary,
      time: now.toLocaleString('zh-CN'),
      createdAt: now.toISOString(),
      reviewCount: 0, correctCount: 0,
      lastReviewed: null, nextReview: now.toISOString(),
      interval: 1, status: 'learning',
      imageId: imageId,
      // === Phase 1 新增字段（向下兼容，有则存） ===
      nodeType: (meta && meta.nodeType) || 'concept',
      tags: (meta && Array.isArray(meta.tags)) ? meta.tags : [],
      importance: (meta && typeof meta.importance === 'number' && meta.importance >= 1 && meta.importance <= 5)
        ? meta.importance : 3,
      // P3: 双向引用
      references: (meta && Array.isArray(meta.references)) ? meta.references : []
    });
    saveData(data);
    renderKnowledgeTree();
  }

  // 重命名学科（迁移所有记录到新学科名下）
  function renameSubject(oldName, newName) {
    var data = loadData();
    if (!data[oldName]) return;
    if (data[newName]) { showToast('学科「' + newName + '」已存在，请换一个名字', 'error'); return; }
    data[newName] = data[oldName];
    delete data[oldName];
    saveData(data);
    renderKnowledgeTree();
    refreshMindmap();
    showToast('已重命名为「' + newName + '」', 'success');
  }

  // 重命名知识点（独立重命名 topic 并更新子节点引用）
  function renameTopic(subject, oldTopic, newTopic) {
    var data = loadData();
    if (!data[subject] || !data[subject][oldTopic]) return;
    if (data[subject][newTopic]) { showToast('知识点「' + newTopic + '」已存在', 'error'); return; }
    // 迁移数据
    data[subject][newTopic] = data[subject][oldTopic];
    delete data[subject][oldTopic];
    // 更新所有子 topic 的 parentTopic 引用
    Object.keys(data[subject]).forEach(function (t) {
      if (data[subject][t].parentTopic === oldTopic) {
        data[subject][t].parentTopic = newTopic;
      }
    });
    saveData(data);
    renderKnowledgeTree();
    refreshMindmap();
    showToast('已重命名为「' + newTopic + '」', 'success');
  }
  window.renameSubject = renameSubject;
  window.renameTopic = renameTopic;

  function countRecords(data) {
    var c = 0;
    Object.keys(data).forEach(function (s) {
      Object.keys(data[s]).forEach(function (t) {
        var v = data[s][t];
        if (v && v.items) c += v.items.length;
      });
    });
    return c;
  }
  function countSubjects(data) { return Object.keys(data).length; }
  function countTopics(data) {
    var c = 0;
    Object.keys(data).forEach(function (s) { c += Object.keys(data[s]).length; });
    return c;
  }
  window.countRecords = countRecords;
  window.countSubjects = countSubjects;
  window.countTopics = countTopics;

  async function clearAllData() {
    if (!confirm('确定要清空全部知识数据吗？')) return;
    if (!confirm('此操作不可恢复！再次确认清空？')) return;
    localStorage.removeItem(DATA_KEY);
    try { await IMG_DB.clearAll(); } catch (e) {}
    renderKnowledgeTree();
    refreshMindmap();
    showToast('已清空全部数据', 'success');
  }
  window.clearAllData = clearAllData;

  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function svgToCanvas(svgString, w, h) {
    return new Promise(function (resolve, reject) {
      var scale = Math.min(2, Math.floor(4000 / Math.max(w, h, 1)));
      var canvas = document.createElement('canvas');
      canvas.width = w * scale;
      canvas.height = h * scale;
      var ctx = canvas.getContext('2d');
      ctx.scale(scale, scale);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      var img = new Image();
      var url;
      img.onload = function () { URL.revokeObjectURL(url); ctx.drawImage(img, 0, 0, w, h); resolve(canvas); };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('渲染失败')); };
      url = URL.createObjectURL(new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' }));
      img.src = url;
    });
  }

  async function generateMindmapPDF(data) {
    var md = buildMarkdown(data, true);
    if (!md || md.trim().length <= '# 我的知识树'.length + 5) return null;
    if (!window.markmap || !window.markmap.Markmap) return null;
    var Markmap = window.markmap.Markmap;
    var Transformer = window.markmap.Transformer;
    if (!Transformer) return null;
    var transformer = new Transformer();
    var rootData;
    try { var r = transformer.transform(md); rootData = r.root; } catch (e) { return null; }
    if (!rootData) return null;

    var wrapper = document.createElement('div');
    wrapper.style.cssText = 'position:fixed;left:-9999px;top:0;width:1600px;height:1200px;z-index:-1;';
    document.body.appendChild(wrapper);
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.style.width = '100%'; svg.style.height = '100%';
    wrapper.appendChild(svg);

    var pdfBlob = null, mm = null;
    try {
      mm = Markmap.create(svg, {
        autoFit: true, colorFreezeLevel: 1, duration: 0,
        paddingX: 24, spacingHorizontal: 80, spacingVertical: 12,
        fitRatio: 0.9, initialExpandLevel: -1
      }, rootData);
      for (var i = 0; i < 15; i++) {
        await new Promise(function (r) { setTimeout(r, 200); });
        var b = svg.getBoundingClientRect();
        if (b.width > 100 && b.height > 100) break;
      }
      await new Promise(function (r) { setTimeout(r, 400); });
      try { if (mm.fit) await mm.fit(); } catch (e) {}
      var rect = svg.getBoundingClientRect();
      var w = Math.max(Math.ceil(rect.width), 400);
      var h = Math.max(Math.ceil(rect.height), 300);
      var clone = svg.cloneNode(true);
      clone.setAttribute('width', String(w));
      clone.setAttribute('height', String(h));
      if (!clone.getAttribute('viewBox') || clone.getAttribute('viewBox') === '0 0 0 0') {
        clone.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
      }
      var svgStr = new XMLSerializer().serializeToString(clone);
      var canvas = await svgToCanvas(svgStr, w, h);
      var jsPDF = window.jspdf ? window.jspdf.jsPDF : (typeof jspdf !== 'undefined' ? jspdf.jsPDF : null);
      if (!jsPDF) throw new Error('jsPDF未加载');
      var orient = w >= h ? 'landscape' : 'portrait';
      var pdf = new jsPDF({ orientation: orient, unit: 'px', format: [w, h] });
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, w, h);
      pdfBlob = pdf.output('blob');
    } catch (e) {
      console.warn('PDF生成失败', e);
    } finally {
      try { if (mm && mm.destroy) mm.destroy(); } catch (e) {}
      if (wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
    }
    return pdfBlob;
  }



  // ===== P3: TF-IDF 中文简单实现 =====

  // 简易中文分词：按字符 bigram 切分
  // 辅助：根据 ref 对象获取记录

  /* 查找两个字符串的所有公共子串（长度>=2） */




  /* 思维导图折叠 */
  mindmapToggle.addEventListener('click', function () {
    var collapsed = mindmapBody.classList.contains('collapsed');
    if (collapsed) {
      mindmapBody.classList.remove('collapsed');
      mindmapToggle.classList.remove('collapsed');
      if (Object.keys(loadData()).length > 0) refreshMindmap();
    } else {
      mindmapBody.classList.add('collapsed');
      mindmapToggle.classList.add('collapsed');
    }
  });

  /* 思维导图学科折叠切换 */
  document.getElementById('mindmapSubjectBar').addEventListener('click', function (e) {
    var chip = e.target.closest('.subject-chip, .subject-chip-all');
    if (!chip) return;
    var subject = chip.getAttribute('data-subject') || null;
    currentMindmapSubject = subject;
    refreshMindmap();
    // 切换导图学科时清空知识列表搜索
    if (searchInput && currentFilter) {
      currentFilter = '';
      searchInput.value = '';
      renderKnowledgeTree();
    }
  });
  searchInput.addEventListener('compositionstart', function () { isComposing = true; });
  searchInput.addEventListener('compositionend', function () {
    isComposing = false;
    // compositionend 时不自动搜，等用户点按钮
  });
  searchInput.addEventListener('input', function () {
    if (isComposing) return; // IME 输入过程中不触发
  });
  /* 搜索按钮 */
  document.getElementById('btnSearch').addEventListener('click', function () {
    currentFilter = searchInput.value.trim();
    renderKnowledgeTree();
  });
  /* enter 键搜索 */
  searchInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      currentFilter = this.value.trim();
      renderKnowledgeTree();
    }
  });

  // === P2b 筛选面板事件 ===

  // nodeType 筛选芯片点击
  var filterNodeTypesEl = document.getElementById('filterNodeTypes');
  if (filterNodeTypesEl) {
    filterNodeTypesEl.addEventListener('click', function (e) {
      var chip = e.target.closest('.filter-chip-type');
      if (!chip) return;
      var type = chip.getAttribute('data-type');
      var idx = filterNodeTypes.indexOf(type);
      if (idx >= 0) {
        filterNodeTypes.splice(idx, 1);
      } else {
        filterNodeTypes.push(type);
      }
      renderKnowledgeTree();
    });
  }

  // 标签筛选芯片点击（事件委托）
  var filterTagsEl = document.getElementById('filterTags');
  if (filterTagsEl) {
    filterTagsEl.addEventListener('click', function (e) {
      var chip = e.target.closest('.filter-chip-tag');
      if (!chip) return;
      var tag = chip.getAttribute('data-tag');
      var idx = filterTags.indexOf(tag);
      if (idx >= 0) {
        filterTags.splice(idx, 1);
      } else {
        filterTags.push(tag);
      }
      renderKnowledgeTree();
    });
  }

  // 重要性下拉
  var filterImportanceEl = document.getElementById('filterImportance');
  if (filterImportanceEl) {
    filterImportanceEl.addEventListener('change', function () {
      filterMinImportance = parseInt(this.value) || 0;
      renderKnowledgeTree();
    });
  }

  // 清除筛选
  var btnClearFilterEl = document.getElementById('btnClearFilter');
  if (btnClearFilterEl) {
    btnClearFilterEl.addEventListener('click', function () {
      filterNodeTypes = [];
      filterTags = [];
      filterMinImportance = 0;
      var impSelect = document.getElementById('filterImportance');
      if (impSelect) impSelect.value = '0';
      renderKnowledgeTree();
    });
  }

  /* 调用 AI API（支持多平台） */

  /* ===== 图片压缩（Canvas，纯 JS） ===== */
  function compressImage(base64, maxSizeKB, callback) {
    var img = new Image();
    img.onload = function () {
      var canvas = document.createElement('canvas');
      var targetBytes = maxSizeKB * 1024;
      var MAX_DIM = 1920;
      var w = img.width, h = img.height;
      if (w > MAX_DIM || h > MAX_DIM) {
        var ratio = Math.min(MAX_DIM / w, MAX_DIM / h);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
      }
      canvas.width = w;
      canvas.height = h;
      var ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      var quality = 0.6;
      var result = canvas.toDataURL('image/jpeg', quality);
      while (result.length > targetBytes && quality > 0.2) {
        quality -= 0.1;
        result = canvas.toDataURL('image/jpeg', quality);
      }
      callback(result);
    };
    img.src = base64;
  }

  /* 压缩图片用于 localStorage 存储（600x400, JPEG 40%，约 20-30KB） */

  /* ===== 构建 multimodal 消息内容 ===== */
  /* ===== 统一 API 调用（支持文本 + 图片） ===== */
  async function callDeepSeek(text, imageBase64, analyzeMode) {
    var apiKey = getApiKey();
    if (!apiKey) { apiKey = await showApiKeyModal(); if (!apiKey) return null; }
    var apiUrl = getApiUrl();
    var model  = getModel();

    if (analyzeMode) {
      var analyzePrompt = '你是一个学习助手。用户正在复习某个知识点，请对该知识点进行深度分析，输出格式化的 markdown 内容，包含以下部分（根据内容灵活调整）：\n1. **核心概念**：用通俗语言解释这个知识点\n2. **关键要点**：列出3-5个必须掌握的要点\n3. **易错提醒**：常见错误和理解误区\n4. **记忆技巧**：助记口诀或联想方法\n5. **关联知识**：与哪些其他知识点相关联\n6. **自测题**：2-3道选择题或填空题（带答案）\n\n用中文回答，语言简洁易懂，适合大学生复习使用。';
      var resp = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
        body: JSON.stringify({
          model: model, temperature: 0.7, max_tokens: 4096,
          messages: [
            { role: 'system', content: analyzePrompt },
            { role: 'user', content: text }
          ]
        })
      });
      if (!resp.ok) {
        var errText3 = '';
        try { var errJson3 = JSON.parse(await resp.text()); errText3 = errJson3.error && errJson3.error.message ? errJson3.error.message : ''; } catch (e) {}
        throw new Error('API 请求失败 (' + resp.status + ')' + (errText3 ? ': ' + errText3 : ''));
      }
      var data3 = await resp.json();
      return data3.choices[0].message.content;
    }

    var hasImage = Array.isArray(imageBase64) ? imageBase64.length > 0 : !!imageBase64;
    var systemPrompt;
    if (hasImage && !text) {
      var imageCount = Array.isArray(imageBase64) ? imageBase64.length : 1;
      systemPrompt = '你是一个 OCR 知识提取器。' +
        (imageCount > 1
          ? '用户上传了 ' + imageCount + ' 张图片，请分别识别每张图片中的文字内容，'
          : '请识别图片中的所有文字内容，') +
        '提取知识点。输出纯 JSON 数组，每个对象包含以下字段：\n' +
        '- subject: 学科名（必填）\n' +
        '- topic: 知识点名（必填）\n' +
        '- summary: 一句话总结（必填）\n' +
        '- parentTopic: 父知识点名，子概念才填，没有填 null\n' +
        '- nodeType: 知识类型，可选值为 "concept"(概念)、"definition"(定义)、"theorem"(定理/定律)、"formula"(公式)、"example"(例题/示例)、"exercise"(习题)。如果是纯概念/名词解释填 "concept"（默认）\n' +
        '- tags: 跨学科标签数组，如 ["操作系统","进程管理","考研核心"]，至少 1 个，最多 5 个\n' +
        '- importance: 复习重要性 1-5，5=必考核心/高频考点，4=重要基础概念，3=一般知识点，2=了解即可，1=扩展知识。默认 3\n' +
        '如果某张图片中没有文字，跳过它。' +
        '只输出 JSON 数组，不要 markdown 标记。' +
        '【粒度细化】如果输入内容包含多条并列规则、步骤、要点、分类或例外情况，必须将每条规则/步骤/例外拆分为独立的 topic（通过 parentTopic 关联到父知识点），不要将多个规则合并到同一个 topic 中。' +
        '【分类建议】同时分析内容属于什么学科/领域，给出3个最可能的分类建议。最终输出格式改为：' +
        '[{"subject":"学科","topic":"知识点","summary":"一句话总结","parentTopic":null,"nodeType":"concept","tags":["标签1"],"importance":3}], 并在数组外附加 "suggestedSubjects":["分类1","分类2","分类3"]';
    } else if (hasImage && text) {
      var imageCount2 = Array.isArray(imageBase64) ? imageBase64.length : 1;
      systemPrompt = '你是一个知识提取器。' +
        (imageCount2 > 1
          ? '用户上传了 ' + imageCount2 + ' 张图片并附带了文字说明。请结合每张图片和文字描述提取知识点，'
          : '用户上传了一张图片并附带了文字说明。请结合图片内容和文字描述提取知识点，') +
        '输出纯 JSON 数组，每个对象包含以下字段：\n' +
        '- subject: 学科名（必填）\n' +
        '- topic: 知识点名（必填）\n' +
        '- summary: 一句话总结（必填）\n' +
        '- parentTopic: 父知识点名，子概念才填，没有填 null\n' +
        '- nodeType: 知识类型，可选值为 "concept"(概念)、"definition"(定义)、"theorem"(定理/定律)、"formula"(公式)、"example"(例题/示例)、"exercise"(习题)。如果是纯概念/名词解释填 "concept"（默认）\n' +
        '- tags: 跨学科标签数组，如 ["操作系统","进程管理","考研核心"]，至少 1 个，最多 5 个\n' +
        '- importance: 复习重要性 1-5，5=必考核心/高频考点，4=重要基础概念，3=一般知识点，2=了解即可，1=扩展知识。默认 3\n' +
        '只输出 JSON 数组不要 markdown 标记。' +
        '【粒度细化】【分类建议】同上';
    } else {
      systemPrompt = '你是一个知识提取器。用户输入一段学习笔记，提取所有知识点。' +
        '输出纯 JSON 数组，每个对象包含以下字段：\n' +
        '- subject: 学科名（必填）\n' +
        '- topic: 知识点名（必填）\n' +
        '- summary: 一句话总结（必填）\n' +
        '- parentTopic: 父知识点名，子概念才填，没有填 null\n' +
        '- nodeType: 知识类型，可选值为 "concept"(概念)、"definition"(定义)、"theorem"(定理/定律)、"formula"(公式)、"example"(例题/示例)、"exercise"(习题)。如果是纯概念/名词解释填 "concept"（默认）\n' +
        '- tags: 跨学科标签数组，如 ["操作系统","进程管理","考研核心"]，至少 1 个，最多 5 个\n' +
        '- importance: 复习重要性 1-5，5=必考核心/高频考点，4=重要基础概念，3=一般知识点，2=了解即可，1=扩展知识。默认 3\n' +
        '只输出 JSON 数组不要 markdown 标记。' +
        '【粒度细化】如果输入内容包含多条并列规则、步骤、要点、分类或例外情况，必须将每条规则/步骤/例外拆分为独立的 topic（通过 parentTopic 关联到父知识点），不要将多个规则合并到同一个 topic 中。' +
        '示例："英语序数词6条规则"应拆为6个子topic；"OS进程调度算法"应拆为FCFS/SJF/优先级等各一个topic。' +
        '【分类建议】同时分析内容属于什么学科/领域，给出3个最可能的分类建议。最终输出格式增加字段 suggestedSubjects: ["分类1","分类2","分类3"]';
    }

    var userContent = buildContent(text, imageBase64);
    if (!userContent || userContent.length === 0) {
      showToast('请提供文字或图片内容', 'warning');
      return null;
    }

    var resp = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
      body: JSON.stringify({
        model: model, temperature: 0.3, max_tokens: 4096,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent }
        ]
      })
    });
    if (!resp.ok) {
      var errText = '';
      try { var errJson = JSON.parse(await resp.text()); errText = errJson.error && errJson.error.message ? errJson.error.message : ''; } catch (e) {}
      throw new Error('API 请求失败 (' + resp.status + ')' + (errText ? ': ' + errText : ''));
    }
    var data = await resp.json();
    var raw = data.choices[0].message.content;

    // 容错：尝试解析，失败则拆分多个 JSON 对象拼成数组
    try {
      JSON.parse(raw);
      return raw;
    } catch (e1) {
      try {
        var objects = [];
        var re = /\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g;
        var match;
        while ((match = re.exec(raw)) !== null) {
          try { objects.push(JSON.parse(match[0])); } catch (e2) {}
        }
        if (objects.length > 0) {
          return JSON.stringify(objects);
        }
      } catch (e3) {}
      return raw;
    }
  }

  /* 分类选择弹窗 */

  document.getElementById('btnCategoryConfirm').addEventListener('click', function () {
    var val = getCategoryPickerValue();
    if (!val) { showToast('请选择一个分类或输入自定义分类', 'error'); return; }
    document.getElementById('categoryModalOverlay').style.display = 'none';
    if (categoryResolve) { categoryResolve(val); categoryResolve = null; }
  });

  document.getElementById('btnCategorySkip').addEventListener('click', function () {
    document.getElementById('categoryModalOverlay').style.display = 'none';
    if (categoryResolve) { categoryResolve('__skip__'); categoryResolve = null; }
  });

  // 点击遮罩关闭分类弹窗
  document.getElementById('categoryModalOverlay').addEventListener('click', function (e) {
    if (e.target === this) {
      document.getElementById('categoryModalOverlay').style.display = 'none';
      if (categoryResolve) { categoryResolve('__skip__'); categoryResolve = null; }
    }
  });

  /* 智能匹配：优先归入已有 topic */
  function smartMatchTopic(subject, newTopic) {
    var data = loadData();
    if (!data[subject]) return null;
    var existing = Object.keys(data[subject]);
    // 1. 精确匹配
    if (existing.indexOf(newTopic) >= 0) return newTopic;
    // 2. 新 topic 包含某个已有 topic（如"期权定价"包含"期权"）
    for (var i = 0; i < existing.length; i++) {
      if (newTopic.indexOf(existing[i]) >= 0 && existing[i].length >= 2) return existing[i];
    }
    // 3. 已有 topic 包含新 topic（如已有"期权定价"，新的是"期权"）
    for (var i = 0; i < existing.length; i++) {
      if (existing[i].indexOf(newTopic) >= 0 && newTopic.length >= 2) return existing[i];
    }
    return null;
  }

  /* 知识点合并检查 */
  function checkTopicMerge(subject, topic) {
    var data = loadData();
    return (data[subject] && data[subject][topic]) ? true : false;
  }


  document.getElementById('btnMergeAppend').addEventListener('click', async function () {
    var p = mergeModalOverlay._pending;
    if (p) {
      var data = loadData();
      if (!data[p.subject][p.topic]) {
        data[p.subject][p.topic] = { items: [], parentTopic: p.parentTopic || null };
      } else if (p.parentTopic && !data[p.subject][p.topic].parentTopic) {
        data[p.subject][p.topic].parentTopic = p.parentTopic;
      }
      if (p.parentTopic && !data[p.subject][p.parentTopic]) {
        data[p.subject][p.parentTopic] = { items: [], parentTopic: null };
      }
      var now = new Date();
      var imageId = null;
      if (p.image) {
        imageId = p.subject + '|' + p.topic + '|' + now.getTime();
        await IMG_DB.put(imageId, p.image);
      }
      data[p.subject][p.topic].items.push({
        text: p.text, summary: p.summary,
        time: now.toLocaleString('zh-CN'), createdAt: now.toISOString(),
        reviewCount: 0, correctCount: 0,
        lastReviewed: null, nextReview: now.toISOString(),
        interval: 1, status: 'learning',
        imageId: imageId
      });
      saveData(data);
      renderKnowledgeTree();
      refreshMindmap();
      showToast('已追加到现有知识点', 'success');
    }
    hideMergeDialog();
  });

  document.getElementById('btnMergeNew').addEventListener('click', async function () {
    var p = mergeModalOverlay._pending;
    if (p) {
      var newTopic = p.topic + ' (分支)';
      await addKnowledge(p.text, p.subject, newTopic, p.summary, p.image || undefined, p.parentTopic || null, undefined);
      refreshMindmap();
      showToast('已创建新分支', 'success');
    }
    hideMergeDialog();
  });

  mergeModalOverlay.addEventListener('click', function (e) { if (e.target === mergeModalOverlay) hideMergeDialog(); });

  /* 知识点编辑 */
  var editPending = null;
  function openEditModal(subject, topic, index) {
    var data = loadData();
    var items = data[subject] && data[subject][topic] ? data[subject][topic].items : null;
    if (!items || !items[index]) return;
    var rec = items[index];
    editPending = { subject: subject, topic: topic, index: index };
    editSubject.value = subject;
    editTopic.value = topic;
    editSummary.value = rec.summary || '';
    editText.value = rec.text || '';
    editModalOverlay.style.display = 'flex';
  }
  function closeEditModal() {
    editModalOverlay.style.display = 'none';
    editPending = null;
  }

  document.getElementById('btnSaveEdit').addEventListener('click', function () {
    if (!editPending) return;
    var newSubject = editSubject.value.trim();
    var newTopic = editTopic.value.trim();
    var newSummary = editSummary.value.trim();
    var newText = editText.value.trim();
    if (!newSubject || !newTopic || !newSummary) { showToast('学科、知识点、总结不能为空', 'error'); return; }

    var data = loadData();
    var oldSubj = editPending.subject;
    var oldTopic = editPending.topic;
    var oldIdx = editPending.index;
    var items = data[oldSubj] && data[oldSubj][oldTopic] ? data[oldSubj][oldTopic].items : null;
    if (!items || !items[oldIdx]) { closeEditModal(); return; }
    var rec = items[oldIdx];
    rec.summary = newSummary;
    rec.text = newText;

    if (oldSubj !== newSubject || oldTopic !== newTopic) {
      items.splice(oldIdx, 1);
      if (items.length === 0) delete data[oldSubj][oldTopic];
      if (Object.keys(data[oldSubj]).length === 0) delete data[oldSubj];
      if (!data[newSubject]) data[newSubject] = {};
      if (!data[newSubject][newTopic]) data[newSubject][newTopic] = { items: [] };
      data[newSubject][newTopic].items.push(rec);
    }

    saveData(data);
    renderKnowledgeTree();
    refreshMindmap();
    closeEditModal();
    showToast('知识点已更新', 'success');
  });
  window.openEditModal = openEditModal;
  window.closeEditModal = closeEditModal;

  document.getElementById('btnCancelEdit').addEventListener('click', closeEditModal);
  editModalOverlay.addEventListener('click', function (e) { if (e.target === editModalOverlay) closeEditModal(); });

  /* ===== 分析按钮 ===== */
  btnAnalyze.addEventListener('click', async function () {
    var text = userInput.value.trim();
    var hasImage = currentImages.length > 0;

    if (!text && !hasImage) { showToast('请先输入学习内容或上传图片', 'error'); return; }

    if (hasImage) {
      var currentPlatform = getPlatformByUrl(getApiUrl());
      var currentModel = getModel();
      if (!isVisionModel(currentPlatform, currentModel)) {
        showToast('当前模型 ' + currentModel + ' 不支持图片识别，请切换到支持视觉的模型（如 qwen-vl-max、Qwen2-VL）', 'error');
        return;
      }
    }

    setLoading(true);
    try {
      var savedImages = currentImages.length ? currentImages.slice() : null;
      var result = await callDeepSeek(text || null, savedImages);
      clearImages();

      try {
        var parsed = JSON.parse(result);

        // 兼容 AI 可能返回的各种格式
        if (parsed.error) { showToast(parsed.error, 'error'); setLoading(false); return; }

        var items;
        if (Array.isArray(parsed)) {
          items = parsed;
        } else if (parsed.items && Array.isArray(parsed.items)) {
          items = parsed.items;  // 兼容 { items: [...], suggestedSubjects: [...] }
        } else if (Array.isArray(parsed[Object.keys(parsed)[0]])) {
          items = parsed[Object.keys(parsed)[0]];  // 兼容意外包裹
        } else {
          items = [parsed];
        }

        // 过滤掉无效条目
        items = items.filter(function (item) {
          return item && typeof item.topic === 'string' && item.topic.trim() !== ''
            && typeof item.subject === 'string' && item.subject.trim() !== '';
        });

        if (items.length === 0) {
          showToast('未能识别到有效知识点，请重试', 'error');
          setLoading(false);
          return;
        }

        items = deduplicateEntries(items, 0.85);
        var srcImage = (savedImages && savedImages.length) ? savedImages[0].base64 : undefined;
        var savedText = text || '';
        var firstImage = srcImage;

        // suggestedSubjects 兼容多种来源
        var suggestedSubjects = parsed.suggestedSubjects || [];
        // 过滤掉 null/空值
        suggestedSubjects = suggestedSubjects.filter(function (s) { return s && s !== 'null' && s !== 'undefined' && (s + '').trim() !== ''; });
        if (suggestedSubjects.length === 0 && items.length > 0 && items[0].subject) {
          suggestedSubjects = [items[0].subject];
        }

        // 确保有3个建议分类
        while (suggestedSubjects.length < 3) {
          var fallbacks = ['未分类', '通用知识', '学习笔记'];
          var fb = fallbacks[suggestedSubjects.length];
          if (suggestedSubjects.indexOf(fb) === -1) suggestedSubjects.push(fb);
        }

        // ★ 弹出分类选择框
        var firstItem = items[0];
        var chosenSubject = await showCategoryPicker(
          suggestedSubjects,
          firstItem.topic || '知识点',
          firstItem.summary || ''
        );

        if (chosenSubject === '__skip__' || !chosenSubject) chosenSubject = firstItem.subject || '未分类';

        var primarySubject = chosenSubject;

        for (var idx = 0; idx < items.length; idx++) {
          var item = items[idx];
          if (item.error) continue;
          var finalSubject = primarySubject;
          var itemImage = (idx === 0) ? firstImage : undefined;
          // 智能匹配：优先归入已有 topic
          var matchedTopic = smartMatchTopic(finalSubject, item.topic);
          if (matchedTopic) {
            // 归入已有 topic
            await addKnowledge(savedText, finalSubject, matchedTopic, item.summary, itemImage, item.parentTopic || null, {
              nodeType: item.nodeType,
              tags: item.tags,
              importance: item.importance
            });
            if (matchedTopic !== item.topic) {
              showToast('「' + item.topic + '」已自动归入「' + matchedTopic + '」', 'success');
            }
          } else if (checkTopicMerge(finalSubject, item.topic)) {
            await showMergeDialog(finalSubject, item.topic, item.summary, savedText, itemImage, item.parentTopic || null);
          } else {
            await addKnowledge(savedText, finalSubject, item.topic, item.summary, itemImage, item.parentTopic || null, {
              nodeType: item.nodeType,
              tags: item.tags,
              importance: item.importance
            });
          }
        }

        userInput.value = '';
        userInput.placeholder = '粘贴或输入你想整理的知识内容...';
        refreshMindmap();
        if (mindmapBody.classList.contains('collapsed')) {
          mindmapBody.classList.remove('collapsed');
          mindmapToggle.classList.remove('collapsed');
        }
        showToast('分析成功，知识库已更新！', 'success');

      } catch (e) {
        console.error('API 解析失败，原始返回:', result);
        var preview = typeof result === 'string' ? result.substring(0, 200) : String(result);
        showToast('API 返回格式异常: ' + (e.message || 'JSON 解析失败') + '。原始内容: ' + preview, 'error');
      }
    } catch (err) { showToast(err.message, 'error'); }
    finally { setLoading(false); }
  });

  /* ===== 复习板块 UI（维基百科风格） ===== */
  var reviewSession = { queue: [], done: 0, streak: 0, currentEntry: null, currentIndex: -1 }; window.reviewSession = reviewSession;

  /* DOM */
  var reviewDueCount   = document.getElementById('reviewDueCount');   window.reviewDueCount = reviewDueCount;
  var reviewDoneToday  = document.getElementById('reviewDoneToday');  window.reviewDoneToday = reviewDoneToday;
  var reviewStreak     = document.getElementById('reviewStreak');     window.reviewStreak = reviewStreak;
  var reviewMasteredCount = document.getElementById('reviewMasteredCount'); window.reviewMasteredCount = reviewMasteredCount;
  var reviewProgressFill = document.getElementById('reviewProgressFill'); window.reviewProgressFill = reviewProgressFill;
  var reviewEmpty      = document.getElementById('reviewEmpty');      window.reviewEmpty = reviewEmpty;
  var reviewComplete   = document.getElementById('reviewComplete');   window.reviewComplete = reviewComplete;
  var reviewWikiList   = document.getElementById('reviewWikiList');   window.reviewWikiList = reviewWikiList;
  var reviewCompleteStats = document.getElementById('reviewCompleteStats'); window.reviewCompleteStats = reviewCompleteStats;
  var wikiAnswerOverlay = document.getElementById('wikiAnswerOverlay'); window.wikiAnswerOverlay = wikiAnswerOverlay;
  var wikiAnswerTitle  = document.getElementById('wikiAnswerTitle');  window.wikiAnswerTitle = wikiAnswerTitle;
  var wikiAnswerSubtitle = document.getElementById('wikiAnswerSubtitle'); window.wikiAnswerSubtitle = wikiAnswerSubtitle;
  var wikiAnswerContent = document.getElementById('wikiAnswerContent'); window.wikiAnswerContent = wikiAnswerContent;

  document.getElementById('reviewDateLabel').textContent = new Date().toLocaleDateString('zh-CN',{year:'numeric',month:'long',day:'numeric',weekday:'long'});


  /* 事件绑定 */
  document.getElementById('btnWikiForgot').addEventListener('click', function () { answerReview(false); });
  document.getElementById('btnWikiRemember').addEventListener('click', function () { answerReview(true); });
  document.getElementById('btnWikiClose').addEventListener('click', closeWikiAnswer);
  wikiAnswerOverlay.addEventListener('click', function (e) { if (e.target === this) closeWikiAnswer(); });

  // 进入复习板块时自动加载
  var reviewTab = document.querySelector('[data-panel="reviewPanel"]');
  reviewTab.addEventListener('click', function () {
    loadReviewSession(); // 每次进入复习板块都重新加载，确保使用最新设置
    renderReviewList();
  });

  /* 复习卡片点击：事件委托 */
  reviewWikiList.addEventListener('click', function(e) {
    var card = e.target.closest('.review-wiki-card');
    if (!card) return;
    var index = parseInt(card.getAttribute('data-review-index'));
    if (isNaN(index)) return;
    if (reviewSession.queue[index] && reviewSession.queue[index]._done) return;
    openWikiAnswer(index);
  });

  /* 知识库点击：事件委托（树状 + 搜索结果） */
  knowledgeTree.addEventListener('click', function(e) {
    var el = e.target.closest('[data-subject][data-topic][data-idx]');
    if (!el) return;
    var subject = el.getAttribute('data-subject');
    var topic = el.getAttribute('data-topic');
    var idx = parseInt(el.getAttribute('data-idx'));
    if (!subject || !topic || isNaN(idx)) return;
    openDetailPage(subject, topic, idx);
  });

  /* 详情页关联知识点击：事件委托 */
  document.getElementById('detailBody').addEventListener('click', function(e) {
    var el = e.target.closest('.related-link-item');
    if (!el) return;
    var subject = el.getAttribute('data-subject');
    var topic = el.getAttribute('data-topic');
    var idx = parseInt(el.getAttribute('data-idx'));
    if (!subject || !topic || isNaN(idx)) return;
    openDetailPage(subject, topic, idx);
  });

  updateFeedbackLink();

  /* 存量数据自动检测层级（只执行一次） */
  function autoDetectHierarchy(data) {
    var changed = false;
    for (var s in data) {
      var topics = Object.keys(data[s]);
      topics.sort(function (a, b) { return a.length - b.length; });
      for (var i = 0; i < topics.length; i++) {
        if (data[s][topics[i]].parentTopic) continue;
        for (var j = 0; j < i; j++) {
          var shorter = topics[j];
          var longer = topics[i];
          if (longer.indexOf(shorter) !== -1 && longer.length - shorter.length >= 1) {
            data[s][longer].parentTopic = shorter;
            if (!data[s][shorter].parentTopic && data[s][shorter].parentTopic !== null) {
              data[s][shorter].parentTopic = null;
            }
            changed = true;
            break;
          }
        }
      }
    }
    if (changed) saveData(data);
    return changed;
  }

  /* ===== AI 深度分析 ===== */

  async function aiAnalyzeTopic(subject, topic) {
    var data = loadData();
    if (!data[subject] || !data[subject][topic]) return;
    var items = data[subject][topic].items || [];
    var allText = items.map(function (item) { return item.text || item.summary; }).join('\n\n');
    if (!allText.trim()) { showToast('该知识点暂无详细内容', 'error'); return; }

    var btn = document.querySelector('.btn-ai-analyze[data-subject="' + subject + '"][data-topic="' + topic + '"]');
    if (btn) { btn.disabled = true; btn.textContent = '⏳'; }

    try {
      var result = await callDeepSeek('请对这个知识点进行深度分析：\n' + allText, null, true);
      showAnalyzeResult(topic, result);
    } catch (err) {
      showToast('AI 分析失败: ' + err.message, 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '🤖'; }
    }
  }

  document.addEventListener('click', function (e) {
    if (e.target.classList.contains('btn-ai-analyze')) {
      e.stopPropagation();
      aiAnalyzeTopic(e.target.dataset.subject, e.target.dataset.topic);
    }
  });

  document.getElementById('btnCloseAnalyze').addEventListener('click', function () {
    document.getElementById('analyzeOverlay').style.display = 'none';
  });
  document.getElementById('btnCopyAnalyze').addEventListener('click', function () {
    var text = document.getElementById('analyzeContent').innerText;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(function () { showToast('已复制', 'success'); });
    }
  });
  document.getElementById('analyzeOverlay').addEventListener('click', function (e) {
    if (e.target === this) this.style.display = 'none';
  });

  /* 初始化 */
  (async function initApp() {
    if (!window.indexedDB) {
      console.warn('KnowLeaf: IndexedDB 不可用，图片功能将受限');
    }
    var data = loadData();
    // 如果 localStorage 为空，尝试从 IndexedDB 恢复
    if (Object.keys(data).length === 0) {
      var recovered = await recoverFromIndexedDB();
      if (Object.keys(recovered).length > 0) {
        data = recovered;
        showToast('已从本地备份恢复数据', 'success');
      }
    }
    await migrateLegacyImages(data);
    autoDetectHierarchy(data);
    renderKnowledgeTree();
    refreshMindmap();
  })();


  document.getElementById('detailBack').addEventListener('click', closeDetailPage);
  document.getElementById('detailOverlay').addEventListener('click', function (e) {
    if (e.target === this) closeDetailPage();
  });
  document.getElementById('detailPrev').addEventListener('click', function () {
    if (detailNavIndex <= 0) return;
    detailNavIndex--;
    var item = detailNavItems[detailNavIndex];
    if (!item) return;
    var data = loadData();
    var rec = data[item.subject][item.topic].items[item.idx];
    if (!rec) return;
    renderDetailPage(rec, item.subject, item.topic, item.idx);
    document.getElementById('detailBody').scrollTop = 0;
  });
  document.getElementById('detailNext').addEventListener('click', function () {
    if (detailNavIndex >= detailNavItems.length - 1) return;
    detailNavIndex++;
    var item = detailNavItems[detailNavIndex];
    if (!item) return;
    var data = loadData();
    var rec = data[item.subject][item.topic].items[item.idx];
    if (!rec) return;
    renderDetailPage(rec, item.subject, item.topic, item.idx);
    document.getElementById('detailBody').scrollTop = 0;
  });


  window.addEventListener('resize', function () {
    var networkPanel = document.getElementById('subpanelNetwork');
    if (networkPanel && networkPanel.style.display !== 'none') {
      resizeNetworkGraph();
    }
  });

  // === 关系网络事件绑定 ===
  document.getElementById('networkSearch').addEventListener('input', function () {
    var keyword = this.value.trim().toLowerCase();
    if (!networkSvgSel) return;

    networkSvgSel.selectAll('circle')
      .attr('opacity', function (d) {
        if (!keyword) return 0.9;
        var match = d.name.toLowerCase().indexOf(keyword) !== -1
                 || d.fullText.toLowerCase().indexOf(keyword) !== -1
                 || (d.tags || []).some(function (t) { return t.toLowerCase().indexOf(keyword) !== -1; });
        return match ? 1 : 0.15;
      })
      .attr('r', function (d) {
        if (!keyword) return getNodeRadius(d.importance, 0);
        var match = d.name.toLowerCase().indexOf(keyword) !== -1
                 || d.fullText.toLowerCase().indexOf(keyword) !== -1;
        return match ? getNodeRadius(d.importance, 0) * 1.5 : getNodeRadius(d.importance, 0) * 0.7;
      });

    networkSvgSel.selectAll('line')
      .attr('stroke-opacity', function () {
        return keyword ? 0.1 : 0.6;
      });
  });

  document.getElementById('btnNetworkFit').addEventListener('click', function () {
    if (!networkSvgSel) return;
    networkSvgSel.transition().duration(500).call(
      d3.zoom().transform, d3.zoomIdentity
    );
    if (networkSimulation) {
      networkSimulation.alpha(1).restart();
    }
    networkSvgSel.selectAll('circle').attr('opacity', 0.9).attr('r', function (d) { return getNodeRadius(d.importance, 0); });
    networkSvgSel.selectAll('line').attr('stroke-opacity', 0.6);
    document.getElementById('networkSearch').value = '';
  });

  document.getElementById('btnCloseDetail').addEventListener('click', function () {
    document.getElementById('networkDetailCard').style.display = 'none';
  });

  // === 二级 Tab 切换 ===
  var learnSubtabs = document.querySelectorAll('.learn-subtab');
  learnSubtabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      var panelId = this.getAttribute('data-subpanel');
      learnSubtabs.forEach(function (t) { t.classList.remove('active'); });
      this.classList.add('active');
      // 显示/隐藏子面板
      document.getElementById('subpanelLearn').style.display = (panelId === 'subpanelLearn') ? 'block' : 'none';
      document.getElementById('subpanelNetwork').style.display = (panelId === 'subpanelNetwork') ? 'block' : 'none';
      // 关系网络初始化
      if (panelId === 'subpanelNetwork') {
        if (!networkSimulation) {
          initNetworkGraph();
        } else {
          setTimeout(function () { resizeNetworkGraph(); }, 100);
        }
      }
    });
  });
