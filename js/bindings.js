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
    const btnPin = document.getElementById('btn-pin');
    const btnDelete = document.getElementById('btn-delete');
    const btnInfo = document.getElementById('btn-info');
    
    let hasSelection = false;
    if (typeof network !== 'undefined' && network) {
        const selected = network.getSelectedNodes();
        if (selected && selected.length > 0) {
             const node = nodes.get(selected[0]);
             if (node && !node.isTrigger && !node.isUnion) {
                 hasSelection = true;
             }
        }
    }

    const opacity = hasSelection ? '1' : '0.3';
    const cursor = hasSelection ? 'pointer' : 'default';

    if (btnPin) {
        btnPin.disabled = !hasSelection;
        btnPin.style.opacity = opacity;
        btnPin.style.cursor = cursor;
    }
    
    if (btnDelete) {
        btnDelete.disabled = !hasSelection;
        btnDelete.style.opacity = opacity;
        btnDelete.style.cursor = cursor;
    }

    if (btnInfo) {
        btnInfo.disabled = !hasSelection;
        btnInfo.style.opacity = opacity;
        btnInfo.style.cursor = cursor;
    }
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
    
    updateSelectionButtons();
}

function traceBack(nodeId) {
  console.log("Tracing back from:", nodeId);
}

function resetProperties() {
  console.log("Resetting properties");
}

function clickEvent(params) {
  if (params.nodes.length) {
    const nodeId = params.nodes[0];
    const node = nodes.get(nodeId);

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
  const btnDelete = document.getElementById('btn-delete');
  if (btnDelete) {
    btnDelete.addEventListener('click', () => {
        const selected = network.getSelectedNodes();
        if (selected.length > 0) {
            deleteNodesWithTriggers(selected);
        } else {
            alert("Please select a node to delete.");
        }
    });
  }

  const btnPin = document.getElementById('btn-pin');
  if (btnPin) {
    btnPin.addEventListener('click', () => {
        const selected = network.getSelectedNodes();
        if (selected.length > 0) {
            const updates = selected.map(id => {
                const node = nodes.get(id);
                const isFixed = node.fixed === true || (node.fixed && node.fixed.x && node.fixed.y);
                return { id: id, fixed: !isFixed };
            });
            nodes.update(updates);
        } else {
            alert("Please select a node to pin/unpin.");
        }
    });
  }

  const btnInfo = document.getElementById('btn-info');
  if (btnInfo) {
      btnInfo.addEventListener('click', () => {
          const selected = network.getSelectedNodes();
          if (selected.length > 0) {
              const nodeId = selected[0];
              const node = nodes.get(nodeId);
              if(node.isTrigger || node.isUnion) return;

              if(window.startLoading) window.startLoading();
              
              if(window.getPersonDetails) {
                  window.getPersonDetails(nodeId).then(details => {
                      if(window.stopLoading) window.stopLoading();
                      if(!details) {
                          alert("Could not fetch details.");
                          return;
                      }
                      
                      const html = `
                        <div style="padding: 20px; min-width: 300px; max-width: 400px; font-family: sans-serif; position: relative;">
                            <button id="info-modal-close" style="position: absolute; top: 0px; right: 0px; border: none; background: none; font-size: 1.5em; cursor: pointer; color: #555; line-height: 1;">&times;</button>
                            
                            <div style="display: flex; gap: 15px; margin-bottom: 15px; padding-right: 20px;">
                                ${details.image ? `<img src="${details.image}" style="width: 100px; height: 100px; object-fit: cover; border-radius: 5px; border: 1px solid #ccc;">` : ''}
                                <div>
                                    <h2 style="margin: 0 0 5px 0; font-size: 1.3em;">${details.label}</h2>
                                    <p style="margin: 0; color: #666; font-size: 0.9em; line-height: 1.4;">${details.description || 'No description available.'}</p>
                                </div>
                            </div>
                            
                            <table style="width: 100%; border-collapse: collapse; font-size: 0.95em; margin-bottom: 15px;">
                                ${details.birthDate ? `<tr><td style="padding: 4px 0; font-weight: bold; width: 60px; vertical-align: top;">Born:</td><td style="padding: 4px 0;">${details.birthDate} ${details.birthPlace ? `in ${details.birthPlace}` : ''}${details.birthCountry ? `, ${details.birthCountry}` : ''}</td></tr>` : ''}
                                ${details.deathDate ? `<tr><td style="padding: 4px 0; font-weight: bold; width: 60px; vertical-align: top;">Died:</td><td style="padding: 4px 0;">${details.deathDate} ${details.deathPlace ? `in ${details.deathPlace}` : ''}${details.deathCountry ? `, ${details.deathCountry}` : ''}</td></tr>` : ''}
                            </table>
                            
                            <div style="margin-top: 15px; text-align: right; display: flex; gap: 10px; justify-content: flex-end;">
                                <a href="https://www.wikidata.org/wiki/${details.id}" target="_blank" style="color: #444; text-decoration: none; border: 1px solid #ccc; padding: 5px 12px; border-radius: 4px; font-size: 0.85em; transition: background 0.2s;">Wikidata</a>
                                ${details.wikipedia ? `<a href="${details.wikipedia}" target="_blank" style="background: #eee; color: #333; text-decoration: none; padding: 5px 12px; border-radius: 4px; font-size: 0.85em; font-weight: bold; transition: background 0.2s;">Wikipedia</a>` : ''}
                            </div>
                        </div>
                      `;

                      const modal = new Modal(html);
                      modal.present();
                      
                      const closeBtn = document.getElementById('info-modal-close');
                      if(closeBtn) {
                          closeBtn.onclick = () => modal.close();
                      }

                  }).catch(err => {
                      if(window.stopLoading) window.stopLoading();
                      console.error(err);
                      alert("Error fetching details.");
                  });
              }

          }
      });
  }

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
