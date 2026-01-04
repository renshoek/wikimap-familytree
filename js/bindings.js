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
    const selected = network.getSelectedNodes();
    if (selected.length > 0) {
       nodes.remove(selected);
       network.unselectAll();
    } else if (lastClickedNode) {
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

  // VISUAL PIN INDICATOR
  network.on('afterDrawing', (ctx) => {
    const allNodes = nodes.get();
    allNodes.forEach(n => {
       // Check if node is fixed (pinned)
       if (n.fixed === true || (n.fixed && n.fixed.x && n.fixed.y)) {
           const pos = network.getPositions([n.id])[n.id];
           if (pos) {
               ctx.font = "20px Arial";
               ctx.fillStyle = "red";
               ctx.textAlign = "center";
               // Draw pin emoji at top right of node
               ctx.fillText("📌", pos.x + 20, pos.y - 15);
           }
       }
    });
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

function bindActionButtons() {
  // 1. DELETE NODE
  const btnDelete = document.getElementById('btn-delete');
  if (btnDelete) {
    btnDelete.addEventListener('click', () => {
        const selected = network.getSelectedNodes();
        if (selected.length > 0) {
            nodes.remove(selected);
            network.unselectAll();
        } else {
            alert("Please select a node to delete.");
        }
    });
  }

  // 2. PIN / UNPIN NODE
  const btnPin = document.getElementById('btn-pin');
  if (btnPin) {
    btnPin.addEventListener('click', () => {
        const selected = network.getSelectedNodes();
        if (selected.length > 0) {
            const updates = selected.map(id => {
                const node = nodes.get(id);
                // Check if currently fully fixed
                const isFixed = node.fixed === true || (node.fixed && node.fixed.x && node.fixed.y);
                return { id: id, fixed: !isFixed };
            });
            nodes.update(updates);
        } else {
            alert("Please select a node to pin/unpin.");
        }
    });
  }

  // 3. TOGGLE PHYSICS
  const btnPhysics = document.getElementById('btn-physics');
  if (btnPhysics) {
    let physicsOn = true;
    btnPhysics.addEventListener('click', () => {
        physicsOn = !physicsOn;
        network.setOptions({ physics: { enabled: physicsOn } });
        
        // Update Icon
        const icon = btnPhysics.querySelector('i');
        if (physicsOn) {
            icon.className = 'icon ion-ios-pause';
            btnPhysics.title = "Pause Physics";
        } else {
            icon.className = 'icon ion-ios-play';
            btnPhysics.title = "Resume Physics";
        }
    });
  }
}

function bind() {
  bindSuggestions();
  bindActionButtons(); // Bind the new bottom-right buttons
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
