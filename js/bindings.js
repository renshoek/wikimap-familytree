/* global nodes, network, isTouchDevice, shepherd, updateNodeValue, handleTriggerClick, showSiblingToggle, hideSiblingToggle */
/* global expandNode, traceBack, resetProperties, go, goRandom, clearNetwork, unwrap, addItem, Modal, edges, startLoading, stopLoading, getPersonDetails */

let lastClickedNode = null;

// DEFINED DEFAULTS (Updated to match current system)
const PHYSICS_DEFAULTS = {
    gravitationalConstant: -4500, 
    centralGravity: 0.02,         
    springLength: 120,            
    springConstant: 0.007, 
    damping: 0.2,
    avoidOverlap: 0.5
};

// -- HELPER: Update Action Buttons State (Grey out if no selection) --
function updateSelectionButtons() {
    // Only keeping logic for buttons that still exist in the main UI
}

// -- HELPER: Delete Nodes + Their Triggers --
function deleteNodesWithTriggers(ids) {
    const idsToRemove = Array.isArray(ids) ? [...ids] : [ids];
    const triggersToRemove = [];

    idsToRemove.forEach(id => {
        const t1 = `trigger_parents_${id}`;
        const t2 = `trigger_spouses_${id}`;
        const t3 = `trigger_siblings_${id}`;
        
        [t1, t2, t3].forEach(t => {
             if (nodes.get(t)) {
                 triggersToRemove.push(t);
                 if (window.activeTriggers) window.activeTriggers.delete(t);
             }
        });
    });

    nodes.remove([...idsToRemove, ...triggersToRemove]);
    network.unselectAll();
    
    if (idsToRemove.includes(lastClickedNode)) {
        lastClickedNode = null;
    }
    
    // Also hide the info card if the selected node was deleted
    const card = document.getElementById('node-info-card');
    if (card) card.style.display = 'none';

    updateSelectionButtons();
}

function traceBack(nodeId) {
  console.log("Tracing back from:", nodeId);
}

function resetProperties() {
  console.log("Resetting properties");
}

function showNodeInfo(nodeId) {
    const card = document.getElementById('node-info-card');
    if (!card) return;

    // Determine Pin State
    const node = nodes.get(nodeId);
    const isPinned = node && (node.fixed === true || (node.fixed && node.fixed.x && node.fixed.y));
    const pinTitle = isPinned ? "Unpin Node" : "Pin Node";
    // If pinned, show the 'pinned' style icon (filled or active look), or just standard pin
    // Using ion-pinpoint for pinned state to differentiate visually
    const pinIcon = isPinned ? "ion-pinpoint" : "ion-pin"; 

    // Show wrapper
    card.style.display = 'block';
    
    // Structure: Floating Actions + Content Box
    // Note: card-btn-delete uses standard style now to match "button list" request
    const actionsHtml = `
      <div class="info-actions">
          <button id="card-btn-pin" title="${pinTitle}">
             <i class="icon ${pinIcon}"></i>
          </button>
          <button id="card-btn-delete" title="Delete Node">
             <i class="icon ion-trash-b"></i>
          </button>
      </div>
    `;

    const loadingHtml = `
        <div class="info-content">
            <button class="close-card" id="card-close">&times;</button>
            <div style="text-align:center; padding:10px;">
                <i class="icon ion-load-c" style="animation: spin 1s infinite linear; display:inline-block;"></i> Loading...
            </div>
        </div>
    `;

    card.innerHTML = actionsHtml + loadingHtml;

    // Bind Events Helper
    const bindEvents = () => {
        const btnPin = document.getElementById('card-btn-pin');
        const btnDelete = document.getElementById('card-btn-delete');
        const btnClose = document.getElementById('card-close');

        if(btnPin) {
            btnPin.onclick = () => {
                const n = nodes.get(nodeId);
                const currentFixed = n.fixed === true || (n.fixed && n.fixed.x && n.fixed.y);
                nodes.update({ id: nodeId, fixed: !currentFixed });
                // Re-render to show updated pin state
                showNodeInfo(nodeId);
            };
        }
        if(btnDelete) {
            btnDelete.onclick = () => {
                deleteNodesWithTriggers([nodeId]);
            };
        }
        if(btnClose) {
            btnClose.onclick = () => {
                card.style.display = 'none';
            };
        }
    };
    bindEvents();

    if(window.getPersonDetails) {
        window.getPersonDetails(nodeId).then(details => {
            if(!details) {
                card.innerHTML = actionsHtml + `
                    <div class="info-content">
                        <button class="close-card" id="card-close">&times;</button>
                        <div>No details found.</div>
                    </div>`;
                bindEvents();
                return;
            }

            const contentHtml = `
                <div class="info-content">
                    <button class="close-card" id="card-close">&times;</button>
                    <div style="clear:both;">
                        ${details.image ? `<img src="${details.image}" alt="${details.label}">` : ''}
                        <h2 style="margin-bottom: 5px;">${details.label}</h2>
                        <p style="margin:0; font-size:0.9em; color:#555;">${details.description || ''}</p>
                    </div>
                    <div style="clear:both; margin-top:10px; border-top:1px solid #eee; padding-top:10px;">
                        ${details.birthDate ? `<div><strong>Born:</strong> ${details.birthDate} ${details.birthPlace ? `in ${details.birthPlace}` : ''}${details.birthCountry ? `, ${details.birthCountry}` : ''}</div>` : ''}
                        ${details.deathDate ? `<div><strong>Died:</strong> ${details.deathDate} ${details.deathPlace ? `in ${details.deathPlace}` : ''}${details.deathCountry ? `, ${details.deathCountry}` : ''}</div>` : ''}
                    </div>
                    <div style="margin-top:10px; text-align:right;">
                        <a href="https://www.wikidata.org/wiki/${details.id}" target="_blank" style="font-size:0.85em; margin-right:10px;">Wikidata</a>
                        ${details.wikipedia ? `<a href="${details.wikipedia}" target="_blank" style="font-size:0.85em;">Wikipedia</a>` : ''}
                    </div>
                </div>
            `;
            
            card.innerHTML = actionsHtml + contentHtml;
            bindEvents(); // Re-bind after HTML replacement

        }).catch(err => {
            console.error(err);
            card.innerHTML = actionsHtml + `
                <div class="info-content">
                    <button class="close-card" id="card-close">&times;</button>
                    <div>Error fetching details.</div>
                </div>`;
            bindEvents();
        });
    }
}

