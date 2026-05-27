// KnowLeaf 知叶 — D3 力导向关系网络

  // ===== P4: D3.js 力导向关系网络 =====

  var NODE_TYPE_LABELS = {
    'concept': '概念', 'definition': '定义', 'theorem': '定理',
    'formula': '公式', 'example': '示例', 'exercise': '习题'
  };

  var NODE_COLORS = {
    'concept': '#3b82f6', 'definition': '#8b5cf6', 'theorem': '#ef4444',
    'formula': '#10b981', 'example': '#f59e0b', 'exercise': '#94a3b8'
  };

  var LINK_COLORS = {
    'prerequisite': '#94a3b8', 'extension': '#3b82f6', 'contrast': '#f59e0b',
    'application': '#10b981', 'derivation': '#8b5cf6'
  };

  var networkSimulation = null;
  var networkSvgSel = null;
  var networkG = null;


  function getNodeColor(nodeType) {
    return NODE_COLORS[nodeType] || '#94a3b8';
  }

  function getNodeRadius(importance, connectedCount) {
    var base = 8 + (importance || 3) * 3;
    return Math.min(base + Math.min(connectedCount || 0, 10) * 0.5, 35);
  }

  function buildGraphData() {
    var data = loadData();
    var subjects = Object.keys(data).filter(isValidSubject);
    var nodes = [];
    var links = [];
    var nodeMap = {};
    var nodeId = 0;

    // 第一遍：创建所有节点
    subjects.forEach(function (subj) {
      Object.keys(data[subj]).forEach(function (topic) {
        var items = data[subj][topic].items || [];
        items.forEach(function (rec, idx) {
          var id = 'n' + (nodeId++);
          var key = subj + '|' + topic + '|' + idx;
          nodeMap[key] = id;
          var name = rec.summary || (rec.text || '').substring(0, 30);
          nodes.push({
            id: id,
            name: name.length > 15 ? name.substring(0, 15) + '...' : name,
            fullText: rec.text || '',
            summary: rec.summary || '',
            nodeType: rec.nodeType || 'concept',
            tags: rec.tags || [],
            importance: rec.importance || 3,
            subject: subj,
            topic: topic,
            idx: idx
          });
        });
      });
    });

    // 第二遍：创建连线（遍历 references）
    subjects.forEach(function (subj) {
      Object.keys(data[subj]).forEach(function (topic) {
        var items = data[subj][topic].items || [];
        items.forEach(function (rec, idx) {
          var sourceKey = subj + '|' + topic + '|' + idx;
          var sourceId = nodeMap[sourceKey];
          if (!sourceId) return;
          var refs = rec.references || [];
          refs.forEach(function (ref) {
            var targetKey = ref.targetSubject + '|' + ref.targetTopic + '|' + ref.targetIndex;
            var targetId = nodeMap[targetKey];
            if (targetId) {
              links.push({
                source: sourceId,
                target: targetId,
                type: ref.relationType || 'extension',
                strength: 1
              });
            }
          });
        });
      });
    });

    return { nodes: nodes, links: links };
  }

  function initNetworkGraph() {
    var container = document.getElementById('networkCanvas');
    if (!container) return;

    var graphData = buildGraphData();
    if (graphData.nodes.length === 0) {
      container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#94a3b8;font-size:14px;">还没有知识条目，先去添加一些吧 📖</div>';
      return;
    }

    container.innerHTML = '<svg id="networkSvg"></svg>';
    var svg = d3.select('#networkSvg');
    networkSvgSel = svg;

    var width = container.clientWidth;
    var height = container.clientHeight;
    svg.attr('width', width).attr('height', height);

    // 缩放和平移
    var g = svg.append('g');
    networkG = g;

    svg.call(d3.zoom()
      .scaleExtent([0.2, 3])
      .on('zoom', function (event) {
        g.attr('transform', event.transform);
      })
    );

    // 连线层
    var link = g.append('g')
      .selectAll('line')
      .data(graphData.links)
      .join('line')
      .attr('stroke', function (d) { return LINK_COLORS[d.type] || '#cbd5e1'; })
      .attr('stroke-width', function (d) { return Math.min((d.strength || 1) * 1.5, 4); })
      .attr('stroke-opacity', 0.6)
      .attr('stroke-dasharray', function (d) { return d.type === 'prerequisite' ? '4,2' : 'none'; });

    // 节点层
    var node = g.append('g')
      .selectAll('circle')
      .data(graphData.nodes)
      .join('circle')
      .attr('r', function (d) { return getNodeRadius(d.importance, 0); })
      .attr('fill', function (d) { return getNodeColor(d.nodeType); })
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .attr('opacity', 0.9)
      .attr('cursor', 'pointer')
      .on('click', function (event, d) { showNetworkDetail(d); })
      .call(dragBehavior());

    // 标签层
    var label = g.append('g')
      .selectAll('text')
      .data(graphData.nodes)
      .join('text')
      .text(function (d) { return d.name; })
      .attr('font-size', function (d) { return Math.min(8 + (d.importance || 3), 12); })
      .attr('dx', function (d) { return getNodeRadius(d.importance, 0) + 4; })
      .attr('dy', 4)
      .attr('fill', '#334155')
      .attr('pointer-events', 'none')
      .style('font-family', 'system-ui, sans-serif');

    // 力导向模拟
    networkSimulation = d3.forceSimulation(graphData.nodes)
      .force('link', d3.forceLink(graphData.links).id(function (d) { return d.id; }).distance(120))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(function (d) { return getNodeRadius(d.importance, 0) + 16; }))
      .on('tick', function () {
        link
          .attr('x1', function (d) { return d.source.x; })
          .attr('y1', function (d) { return d.source.y; })
          .attr('x2', function (d) { return d.target.x; })
          .attr('y2', function (d) { return d.target.y; });

        node
          .attr('cx', function (d) { return d.x; })
          .attr('cy', function (d) { return d.y; });

        label
          .attr('x', function (d) { return d.x; })
          .attr('y', function (d) { return d.y; });
      });
  }

  function dragBehavior() {
    return d3.drag()
      .on('start', function (event, d) {
        if (!event.active) networkSimulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', function (event, d) {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', function (event, d) {
        if (!event.active) networkSimulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });
  }

  function showNetworkDetail(d) {
    var card = document.getElementById('networkDetailCard');
    if (!card) return;
    document.getElementById('ndType').textContent = getNodeTypeIcon(d.nodeType) + ' ' + (NODE_TYPE_LABELS[d.nodeType] || d.nodeType);
    document.getElementById('ndName').textContent = d.name;
    document.getElementById('ndSummary').textContent = d.summary || (d.fullText || '').substring(0, 80) || '（无摘要）';

    var linksHtml = '<div style="margin-top:4px;">';
    linksHtml += '📂 <a href="#" onclick="jumpToKnowledge(\'' + escAttr(d.subject) + '\', \'' + escAttr(d.topic) + '\');return false;" style="color:#3b82f6;">' + escHtml(d.subject) + ' &gt; ' + escHtml(d.topic) + '</a>';
    linksHtml += '</div>';
    document.getElementById('ndLinks').innerHTML = linksHtml;

    card.style.display = 'block';
  }

  window.jumpToKnowledge = function (subject, topic) {
    // 切换到知识浏览 sub-tab
    var subtabs = document.querySelectorAll('.learn-subtab');
    subtabs.forEach(function (t) { t.classList.remove('active'); });
    var learnTab = document.querySelector('.learn-subtab[data-subpanel="subpanelLearn"]');
    if (learnTab) learnTab.classList.add('active');
    document.getElementById('subpanelLearn').style.display = 'block';
    document.getElementById('subpanelNetwork').style.display = 'none';
    // 切换到学习面板
    document.querySelector('.nav-tab[data-panel="learnPanel"]').click();
    // 滚动到对应位置
    setTimeout(function () {
      var el = document.querySelector('[data-topic-children="' + escAttr(subject) + '|' + escAttr(topic) + '"]');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 300);
  };

  function resizeNetworkGraph() {
    var container = document.getElementById('networkCanvas');
    if (!container || !networkSvgSel) return;
    var w = container.clientWidth;
    var h = container.clientHeight;
    networkSvgSel.attr('width', w).attr('height', h);
    if (networkSimulation) {
      networkSimulation.force('center', d3.forceCenter(w / 2, h / 2));
      networkSimulation.alpha(0.3).restart();
    }
  }
