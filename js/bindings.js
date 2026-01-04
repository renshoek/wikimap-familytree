/* global nodes, network, isTouchDevice, shepherd, updateNodeValue, handleTriggerClick, showSiblingToggle, hideSiblingToggle */
/* global expandNode, traceBack, resetProperties, go, goRandom, clearNetwork, unwrap, addItem, Modal, edges */

let lastClickedNode = null;

// DEFINED DEFAULTS (Based on the Stabilized Version)
const PHYSICS_DEFAULTS = {
    gravitationalConstant: -6000,
    centralGravity: 0.02,
    springLength: 250,
    springConstant: 0.02,
    damping: 0.5
};

const LAYOUT_DEFAULTS = {
    TARGET_LEVEL_HEIGHT: 200
};

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
  // UPDATED: Now uses the shared list from main.js
  const allSuggestions = window.SUGGESTIONS || [
    "Queen Victoria", "Barack Obama", "Donald Trump", "Elizabeth II"
  ];
  
  const container = document.getElementById('suggestions');
  const cf = document.getElementById('input'); 

  function renderSuggestions() {
    container.innerHTML = '';
    const shuffled = [...allSuggestions].sort(() => 0.5 - Math.random());
    // Keep 20 as requested
    const selected = shuffled.slice(0, 20);
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

  // 4. SETTINGS
  const btnSettings = document.getElementById('btn-settings');
  if (btnSettings) {
      btnSettings.addEventListener('click', () => {
          const container = document.createElement('div');
          
          // Added Close Icon in the top right
          container.innerHTML = `
            <div style="position: relative;">
                <i id="btn-close-modal" class="icon ion-close" 
                   style="position: absolute; top: -10px; right: -5px; cursor: pointer; font-size: 24px; color: #555;" 
                   title="Close"></i>
                <h2 style="margin-top:0; padding-right: 20px;">Settings</h2>
            </div>
            <div style="margin-top:15px; display:flex; flex-direction:column; gap:10px;">
               <button id="btn-export-tree" class="shepbtn">Export Tree</button>
               <button id="btn-import-tree" class="shepbtn">Import Tree</button>
            </div>
          `;
          
          const modal = new Modal(container);
          modal.present();

          // Bind actions
          const btnExport = container.querySelector('#btn-export-tree');
          const btnImport = container.querySelector('#btn-import-tree');
          const btnClose = container.querySelector('#btn-close-modal');

          if (btnExport) {
            btnExport.addEventListener('click', () => {
              if (window.exportTree) window.exportTree();
              // Optional: modal.close(); 
            });
          }

          if (btnImport) {
            btnImport.addEventListener('click', () => {
              if (window.importTree) window.importTree();
              modal.close();
            });
          }

          // Close button logic
          if (btnClose) {
            btnClose.addEventListener('click', () => {
              modal.close();
            });
          }
      });
  }
}

// -- NEW DEBUG BINDINGS --
function bindDebug() {
    const btnTrigger = document.getElementById('debug-trigger');
    const panel = document.getElementById('debug-panel');
    const btnClose = document.getElementById('debug-close');
    const btnReset = document.getElementById('debug-reset');
    
    if (!btnTrigger || !panel) return;

    // Helper to update inputs from values
    function setInputValues(p, layoutHeight) {
        document.getElementById('opt-gravity').value = p.gravitationalConstant;
        document.getElementById('val-gravity').textContent = p.gravitationalConstant;

        document.getElementById('opt-central').value = p.centralGravity;
        document.getElementById('val-central').textContent = p.centralGravity;

        document.getElementById('opt-springlen').value = p.springLength;
        document.getElementById('val-springlen').textContent = p.springLength;

        document.getElementById('opt-springstiff').value = p.springConstant;
        document.getElementById('val-springstiff').textContent = p.springConstant;

        document.getElementById('opt-damping').value = p.damping;
        document.getElementById('val-damping').textContent = p.damping;

        if (layoutHeight !== undefined) {
            document.getElementById('opt-layout-height').value = layoutHeight;
            document.getElementById('val-layout-height').textContent = layoutHeight;
        }
    }

    // Toggle Visibility
    btnTrigger.addEventListener('click', () => {
        panel.style.display = 'block';
        btnTrigger.style.display = 'none';
        
        // Load current values
        if(network) {
             const p = network.physics.options.barnesHut;
             const lh = (window.LAYOUT) ? window.LAYOUT.TARGET_LEVEL_HEIGHT : 200;
             setInputValues(p, lh);
        }
    });

    btnClose.addEventListener('click', () => {
        panel.style.display = 'none';
        btnTrigger.style.display = 'block';
    });

    // --- RESET FUNCTIONALITY ---
    btnReset.addEventListener('click', () => {
        if (!network) return;

        // 1. Reset Sliders UI
        setInputValues(PHYSICS_DEFAULTS, LAYOUT_DEFAULTS.TARGET_LEVEL_HEIGHT);

        // 2. Reset Physics Engine
        network.setOptions({
            physics: {
                barnesHut: PHYSICS_DEFAULTS
            }
        });

        // 3. Reset Layout
        if(window.LAYOUT) {
            window.LAYOUT.TARGET_LEVEL_HEIGHT = LAYOUT_DEFAULTS.TARGET_LEVEL_HEIGHT;
        }

        // 4. Force Edge Length Clean (ensure no edges are stuck with old lengths)
        const allEdges = edges.get();
        const updates = allEdges.map(e => ({ id: e.id, length: undefined }));
        edges.update(updates);
    });

    // --- BIND SLIDERS ---
    
    function updatePhysics() {
        if(!network) return;
        const opts = {
            physics: {
                barnesHut: {
                    gravitationalConstant: Number(document.getElementById('opt-gravity').value),
                    centralGravity: Number(document.getElementById('opt-central').value),
                    springLength: Number(document.getElementById('opt-springlen').value),
                    springConstant: Number(document.getElementById('opt-springstiff').value),
                    damping: Number(document.getElementById('opt-damping').value)
                }
            }
        };
        network.setOptions(opts);
        
        // Update Text Labels
        document.getElementById('val-gravity').textContent = opts.physics.barnesHut.gravitationalConstant;
        document.getElementById('val-central').textContent = opts.physics.barnesHut.centralGravity;
        document.getElementById('val-springlen').textContent = opts.physics.barnesHut.springLength;
        document.getElementById('val-springstiff').textContent = opts.physics.barnesHut.springConstant;
        document.getElementById('val-damping').textContent = opts.physics.barnesHut.damping;
    }

    ['opt-gravity', 'opt-central', 'opt-springlen', 'opt-springstiff', 'opt-damping'].forEach(id => {
        document.getElementById(id).addEventListener('input', updatePhysics);
    });

    // Layout Specific
    document.getElementById('opt-layout-height').addEventListener('input', (e) => {
        const val = Number(e.target.value);
        if(window.LAYOUT) window.LAYOUT.TARGET_LEVEL_HEIGHT = val;
        document.getElementById('val-layout-height').textContent = val;
        if(network) network.simulation.startSimulation(); 
    });
}


function bind() {
  bindSuggestions();
  bindActionButtons(); 
  bindDebug(); // Initialize the new debugger
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