function clickEvent(params) {
  if (params.nodes.length) {
    const nodeId = params.nodes[0];
    const node = nodes.get(nodeId);

    if (node && (node.isTrigger || node.isUnion)) {
      handleTriggerClick(nodeId);
      return;
    }
    
    // Show Info Card
    showNodeInfo(nodeId);

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
    // Hide info card when deselecting
    const card = document.getElementById('node-info-card');
    if (card) card.style.display = 'none';
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
       deleteNodesWithTriggers(selected);
    } else if (lastClickedNode) {
       deleteNodesWithTriggers([lastClickedNode]);
    }
  }
}

function bindNetwork() {
  network.on('click', clickEvent);
  network.on('doubleClick', (params) => {
    if (params.nodes.length) openPageForId(params.nodes[0]);
  });
  
  network.on('selectNode', updateSelectionButtons);
  network.on('deselectNode', updateSelectionButtons);
  network.on('dragEnd', updateSelectionButtons); 

  network.on('beforeDrawing', () => {
    if(window.updateTriggerPositions) window.updateTriggerPositions();
    if(window.applyTreeForces) window.applyTreeForces();
  });

  network.on('afterDrawing', (ctx) => {
    const allNodes = nodes.get();
    
    ctx.save();
    
    allNodes.forEach(n => {
       // 1. Draw PIN Indicators
       if (n.fixed === true || (n.fixed && n.fixed.x && n.fixed.y)) {
           const pos = network.getPositions([n.id])[n.id];
           if (pos) {
               ctx.font = "20px Arial";
               ctx.fillStyle = "red";
               ctx.textAlign = "center";
               ctx.fillText("📌", pos.x + 20, pos.y - 15);
           }
       }
       
       // 2. Draw Floating LifeSpan (Year of Birth - Death) under the node
       if (n.lifeSpan) {
           try {
               const box = network.getBoundingBox(n.id); // Get bounding box of the node
               if (box) {
                   ctx.font = "12px Arial"; // Subtle small text
                   ctx.fillStyle = "#666";  // Subtle grey
                   ctx.textAlign = "center";
                   ctx.textBaseline = "top";
                   // Draw centered below the node
                   const centerX = (box.left + box.right) / 2;
                   ctx.fillText(n.lifeSpan, centerX, box.bottom + 5);
               }
           } catch(e) {
               // Ignore errors if bounding box isn't ready
           }
       }
    });

    // 3. Draw LOADING Indicators
    if (window.loadingNodes && window.loadingNodes.size > 0) {
        const now = performance.now();
        const angle = (now / 150); // Speed factor (smaller = faster)
        
        window.loadingNodes.forEach(nodeId => {
            if (!nodes.get(nodeId)) { 
                window.loadingNodes.delete(nodeId); 
                return; 
            }
            
            const pos = network.getPositions([nodeId])[nodeId];
            if (pos) {
                const r = 7; // Radius
                const x = pos.x - 20; // Left offset
                const y = pos.y - 15; // Top offset

                ctx.beginPath();
                ctx.strokeStyle = '#555';
                ctx.lineWidth = 2;
                ctx.arc(x, y, r, angle, angle + 4.5); 
                ctx.stroke();
            }
        });
    }
    
    ctx.restore();
  });

  updateSelectionButtons();
}

