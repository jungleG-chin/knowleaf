// KnowLeaf 知叶 — 数据层
// 包含：存储、复习配置、艾宾浩斯算法、数据增删改查

  const LS_KEY   = 'knowleaf_apikey';
  const URL_KEY  = 'knowleaf_api_url';
  const MODEL_KEY = 'knowleaf_model';
  const DATA_KEY = 'knowleaf_data';
  const REVIEW_CONFIG_KEY = 'knowleaf_review_config';

  /* ===== IndexedDB 图片存储 ===== */
  var IMG_DB = { _db: null };
  IMG_DB.open = function () {
    return new Promise(function (resolve, reject) {
      if (IMG_DB._db) return resolve(IMG_DB._db);
      var req = indexedDB.open('knowleaf_images', 1);
      req.onupgradeneeded = function (e) {
        if (!e.target.result.objectStoreNames.contains('images')) {
          e.target.result.createObjectStore('images');
        }
      };
      req.onsuccess = function (e) { IMG_DB._db = e.target.result; resolve(IMG_DB._db); };
      req.onerror = function (e) { reject(e.target.error); };
    });
  };
  IMG_DB.put = function (key, base64) {
    return IMG_DB.open().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction('images', 'readwrite');
        tx.objectStore('images').put(base64, key);
        tx.oncomplete = resolve;
        tx.onerror = function (e) { reject(e.target.error); };
      });
    });
  };
  IMG_DB.get = function (key, timeoutMs) {
    timeoutMs = timeoutMs || 5000;
    return IMG_DB.open().then(function (db) {
      return new Promise(function (resolve, reject) {
        var timer = setTimeout(function () { reject(new Error('timeout')); }, timeoutMs);
        var req = db.transaction('images', 'readonly').objectStore('images').get(key);
        req.onsuccess = function () { clearTimeout(timer); resolve(req.result); };
        req.onerror = function (e) { clearTimeout(timer); reject(e.target.error); };
      });
    });
  };
  IMG_DB.del = function (key) {
    return IMG_DB.open().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction('images', 'readwrite');
        tx.objectStore('images').delete(key);
        tx.oncomplete = resolve;
        tx.onerror = function (e) { reject(e.target.error); };
      });
    });
  };
  IMG_DB.clearAll = function () {
    return IMG_DB.open().then(function (db) {
      return new Promise(function (resolve) {
        var tx = db.transaction('images', 'readwrite');
        tx.objectStore('images').clear();
        tx.oncomplete = resolve;
      });
    });
  };

  // 全量数据备份到 IndexedDB（双存储）
  var DATA_BACKUP_KEY = '__knowleaf_data_backup__';
  IMG_DB.saveDataBackup = function (data) {
    return IMG_DB.put(DATA_BACKUP_KEY, JSON.stringify(data)).catch(function () {});
  };
  IMG_DB.loadDataBackup = function () {
    return IMG_DB.get(DATA_BACKUP_KEY).then(function (raw) {
      if (raw) {
        try { return JSON.parse(raw); } catch (e) { return null; }
      }
      return null;
    }).catch(function () { return null; });
  };

  /* 艾宾浩斯遗忘曲线间隔（天） */
  var EBBINGHAUS_INTERVALS = [1, 2, 4, 7, 15, 30, 90];

  /* 默认复习配置 */
  function getReviewConfig() {
    try { var raw = localStorage.getItem(REVIEW_CONFIG_KEY); return raw ? JSON.parse(raw) : {}; } catch (e) { return {}; }
  }
  function saveReviewConfig(cfg) { localStorage.setItem(REVIEW_CONFIG_KEY, JSON.stringify(cfg)); }
  function getDailyLimit() { return getReviewConfig().dailyLimit || 20; }
  function getAutoArchive() { return getReviewConfig().autoArchive !== false; }

  /* 数据迁移：旧格式数组 → 新格式 { items: [...] } */
  function migrateData(data) {
    var migrated = false;
    Object.keys(data).forEach(function (subj) {
      Object.keys(data[subj]).forEach(function (topic) {
        var val = data[subj][topic];
        if (Array.isArray(val)) {
          migrated = true;
          var items = val.map(function (rec) {
            return {
              text: rec.text || '',
              summary: rec.summary || '',
              time: rec.time || new Date().toLocaleString('zh-CN'),
              createdAt: rec.createdAt || toISODate(rec.time) || new Date().toISOString(),
              reviewCount: rec.reviewCount || 0,
              correctCount: rec.correctCount || 0,
              lastReviewed: rec.lastReviewed || null,
              nextReview: rec.nextReview || new Date().toISOString(),
              interval: rec.interval || 1,
              status: rec.status || 'learning'
            };
          });
          data[subj][topic] = { items: items, parentTopic: null };
        }
      });
    });
    if (migrated) saveData(data);
    return data;
  }

  function toISODate(timeStr) {
    try { return new Date(timeStr).toISOString(); } catch (e) { return null; }
  }

  /* 艾宾浩斯算法核心 */
  function getNextInterval(correctCount) {
    if (correctCount >= EBBINGHAUS_INTERVALS.length) return EBBINGHAUS_INTERVALS[EBBINGHAUS_INTERVALS.length - 1];
    return EBBINGHAUS_INTERVALS[correctCount];
  }

  function applyReviewResult(subject, topic, itemIndex, correct) {
    var data = loadData();
    if (!data[subject] || !data[subject][topic]) return;
    var items = data[subject][topic].items;
    if (!items || !items[itemIndex]) return;
    var item = items[itemIndex];
    item.reviewCount = (item.reviewCount || 0) + 1;
    if (correct) {
      item.correctCount = (item.correctCount || 0) + 1;
      item.interval = getNextInterval(item.correctCount);
      if (item.correctCount >= 7) {
        item.status = 'mastered';
      } else {
        item.status = 'reviewing';
      }
    } else {
      item.correctCount = 0;
      item.interval = 1;
      item.status = 'learning';
    }
    item.lastReviewed = new Date().toISOString();
    var next = new Date();
    next.setDate(next.getDate() + item.interval);
    item.nextReview = next.toISOString();
    saveData(data);
  }

  /* 获得到期复习的条目 */
  function getDueReviews(data) {
    var due = [];
    var now = new Date();
    Object.keys(data).forEach(function (subj) {
      Object.keys(data[subj]).forEach(function (topic) {
        var items = data[subj][topic].items;
        if (!items) return;
        items.forEach(function (item, idx) {
          if (item.status === 'mastered') return;
          if (item.nextReview && new Date(item.nextReview) <= now) {
            due.push({ subject: subj, topic: topic, index: idx, item: item });
          }
        });
      });
    });
    return due;
  }

  /* 获取复习统计 */
  function getReviewStats(data) {
    var total = 0, mastered = 0, reviewedToday = 0;
    var today = new Date().toISOString().slice(0, 10);
    Object.keys(data).forEach(function (subj) {
      Object.keys(data[subj]).forEach(function (topic) {
        var items = data[subj][topic].items;
        if (!items) return;
        items.forEach(function (item) {
          total++;
          if (item.status === 'mastered') mastered++;
          if (item.lastReviewed && item.lastReviewed.slice(0, 10) === today) reviewedToday++;
        });
      });
    });
    var due = getDueReviews(data).length;
    return { total: total, mastered: mastered, reviewedToday: reviewedToday, due: due };
  }

  /* 知识库数据 */
  function loadData() {
    try { var raw = localStorage.getItem(DATA_KEY); var data = raw ? JSON.parse(raw) : null; if (data) return migrateData(data); }
    catch (e) {}
    return {};
  }
  // 从 IndexedDB 恢复数据（localStorage 丢失时调用）
  async function recoverFromIndexedDB() {
    var backup = await IMG_DB.loadDataBackup();
    if (backup && Object.keys(backup).length > 0) {
      backup = migrateData(backup);
      saveData(backup);
      return backup;
    }
    return {};
  }

  // 将旧 record.image (base64) 迁移到 IndexedDB（仅在初始化时调用一次）
  async function migrateLegacyImages(data) {
    var migrated = false;
    for (var s in data) {
      for (var t in data[s]) {
        var items = data[s][t].items;
        if (!items) continue;
        for (var i = 0; i < items.length; i++) {
          if (items[i].image && !items[i].imageId) {
            var imageId = s + '|' + t + '|' + Date.now() + '_' + i + '_' + Math.random().toString(36).slice(2, 6);
            try {
              await IMG_DB.put(imageId, items[i].image);
              items[i].imageId = imageId;
              delete items[i].image;
              migrated = true;
            } catch (e) {}
          }
        }
      }
    }
    if (migrated) {
      saveData(data);
    }
  }
  function saveData(data) {
    var json = JSON.stringify(data);
    localStorage.setItem(DATA_KEY, json);
    // 异步备份到 IndexedDB（静默失败，不影响主流程）
    IMG_DB.saveDataBackup(data);
  }

  async function deleteRecord(subject, topic, index) {
    var data = loadData();
    if (!data[subject] || !data[subject][topic]) return;
    var items = data[subject][topic].items;
    if (!items) return;
    var rec = items[index];
    if (rec && rec.imageId) {
      try { await IMG_DB.del(rec.imageId); } catch (e) {}
    }

    // P3: 清理所有引用此条目的 references
    Object.keys(data).forEach(function (s) {
      Object.keys(data[s]).forEach(function (t) {
        (data[s][t].items || []).forEach(function (r) {
          if (r.references && r.references.length > 0) {
            r.references = r.references.filter(function (ref) {
              return !(ref.targetSubject === subject && ref.targetTopic === topic && ref.targetIndex === index);
            });
            // 调整大于此 index 的引用
            r.references.forEach(function (ref) {
              if (ref.targetSubject === subject && ref.targetTopic === topic && ref.targetIndex > index) {
                ref.targetIndex--;
              }
            });
          }
        });
      });
    });

    items.splice(index, 1);
    if (items.length === 0) delete data[subject][topic];
    if (Object.keys(data[subject]).length === 0) delete data[subject];
    saveData(data);
    renderKnowledgeTree();
    refreshMindmap();
  }

  // 删除整个学科
  async function deleteSubject(subject) {
    var data = loadData();
    if (!data[subject]) return;
    // 删除所有图片（IndexedDB）
    Object.keys(data[subject]).forEach(function (topic) {
      var items = data[subject][topic].items || [];
      items.forEach(function (rec) {
        if (rec.imageId) IMG_DB.del(rec.imageId).catch(function(){});
      });
    });
    delete data[subject];
    saveData(data);
    renderKnowledgeTree();
    refreshMindmap();
    showToast('已删除学科「' + subject + '」', 'success');
  }

  async function exportData() {
    showToast('正在生成导出文件...', 'success');
    // 深克隆数据（不污染原数据！）
    var raw = loadData();
    var data = JSON.parse(JSON.stringify(raw));
    var date = new Date().toISOString().slice(0, 10);

    // 只在克隆数据里嵌入图片，原数据不动
    for (var s in data) {
      for (var t in data[s]) {
        var items = data[s][t].items;
        if (!items) continue;
        for (var i = 0; i < items.length; i++) {
          if (items[i].imageId) {
            try { items[i].image = await IMG_DB.get(items[i].imageId) || null; } catch (e) { items[i].image = null; }
            delete items[i].imageId;
          }
        }
      }
    }

    var exportData = { data: data, feedbacks: getFeedbacks(), exportedAt: new Date().toISOString() };
    var json = JSON.stringify(exportData, null, 2);
    var zip = new JSZip();
    zip.file('knowleaf_backup_' + date + '.json', json);

    var hasPdf = false;
    try {
      var pdfBlob = await generateMindmapPDF(raw);
      if (pdfBlob) { zip.file('knowleaf_mindmap_' + date + '.pdf', pdfBlob); hasPdf = true; }
    } catch (e) { console.warn('PDF生成失败', e); }

    var zipBlob = await zip.generateAsync({ type: 'blob' });
    downloadBlob(zipBlob, 'knowleaf_export_' + date + '.zip');
    localStorage.setItem('knowleaf_last_backup', new Date().toISOString());
    showToast(hasPdf ? '导出完成（JSON + PDF）' : '导出完成（仅JSON）', 'success');
  }

  async function importData(file) {
    var reader = new FileReader();
    reader.onload = async function (e) {
      try {
        var imported = JSON.parse(e.target.result);
        if (typeof imported !== 'object' || Array.isArray(imported)) throw new Error('格式错误');
        imported = migrateData(imported);
        if (!confirm('即将导入 ' + countRecords(imported) + ' 条记录，与现有数据合并。确定？')) return;
        // 将 base64 图片写入 IndexedDB，转为 imageId
        for (var s in imported) {
          for (var t in imported[s]) {
            var items = imported[s][t].items;
            if (!items) continue;
            for (var i = 0; i < items.length; i++) {
              if (items[i].image) {
                var imageId = s + '|' + t + '|' + Date.now() + '_' + i;
                await IMG_DB.put(imageId, items[i].image);
                items[i].imageId = imageId;
                delete items[i].image;
              }
            }
          }
        }
        var existing = loadData();
        Object.keys(imported).forEach(function (s) {
          if (!existing[s]) existing[s] = {};
          Object.keys(imported[s]).forEach(function (t) {
            if (!existing[s][t]) existing[s][t] = { items: [] };
            var importedItems = imported[s][t].items || [];
            existing[s][t].items = existing[s][t].items.concat(importedItems);
          });
        });
        saveData(existing);
        renderKnowledgeTree();
        refreshMindmap();
        showToast('导入成功', 'success');
      } catch (err) { showToast('导入失败：格式不正确', 'error'); }
    };
    reader.readAsText(file);
    importFileInput.value = '';
  }

  /* 学科颜色标签 */

  function getTodayStr() { return new Date().toISOString().slice(0, 10); }

  function getTodayReviewState() {
    var today = getTodayStr();
    var saved = localStorage.getItem('knowleaf_review_state_' + today);
    return saved ? JSON.parse(saved) : { total: 0, done: 0, doneIds: [], forgotIds: [] };
  }
  function saveTodayReviewState(state) {
    localStorage.setItem('knowleaf_review_state_' + getTodayStr(), JSON.stringify(state));
  }

  function loadDailyStreak() {
    var lastDate = localStorage.getItem('knowleaf_review_last_date') || '';
    var streak = parseInt(localStorage.getItem('knowleaf_review_streak') || '0', 10);
    var today = getTodayStr();
    if (lastDate === today) return streak;
    var yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (lastDate === yesterday.toISOString().slice(0, 10)) return streak;
    return 0;
  }

  function saveDailyStreak(streak) {
    localStorage.setItem('knowleaf_review_streak', streak);
    localStorage.setItem('knowleaf_review_last_date', getTodayStr());
  }

