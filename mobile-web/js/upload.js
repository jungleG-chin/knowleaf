// KnowLeaf 知叶 — 图片上传 + 分类选择 + 合并弹窗 + 分析展示

  function buildContent(text, images) {
    var parts = [];
    if (images) {
      var imageList = Array.isArray(images) ? images : [images];
      imageList.forEach(function (img) {
        var url = typeof img === 'string' ? img : (img && img.base64);
        if (url) parts.push({ type: 'image_url', image_url: { url: url } });
      });
    }
    if (text) {
      parts.push({ type: 'text', text: text });
    }
    return parts.length > 0 ? parts : null;
  }

  /* ===== 图片上传 ===== */
  var currentImages = [];  // [{ base64: 'data:...', name: 'xxx.jpg' }]

  function pickImage(capture) {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    if (capture) input.setAttribute('capture', 'environment');
    input.onchange = function () {
      var files = Array.from(this.files || []);
      if (!files.length) return;
      var validFiles = files.filter(function (f) {
        return f.type.match(/image\/(jpeg|png|webp|gif)/);
      });
      if (!validFiles.length) { showToast('请选择图片文件', 'error'); return; }
      if (validFiles.length < files.length) {
        showToast('已过滤 ' + (files.length - validFiles.length) + ' 个非图片文件', 'warning');
      }
      var processed = 0;
      validFiles.forEach(function (file) {
        var reader = new FileReader();
        reader.onload = function (e) {
          var base64 = e.target.result;
          if (base64.length > 512 * 1024) {
            compressImage(base64, 512, function (compressed) {
              currentImages.push({ base64: compressed, name: file.name });
              processed++;
              if (processed === validFiles.length) onAllImagesLoaded();
            });
          } else {
            currentImages.push({ base64: base64, name: file.name });
            processed++;
            if (processed === validFiles.length) onAllImagesLoaded();
          }
        };
        reader.readAsDataURL(file);
      });
    };
    input.click();
  }

  async function onAllImagesLoaded() {
    var beforeCount = currentImages.length;
    currentImages = await deduplicateImages(currentImages, 0.92);
    showAllPreviews();
    if (beforeCount === currentImages.length) {
      showToast('已加载 ' + currentImages.length + ' 张图片', 'success');
    }
  }

  // 感知哈希：将图片缩放为 8x8 灰度图，生成 64 位哈希
  function computePHash(base64) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () {
        var canvas = document.createElement('canvas');
        canvas.width = 8;
        canvas.height = 8;
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, 8, 8);
        var data = ctx.getImageData(0, 0, 8, 8).data;
        var grays = [];
        var sum = 0;
        for (var i = 0; i < data.length; i += 4) {
          var gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
          grays.push(gray);
          sum += gray;
        }
        var avg = sum / 64;
        var hash = '';
        for (var j = 0; j < 64; j++) {
          hash += grays[j] >= avg ? '1' : '0';
        }
        resolve(hash);
      };
      img.onerror = function () { resolve(null); };
      img.src = base64;
    });
  }

  function hammingDistance(h1, h2) {
    if (!h1 || !h2 || h1.length !== h2.length) return 64;
    var dist = 0;
    for (var i = 0; i < h1.length; i++) {
      if (h1[i] !== h2[i]) dist++;
    }
    return dist;
  }

  // 图片层去重：返回去重后的图片数组
  async function deduplicateImages(images, threshold) {
    if (!images || images.length <= 1) return images;
    threshold = threshold || 0.9;
    var hashes = await Promise.all(images.map(function (img) {
      return computePHash(img.base64);
    }));
    var keep = [];
    var removed = 0;
    for (var i = 0; i < images.length; i++) {
      var isDup = false;
      for (var j = 0; j < keep.length; j++) {
        var sim = 1 - hammingDistance(hashes[i], hashes[keep[j].origIdx]) / 64;
        if (sim >= threshold) {
          isDup = true;
          removed++;
          break;
        }
      }
      if (!isDup) {
        keep.push({ origIdx: i, hash: hashes[i] });
      }
    }
    var result = keep.map(function (k) { return images[k.origIdx]; });
    if (removed > 0) {
      showToast('已自动过滤 ' + removed + ' 张重复图片', 'info');
    }
    return result;
  }

  function showAllPreviews() {
    imagePreviewArea.style.display = 'block';
    imagePreviewContainer.innerHTML = '';
    currentImages.forEach(function (img, i) {
      var wrapper = document.createElement('div');
      wrapper.style.cssText = 'position:relative;display:inline-block;margin:4px;';
      var el = document.createElement('img');
      el.src = img.base64;
      el.style.cssText = 'width:80px;height:80px;object-fit:cover;border-radius:6px;border:1px solid #ddd;';
      var del = document.createElement('span');
      del.textContent = '✕';
      del.style.cssText = 'position:absolute;top:-6px;right:-6px;width:20px;height:20px;border-radius:50%;background:#ef4444;color:#fff;font-size:12px;display:flex;align-items:center;justify-content:center;cursor:pointer;';
      del.onclick = function () { removeImage(i); };
      wrapper.appendChild(el);
      wrapper.appendChild(del);
      imagePreviewContainer.appendChild(wrapper);
    });
  }

  function removeImage(index) {
    currentImages.splice(index, 1);
    if (currentImages.length === 0) {
      clearImages();
    } else {
      showAllPreviews();
    }
  }

  function clearImages() {
    currentImages = [];
    imagePreviewContainer.innerHTML = '';
    imagePreviewArea.style.display = 'none';
  }

  btnPickImage.addEventListener('click', function () { pickImage(false); });
  btnTakePhoto.addEventListener('click', function () { pickImage(true); });
  btnRemoveImage.addEventListener('click', clearImages);

  // Jaccard 文本相似度：分词后交集/并集
  function textSimilarity(a, b) {
    if (!a || !b) return 0;
    var tokenize = function (s) {
      var tokens = [];
      var word = '';
      for (var i = 0; i < s.length; i++) {
        var ch = s[i];
        if (/[一-鿿\w]/.test(ch)) {
          word += ch;
        } else {
          if (word.length >= 2) tokens.push(word);
          word = '';
        }
      }
      if (word.length >= 2) tokens.push(word);
      return tokens;
    };
    var ta = tokenize(a);
    var tb = tokenize(b);
    if (!ta.length || !tb.length) return 0;
    var setA = {};
    var setB = {};
    ta.forEach(function (t) { setA[t] = true; });
    tb.forEach(function (t) { setB[t] = true; });
    var intersection = 0;
    var union = 0;
    var keys = {};
    for (var k in setA) keys[k] = true;
    for (var k in setB) keys[k] = true;
    for (var k in keys) {
      if (setA[k] && setB[k]) { intersection++; union++; }
      else { union++; }
    }
    return intersection / union;
  }

  // 文本层去重：对知识点条目数组做相似度去重
  function deduplicateEntries(entries, threshold) {
    if (!entries || entries.length <= 1) return entries;
    threshold = threshold || 0.85;
    var result = [];
    for (var i = 0; i < entries.length; i++) {
      var entry = entries[i];
      var isDup = false;
      for (var j = 0; j < result.length; j++) {
        var titleSim = textSimilarity(entry.summary || '', result[j].summary || '');
        var contentSim = textSimilarity(entry.content || '', result[j].content || '');
        if (titleSim >= threshold || contentSim >= threshold) {
          isDup = true;
          break;
        }
      }
      if (!isDup) result.push(entry);
    }
    if (result.length < entries.length) {
      showToast('已自动合并 ' + (entries.length - result.length) + ' 条重复内容', 'info');
    }
    return result;
  }


  var categoryResolve = null;
  var categorySelectedSubject = null;

  function showCategoryPicker(suggestedSubjects, topic, summary) {
    return new Promise(function (resolve) {
      categoryResolve = resolve;
      categorySelectedSubject = null;
      document.getElementById('categoryHint').textContent = '知识点：' + topic + ' — ' + (summary || '');
      var optsEl = document.getElementById('categoryOptions');
      var icons = ['📚', '🔬', '💡'];
      var html = '';
      for (var i = 0; i < suggestedSubjects.length; i++) {
        html += '<button class="category-chip" data-subject="' + escHtml(suggestedSubjects[i]) + '"><span class="chip-icon">' + (icons[i] || '📌') + '</span>' + escHtml(suggestedSubjects[i]) + (i === 0 ? ' ⭐推荐' : '') + '</button>';
      }
      optsEl.innerHTML = html;
      document.getElementById('categoryCustomInput').value = '';
      document.getElementById('btnCategoryConfirm').disabled = true;

      // 点击分类chip
      optsEl.querySelectorAll('.category-chip').forEach(function (chip) {
        chip.addEventListener('click', function () {
          optsEl.querySelectorAll('.category-chip').forEach(function (c) { c.classList.remove('selected'); });
          chip.classList.add('selected');
          categorySelectedSubject = chip.dataset.subject;
          document.getElementById('btnCategoryConfirm').disabled = false;
        });
      });

      // 自定义输入
      var customInput = document.getElementById('categoryCustomInput');
      customInput.addEventListener('input', function () {
        if (this.value.trim()) {
          optsEl.querySelectorAll('.category-chip').forEach(function (c) { c.classList.remove('selected'); });
          categorySelectedSubject = null;
          document.getElementById('btnCategoryConfirm').disabled = false;
        } else if (!categorySelectedSubject) {
          document.getElementById('btnCategoryConfirm').disabled = true;
        }
      });

      document.getElementById('categoryModalOverlay').style.display = 'flex';
    });
  }

  function hideCategoryPicker() {
    document.getElementById('categoryModalOverlay').style.display = 'none';
  }

  function getCategoryPickerValue() {
    if (categorySelectedSubject) return categorySelectedSubject;
    var customVal = document.getElementById('categoryCustomInput').value.trim();
    return customVal || null;
  }

  var mergeResolve = null;
  function showMergeDialog(subject, topic, summary, text, imageBase64, parentTopic) {
    return new Promise(function (resolve) {
      mergeResolve = resolve;
      mergeTopicName.textContent = topic + '（' + subject + '）';
      mergeModalOverlay.style.display = 'flex';
      mergeModalOverlay._pending = { subject: subject, topic: topic, summary: summary, text: text, image: imageBase64 || null, parentTopic: parentTopic || null };
    });
  }
  function hideMergeDialog() {
    mergeModalOverlay.style.display = 'none';
    if (mergeResolve) { mergeResolve(null); mergeResolve = null; }
  }

  function showAnalyzeResult(title, content) {
    document.getElementById('analyzeTitle').textContent = '🤖 ' + title;
    var html = content
      .replace(/### (.*)/g, '<h4>$1</h4>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/^- (.*)/gm, '<li>$1</li>')
      .replace(/\n/g, '<br>');
    document.getElementById('analyzeContent').innerHTML = html;
    document.getElementById('analyzeOverlay').style.display = 'flex';
  }

