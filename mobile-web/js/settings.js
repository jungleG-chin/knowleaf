// KnowLeaf 知叶 — API配置 + 设置面板 + UI工具

  /* 平台预设 */
  var PLATFORM_PRESETS = {
    deepseek: {
      url: 'https://api.deepseek.com/chat/completions',
      defaultModel: 'deepseek-chat',
      models: ['deepseek-chat', 'deepseek-reasoner'],
      visionModels: []
    },
    siliconflow: {
      url: 'https://api.siliconflow.cn/v1/chat/completions',
      defaultModel: 'Qwen/Qwen2.5-72B-Instruct',
      models: ['Qwen/Qwen2.5-72B-Instruct', 'Qwen/Qwen2-VL-72B-Instruct', 'Qwen/Qwen2.5-7B-Instruct', 'deepseek-ai/DeepSeek-V3'],
      visionModels: ['Qwen/Qwen2-VL-72B-Instruct']
    },
    aliyun: {
      url: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
      defaultModel: 'qwen-vl-max',
      models: ['qwen-vl-max', 'qwen-vl-plus', 'qwen-max', 'qwen-plus', 'qwen-turbo'],
      visionModels: ['qwen-vl-max', 'qwen-vl-plus']
    },
    groq: {
      url: 'https://api.groq.com/openai/v1/chat/completions',
      defaultModel: 'llama-3.3-70b-versatile',
      models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
      visionModels: []
    }
  };

  function getPlatformByUrl(url) {
    var keys = Object.keys(PLATFORM_PRESETS);
    for (var i = 0; i < keys.length; i++) {
      if (PLATFORM_PRESETS[keys[i]].url === url) return keys[i];
    }
    return 'custom';
  }

  /* 判断模型是否支持视觉 */
  function isVisionModel(platform, model) {
    if (!model) return false;
    if (platform === 'custom') {
      // 自定义平台靠关键词检测
      var kw = ['vl', 'vision', 'gpt-4o', 'claude-3', 'gemini', 'pixtral', 'multimodal'];
      var lower = model.toLowerCase();
      for (var k = 0; k < kw.length; k++) {
        if (lower.indexOf(kw[k]) !== -1) return true;
      }
      return false;
    }
    var preset = PLATFORM_PRESETS[platform];
    if (preset && preset.visionModels) {
      return preset.visionModels.indexOf(model) !== -1;
    }
    return false;
  }

  /* 渲染模型下拉框 */
  function renderModelSelect(platform, selectEl, savedModel) {
    var preset = PLATFORM_PRESETS[platform];
    selectEl.innerHTML = '';
    if (preset) {
      // 已知平台：用 models 数组填充下拉框
      selectEl.style.display = '';
      var models = preset.models.slice();
      // 如果用户之前保存的模型不在列表中，追加到末尾
      if (savedModel && models.indexOf(savedModel) === -1) {
        models.push(savedModel);
      }
      var defaultModel = preset.defaultModel;
      models.forEach(function (m) {
        var opt = document.createElement('option');
        opt.value = m;
        var isVision = isVisionModel(platform, m);
        opt.textContent = m + (isVision ? ' 👁' : ' 📝');
        if (m === savedModel || (!savedModel && m === defaultModel)) {
          opt.selected = true;
        }
        selectEl.appendChild(opt);
      });
      // 更新视觉能力提示
      var hintEl = selectEl.parentNode.querySelector('.model-vision-hint');
      if (hintEl) {
        var selectedModel = selectEl.value || defaultModel;
        if (isVisionModel(platform, selectedModel)) {
          hintEl.textContent = '👁 当前模型支持图片识别';
          hintEl.style.color = '#16a34a';
        } else {
          hintEl.textContent = '📝 当前模型仅支持文本，上传图片前请切换';
          hintEl.style.color = '#b45309';
        }
      }
    } else {
      // 自定义平台：降级为文本框
      var input = document.createElement('input');
      input.type = 'text';
      input.id = selectEl.id;
      input.placeholder = '模型名称';
      input.value = savedModel || '';
      input.style.cssText = 'width:100%;padding:12px 14px;border:1px solid var(--green-300);border-radius:8px;font-size:14px;font-family:inherit;outline:none;background:rgba(255,255,255,.7);min-height:44px;-webkit-appearance:none;';
      selectEl.parentNode.replaceChild(input, selectEl);
      var hintEl = input.parentNode.querySelector('.model-vision-hint');
      if (hintEl) {
        hintEl.textContent = '自定义模型，请手动输入模型标识符';
        hintEl.style.color = '#94a3b8';
      }
      return input;
    }
    return selectEl;
  }

  /* DOM 引用 */
  const btnAnalyze     = document.getElementById('btnAnalyze');
  const userInput      = document.getElementById('userInput');
  const modalOverlay   = document.getElementById('modalOverlay');
  const apiKeyInput    = document.getElementById('apiKeyInput');
  const btnSaveKey     = document.getElementById('btnSaveKey');
  const btnCancelKey   = document.getElementById('btnCancelKey');
  const btnSettings    = document.getElementById('btnSettings');
  const mindmapToggle  = document.getElementById('mindmapToggle');
  const mindmapBody    = document.getElementById('mindmapBody');
  const mindmapPlaceholder = document.getElementById('mindmapPlaceholder');
  const mindmapSvg     = document.getElementById('mindmapSvg');
  const knowledgeTree  = document.getElementById('knowledgeTree');
  const knowledgeCount = document.getElementById('knowledgeCount');
  const searchInput    = document.getElementById('searchInput');
  const btnExport      = document.getElementById('btnExport');
  const btnImport      = document.getElementById('btnImport');
  const btnClearAll    = document.getElementById('btnClearAll');
  const importFileInput = document.getElementById('importFileInput');
  const settingsOverlay     = document.getElementById('settingsOverlay');
  const settingsApiKeyInput = document.getElementById('settingsApiKeyInput');
  const btnSaveSettingsKey  = document.getElementById('btnSaveSettingsKey');
  const btnCloseSettings    = document.getElementById('btnCloseSettings');
  const btnSettingsExport   = document.getElementById('btnSettingsExport');
  const btnSettingsImport   = document.getElementById('btnSettingsImport');
  const btnSettingsClearAll = document.getElementById('btnSettingsClearAll');
  const settingsPlatform    = document.getElementById('settingsPlatform');
  const settingsApiUrl      = document.getElementById('settingsApiUrl');
  const settingsModel       = document.getElementById('settingsModel');
  const imagePreviewArea        = document.getElementById('imagePreviewArea');
  const imagePreviewContainer   = document.getElementById('imagePreviewContainer');
  const btnRemoveImage          = document.getElementById('btnRemoveImage');
  const btnPickImage        = document.getElementById('btnPickImage');
  const btnTakePhoto        = document.getElementById('btnTakePhoto');
  const editModalOverlay    = document.getElementById('editModalOverlay');
  const editSubject         = document.getElementById('editSubject');
  const editTopic           = document.getElementById('editTopic');
  const editSummary         = document.getElementById('editSummary');
  const editText            = document.getElementById('editText');
  const mergeModalOverlay   = document.getElementById('mergeModalOverlay');
  const mergeTopicName      = document.getElementById('mergeTopicName');

  /* 默认 API Key（测试阶段共享，用户可自行替换） */
  var DEFAULT_API_KEY = 'sk-51eb563fb45e49bd9d7fedae992699b4';

  /* 工具 */
  function getApiKey()  { return localStorage.getItem(LS_KEY) || localStorage.getItem('knowleaf_deepseek_apikey') || DEFAULT_API_KEY; }
  function saveApiKey(key) { localStorage.setItem(LS_KEY, key); localStorage.removeItem('knowleaf_deepseek_apikey'); }
  function getApiUrl() { return localStorage.getItem(URL_KEY) || 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'; }
  function saveApiUrl(url) { localStorage.setItem(URL_KEY, url); }
  function getModel()  { return localStorage.getItem(MODEL_KEY) || 'qwen-vl-max'; }
  function saveModel(model) { localStorage.setItem(MODEL_KEY, model); }

  function showToast(msg, type) {
    var el = document.createElement('div');
    el.className = 'toast ' + (type || 'error');
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 3000);
  }
  window.showToast = showToast;

  function setLoading(loading) {
    btnAnalyze.disabled = loading;
    if (loading) {
      btnAnalyze.classList.add('loading');
      btnAnalyze.textContent = '⏳ 分析中...';
    } else {
      btnAnalyze.classList.remove('loading');
      btnAnalyze.textContent = '🔍 分析并生成导图';
    }
  }

  /* API Key 弹窗（首次使用） */
  var modalResolve = null;
  function showApiKeyModal() {
    return new Promise(function (resolve) {
      modalResolve = resolve;
      apiKeyInput.value = getApiKey() || '';
      modalOverlay.style.display = 'flex';
      apiKeyInput.focus();
    });
  }
  function hideApiKeyModal() {
    modalOverlay.style.display = 'none';
    if (modalResolve) { modalResolve(null); modalResolve = null; }
  }
  btnSaveKey.addEventListener('click', function () {
    var key = apiKeyInput.value.trim();
    if (!key) { showToast('请输入 API Key', 'error'); return; }
    saveApiKey(key);
    modalOverlay.style.display = 'none';
    if (modalResolve) { modalResolve(key); modalResolve = null; }
    showToast('API Key 已保存', 'success');
  });
  btnCancelKey.addEventListener('click', hideApiKeyModal);
  modalOverlay.addEventListener('click', function (e) { if (e.target === modalOverlay) hideApiKeyModal(); });

  /* 设置面板 */
  function openSettingsPanel() {
    settingsApiKeyInput.value = getApiKey() || '';
    var currentUrl = getApiUrl();
    settingsApiUrl.value = currentUrl;
    var platform = getPlatformByUrl(currentUrl);
    settingsPlatform.value = platform;
    settingsApiUrl.readOnly = (platform !== 'custom');
    var savedModel = getModel();
    settingsModel = renderModelSelect(platform, settingsModel, savedModel);
    updateSettingsStats();
    settingsOverlay.style.display = 'flex';
  }
  function closeSettingsPanel() {
    saveModelConfig();
    settingsOverlay.style.display = 'none';
  }
  function updateSettingsStats() {
    var data = loadData();
    document.getElementById('statRecordCount').textContent = countRecords(data) + ' 条';
    document.getElementById('statSubjectCount').textContent = countSubjects(data) + ' 个';
    document.getElementById('statTopicCount').textContent = countTopics(data) + ' 个';
    document.getElementById('statTokens').textContent = '~' + Math.round(JSON.stringify(data).length / 2) + ' tokens';
  }

  settingsPlatform.addEventListener('change', function () {
    var platform = settingsPlatform.value;
    settingsApiUrl.readOnly = (platform !== 'custom');
    if (platform !== 'custom') {
      var preset = PLATFORM_PRESETS[platform];
      if (preset) settingsApiUrl.value = preset.url;
    }
    var savedModel = getModel();
    settingsModel = renderModelSelect(platform, settingsModel, savedModel);
  });

  function saveModelConfig() {
    saveApiUrl(settingsApiUrl.value.trim());
    var mv = settingsModel.tagName === 'SELECT' ? settingsModel.value : settingsModel.value;
    saveModel(mv.trim());
  }

  btnSaveSettingsKey.addEventListener('click', function () {
    var key = settingsApiKeyInput.value.trim();
    if (!key) { showToast('请输入 API Key', 'error'); return; }
    saveApiKey(key);
    saveModelConfig();
    showToast('API Key 已保存', 'success');
  });
  btnCloseSettings.addEventListener('click', closeSettingsPanel);
  settingsOverlay.addEventListener('click', function (e) { if (e.target === settingsOverlay) closeSettingsPanel(); });
  btnSettingsExport.addEventListener('click', function () { exportData(); closeSettingsPanel(); });
  btnSettingsImport.addEventListener('click', function () { importFileInput.click(); closeSettingsPanel(); });
  btnSettingsClearAll.addEventListener('click', function () { clearAllData(); closeSettingsPanel(); });

  /* 知识库按钮 */
  btnExport.addEventListener('click', exportData);
  btnImport.addEventListener('click', function () { importFileInput.click(); });
  btnClearAll.addEventListener('click', clearAllData);
  importFileInput.addEventListener('change', function () { if (this.files && this.files[0]) importData(this.files[0]); });

  /* 搜索 */
  var isComposing = false;

