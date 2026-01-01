/* global nodes, network, isTouchDevice, shepherd, updateNodeValue, handleTriggerClick, showSiblingToggle, hideSiblingToggle */
/* global expandNode, traceBack, resetProperties, go, goRandom, clearNetwork, unwrap, addItem */

let lastClickedNode = null;

function traceBack(nodeId) {
  // Placeholder
  console.log("Tracing back from:", nodeId);
}

function resetProperties() {
  // Placeholder
  console.log("Resetting properties");
}

function clickEvent(params) {
  if (params.nodes.length) {
    const nodeId = params.nodes[0];
    const node = nodes.get(nodeId);

    // FIX: Catch Union Nodes (isUnion) and Triggers (isTrigger)
    if (node && (node.isTrigger || node.isUnion)) {
      handleTriggerClick(nodeId);
      return;
    }

    if (isTouchDevice || nodeId === lastClickedNode) {
      traceBack(nodeId);
    } else {
      lastClickedNode = nodeId;
      traceBack(nodeId);
      expandNode(nodeId, true);
    }
  } else {
    lastClickedNode = null;
    resetProperties();
  }
}

function openPageForId(nodeId) {
  const node = nodes.get(nodeId);
  if (node && !node.isTrigger && !node.isUnion) {
    const page = encodeURIComponent(unwrap(node.label));
    const url = `https://en.wikipedia.org/wiki/${page}`;
    window.open(url, '_blank');
  }
}

function globalKeyHandler(e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  const key = e.key.toLowerCase();
  
  if (key === 'd' || key === 'delete' || key === 'backspace') {
    if (lastClickedNode) {
       nodes.remove(lastClickedNode);
       lastClickedNode = null;
    }
  }
}

function bindNetwork() {
  network.on('click', clickEvent);
  network.on('doubleClick', (params) => {
    if (params.nodes.length) openPageForId(params.nodes[0]);
  });
  
  // STICKY BUTTON UPDATE & CUSTOM GRAVITY
  network.on('beforeDrawing', () => {
    if(window.updateTriggerPositions) window.updateTriggerPositions();
    if(window.applyTreeForces) window.applyTreeForces();
  });
}

function bindSuggestions() {
  const allSuggestions = [
    "Queen Victoria", "Elizabeth II", "Charles III", "Henry VIII", 
    "Napoleon", "Genghis Khan", "Julius Caesar", "Barack Obama", 
    "John F. Kennedy", "Marie Curie", "Albert Einstein", "Zeus"
  ];
  
  const container = document.getElementById('suggestions');
  const cf = document.getElementById('input'); 

  function renderSuggestions() {
    container.innerHTML = '';
    const shuffled = [...allSuggestions].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, 15);
    selected.forEach(topic => {
      const el = document.createElement('div');
      el.className = 'suggestion-item';
      el.textContent = topic;
      el.addEventListener('click', () => {
        if (!el.classList.contains('disabled')) {
          addItem(cf, topic);
          el.classList.add('disabled');
        }
      });
      container.appendChild(el);
    });
  }
  renderSuggestions();
  
  const refreshBtn = document.getElementById('refresh-suggestions');
  if (refreshBtn) refreshBtn.addEventListener('click', renderSuggestions);
}

function bind() {
  bindSuggestions();
  document.addEventListener('keydown', globalKeyHandler);

  const submitButton = document.getElementById('submit');
  submitButton.addEventListener('click', () => {
    if(typeof shepherd !== 'undefined' && shepherd) shepherd.cancel(); 
    go();
  });

  const randomButton = document.getElementById('random');
  randomButton.addEventListener('click', goRandom);

  const clearButton = document.getElementById('clear');
  clearButton.addEventListener('click', clearNetwork);

  const tourbtn = document.getElementById('tourinit');
  if (tourbtn) tourbtn.addEventListener('click', () => {
    if(typeof shepherd !== 'undefined') shepherd.start();
  });
}