function bindSuggestions() {
  const allSuggestions = window.SUGGESTIONS || [
    "Queen Victoria", "Barack Obama", "Donald Trump", "Elizabeth II"
  ];
  
  const container = document.getElementById('suggestions');
  const cf = document.getElementById('input'); 

  function renderSuggestions() {
    container.innerHTML = '';
    const shuffled = [...allSuggestions].sort(() => 0.5 - Math.random());
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
  // Pin and Delete bindings removed (handled in showNodeInfo now)

  const btnPhysics = document.getElementById('btn-physics');
  if (btnPhysics) {
    let physicsOn = true;
    btnPhysics.addEventListener('click', () => {
        physicsOn = !physicsOn;
        network.setOptions({ physics: { enabled: physicsOn } });
        
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

  const btnSettings = document.getElementById('btn-settings');
  if (btnSettings) {
      btnSettings.addEventListener('click', () => {
          const container = document.createElement('div');
          
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

          const btnExport = container.querySelector('#btn-export-tree');
          const btnImport = container.querySelector('#btn-import-tree');
          const btnClose = container.querySelector('#btn-close-modal');

          if (btnExport) {
            btnExport.addEventListener('click', () => {
              if (window.exportTree) window.exportTree();
            });
          }

          if (btnImport) {
            btnImport.addEventListener('click', () => {
              if (window.importTree) window.importTree();
              modal.close();
            });
          }

          if (btnClose) {
            btnClose.addEventListener('click', () => {
              modal.close();
            });
          }
      });
  }

  updateSelectionButtons();
}

// -- NEW DEBUG BINDINGS --
function bindDebug() {
    const btnTrigger = document.getElementById('debug-trigger');
    const panel = document.getElementById('debug-panel');
    const btnClose = document.getElementById('debug-close');
    const btnReset = document.getElementById('debug-reset');
    
    if (!btnTrigger || !panel) return;

function setInputValues(p) {
        document.getElementById('opt-gravity').value = p.gravitationalConstant;
        document.getElementById('val-gravity').textContent = p.gravitationalConstant;

        document.getElementById('opt-central').value = p.centralGravity;
        document.getElementById('val-central').textContent = p.centralGravity;

        document.getElementById('opt-springk').value = p.springConstant;
        document.getElementById('val-springk').textContent = p.springConstant;

        document.getElementById('opt-damping').value = p.damping;
        document.getElementById('val-damping').textContent = p.damping;
    }

    // Toggle Visibility
    btnTrigger.addEventListener('click', () => {
        panel.style.display = 'block';
        btnTrigger.style.display = 'none';
        
        if(network && network.physics && network.physics.options) {
             setInputValues(network.physics.options.barnesHut);
        }
    });

    btnClose.addEventListener('click', () => {
        panel.style.display = 'none';
        btnTrigger.style.display = 'flex'; // Restore as flex for centering
    });

    // Reset Functionality
    btnReset.addEventListener('click', () => {
        if (!network) return;
        network.setOptions({
            physics: {
                barnesHut: PHYSICS_DEFAULTS
            }
        });
        setInputValues(PHYSICS_DEFAULTS);
        network.startSimulation();
    });

    // Bind Sliders
    function updatePhysics() {
        if(!network) return;
        const opts = {
            physics: {
                barnesHut: {
                    gravitationalConstant: Number(document.getElementById('opt-gravity').value),
                    centralGravity: Number(document.getElementById('opt-central').value),
                    springConstant: Number(document.getElementById('opt-springk').value),
                    damping: Number(document.getElementById('opt-damping').value)
                }
            }
        };
        network.setOptions(opts);
        
        document.getElementById('val-gravity').textContent = opts.physics.barnesHut.gravitationalConstant;
        document.getElementById('val-central').textContent = opts.physics.barnesHut.centralGravity;
        document.getElementById('val-springk').textContent = opts.physics.barnesHut.springConstant;
        document.getElementById('val-damping').textContent = opts.physics.barnesHut.damping;
    }

['opt-gravity', 'opt-central', 'opt-springk', 'opt-damping'].forEach(id => {        const el = document.getElementById(id);
        if(el) el.addEventListener('input', updatePhysics);
    });

    // UPDATED: Sync sliders immediately on load!
    if(typeof network !== 'undefined' && network && network.physics && network.physics.options) {
        setInputValues(network.physics.options.barnesHut);
    } else {
        setInputValues(PHYSICS_DEFAULTS);
    }
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
