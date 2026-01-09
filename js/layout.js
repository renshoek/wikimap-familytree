/* global nodes, edges, network, updateNodeValue */

// CONFIGURATION
const SPACING_X = 160; 
const SPACING_Y = 220; 
const UNION_OFFSET_Y = 160; // Vertical distance from Parent to Union
const MIN_NODE_GAP = 20; 
const BASE_EDGE_LENGTH = 200; 

// -- HELPER: RECENTER UNIONS --
function recenterUnions(specificUnionIds = null) {
  const allNodes = nodes.get();
  const unions = allNodes.filter(n => n.isUnion && n.spouseIds && n.spouseIds.length === 2);
  
  const updates = [];
  unions.forEach(u => {
     if (specificUnionIds && !specificUnionIds.includes(u.id)) return;

     const p1 = nodes.get(u.spouseIds[0]);
     const p2 = nodes.get(u.spouseIds[1]);
     
     if (p1 && p2) {
       // Center X between parents
       const midX = (p1.x + p2.x) / 2;
       
       // Enforce Y position: strictly below parents
       const targetY = ((p1.y + p2.y) / 2) + UNION_OFFSET_Y;

       // Relaxed threshold to prevent jitter
       if (Math.abs(u.x - midX) > 2 || Math.abs(u.y - targetY) > 2) {
         updates.push({ id: u.id, x: midX, y: targetY });
       }
     }
  });
  
  if (updates.length > 0) nodes.update(updates);
}

window.recenterUnions = recenterUnions;

// -- TREE GRAVITY (Custom Physics) --
window.applyTreeForces = function() {
    if (!network || !network.body) return;
    
    // NOTE: Throttling removed to prevent shaking. Logic runs every frame.
    
    const nodesBody = network.body.nodes;
    const edgesBody = network.body.edges;
    
    // Target height for Child levels
    const TARGET_LEVEL_HEIGHT = 280; 

    // 1. GLOBAL STABILIZER (Stop Infinite Drift on X and Y)
    let totalX = 0;
    let totalY = 0;
    let nodeCount = 0;
    const nodeIds = Object.keys(nodesBody);
    
    for (let i = 0; i < nodeIds.length; i++) {
        const node = nodesBody[nodeIds[i]];
        // Only count real nodes
        if (node.options.physics !== false) {
            totalX += node.x;
            totalY += node.y;
            nodeCount++;
        }
    }

    if (nodeCount > 0) {
        const avgX = totalX / nodeCount;
        const avgY = totalY / nodeCount;
        
        // Apply gentle centering force
        const driftForceX = -avgX * 0.05; 
        const driftForceY = -avgY * 0.05; 
        
        for (let i = 0; i < nodeIds.length; i++) {
            const node = nodesBody[nodeIds[i]];
            if (node.options.physics !== false) {
                node.x += driftForceX;
                node.y += driftForceY;
            }
        }
    }

// 2. EDGE FORCES
    Object.values(edgesBody).forEach(edge => {
        // UPDATED: Ignore non-physical edges, BUT allow sibling edges (dashes: true)
        if (edge.options.physics === false && edge.options.dashes !== true) return;

        const n1 = nodesBody[edge.fromId];
        const n2 = nodesBody[edge.toId];
        
        if(!n1 || !n2) return;
        if(n1.options.physics === false || n2.options.physics === false) return;

        const dx = n1.x - n2.x;
        const dy = n1.y - n2.y;
        const dist = Math.sqrt(dx*dx + dy*dy);

        // -- SIBLING LEASH (Max 600px) --
        if (edge.options.dashes === true) {
             // Only apply force if they drift further than 400px
             if (dist > 600) {
                 const diff = dist - 600;
                 const correction = diff * 0.05; // Gentle correction to prevent snapping
                 
                 const angle = Math.atan2(dy, dx);
                 const cx = Math.cos(angle) * correction;
                 const cy = Math.sin(angle) * correction;
                 
                 n1.x -= cx * 0.5;
                 n1.y -= cy * 0.5;
                 n2.x += cx * 0.5;
                 n2.y += cy * 0.5;
             }
             // Return early so standard parent/child logic doesn't apply to siblings
             return; 
        }        
        // Calculate "Crowdedness" (Degree)
        const d1 = n1.edges ? n1.edges.length : 1;
        const d2 = n2.edges ? n2.edges.length : 1;
        const maxDegree = Math.max(d1, d2);

        // A. Dynamic Limit: Base + 25px per extra connection
        const dynamicLimit = BASE_EDGE_LENGTH + (maxDegree * 25);

        // B. Dynamic Stiffness: Crowded nodes have "stretchier" leashes
        const dynamicStiffness = Math.max(0.1, 0.6 - (maxDegree * 0.03));
        
        if (dist > dynamicLimit) {
            const diff = dist - dynamicLimit;
            const correction = diff * dynamicStiffness; 
            
            const angle = Math.atan2(dy, dx);
            const cx = Math.cos(angle) * correction;
            const cy = Math.sin(angle) * correction;
            
            // Asymmetric Correction (Anti-Lift)
            let n1Scale = 0.5;
            let n2Scale = 0.5;

            // Check vertical relationship
            if (n1.y < n2.y) {
                 // n1 is above n2 (e.g. Parent is above Child)
                 // Pull n1 (Parent) down heavily. Anchor n2 (Child).
                 n1Scale = 0.95;
                 n2Scale = 0.05;
            } else {
                 // n2 is above n1
                 // Pull n2 down heavily. Anchor n1.
                 n1Scale = 0.05;
                 n2Scale = 0.95;
            }

            n1.x -= cx * n1Scale;
            n1.y -= cy * n1Scale;
            n2.x += cx * n2Scale;
            n2.y += cy * n2Scale;
        }

        // 3. Spouse -> Union (Vertical Placement Logic)
        if (n2.options.isUnion && !n1.options.isUnion) {
            // Y Alignment: FORCE Union to be below Parent
            const targetY = n1.y + UNION_OFFSET_Y;
            const dy = targetY - n2.y;
            
            // Gentler correction force
            if (Math.abs(dy) > 2) {
                const force = dy * 0.1; 
                n1.y -= force * 0.5; 
                n2.y += force * 0.5; 
            }
            
            // X Cohesion (Relaxed)
            const dx = n1.x - n2.x;
            const targetDist = 120; 
            
            // Only pull if they drift WAY further than targetDist
            if (Math.abs(dx) > targetDist + 50) {
                 const pull = (Math.abs(dx) - (targetDist + 50)) * 0.02; 
                 if (n1.x > n2.x) n1.x -= pull;
                 else n1.x += pull;
            }
        }

        // 4. Vertical Separation (Parent/Union -> Child)
        else {
             let isParentChild = false;
             if (n1.options.isUnion && !n2.options.isUnion) isParentChild = true;
             else if (!n1.options.isUnion && !n2.options.isUnion && edge.options.arrows === 'to') isParentChild = true;

             if (isParentChild) {
                 const currentYDiff = n2.y - n1.y; 
                 
                 // Push down if too close
                 if (currentYDiff < TARGET_LEVEL_HEIGHT) {
                     const distMissing = TARGET_LEVEL_HEIGHT - currentYDiff;
                     const force = Math.min(distMissing * 0.05, 10); // Gentle push
                     
                     // Distribute force evenly to maintain structure
                     n1.y -= force; 
                     n2.y += force; 
                 }
             }
        }
    });
};

window.updateTriggerPositions = function() {
  if (!window.activeTriggers || window.activeTriggers.size === 0) return;
  if (!network || !network.body || !network.body.nodes) return;

  window.activeTriggers.forEach(triggerId => {
     const trigger = network.body.nodes[triggerId];
     if (!trigger) return; 

     const parentId = trigger.options.parentId;
     if (!parentId) return;

     const parent = network.body.nodes[parentId];
     if (!parent) return;

     let newX = parent.x;
     let newY = parent.y;
     const type = trigger.options.triggerType;

     if (type === 'parents') {
         newY = parent.y - 35;
     } else if (type === 'children') {
         newY = parent.y + 55; 
     } else if (type === 'siblings') {
         newX = parent.x - 55;
         newY = parent.y - 35;
     } else if (type === 'spouses') {
         newX = parent.x + 55;
         newY = parent.y - 35;
     }

     trigger.x = newX;
     trigger.y = newY;
  });
};

function animateNodes(updates) {
  const duration = 600; 
  const start = performance.now();
  const initialPositions = {};
  
  updates.forEach(u => {
    const node = nodes.get(u.id);
    if(node) {
        initialPositions[u.id] = { 
            x: node.x, 
            y: node.y,
            fontSize: (node.font && node.font.size !== undefined) ? node.font.size : 0 
        };
    }
  });

  function step(time) {
    const progress = Math.min((time - start) / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 3); // Cubic Ease Out
    
    const frameUpdates = updates.map(u => {
      const init = initialPositions[u.id];
      if (!init) return null;
      
      const updateObj = {
        id: u.id,
        x: init.x + (u.x - init.x) * ease,
        y: init.y + (u.y - init.y) * ease
      };

      if (u.fontSize !== undefined) {
          const currentSize = init.fontSize + (u.fontSize - init.fontSize) * ease;
          updateObj.font = { size: currentSize };
      }

      return updateObj;
    }).filter(n => n);

    if (frameUpdates.length > 0) {
      nodes.update(frameUpdates);
      recenterUnions();
    }

    if (progress < 1) {
      requestAnimationFrame(step);
    }
  }
  requestAnimationFrame(step);
}

// UPDATED: Corrected Single-Pass Overlap Logic
window.fixOverlap = function(yLevel) {
  const tolerance = 20; 
  const nodesOnLevel = nodes.get({
    filter: n => Math.abs(n.y - yLevel) < tolerance
  });

  if (nodesOnLevel.length < 2) return;

  // Ensure sorted by X
  nodesOnLevel.sort((a, b) => a.x - b.x);

  const updates = [];
  let didMove = false; 
  let accumulatedPush = 0;

  for (let i = 0; i < nodesOnLevel.length - 1; i++) {
    const leftNode = nodesOnLevel[i];
    const rightNode = nodesOnLevel[i+1];

    const leftW = (leftNode.isUnion || leftNode.isTrigger) ? 30 : 160;
    const rightW = (rightNode.isUnion || rightNode.isTrigger) ? 30 : 160;
    const minGap = (leftW/2 + rightW/2) + MIN_NODE_GAP;
    
    // Check distance relative to the potentially pushed left node
    const currentDist = rightNode.x - leftNode.x;

    if (currentDist < minGap) {
        const pushNeeded = minGap - currentDist;
        accumulatedPush += pushNeeded;
        didMove = true;
    }

    // Apply TOTAL accumulated push to the current right node
    if (accumulatedPush > 0) {
        const newX = rightNode.x + accumulatedPush;
        
        // Check if we already have an update for this node
        const existingUpdate = updates.find(u => u.id === rightNode.id);
        if (existingUpdate) {
            existingUpdate.x = newX;
        } else {
            updates.push({ id: rightNode.id, x: newX, y: rightNode.y });
        }
    }
  }

  if (didMove) {
    animateNodes(updates);
  } else {
    recenterUnions();
  }
};

// EXPORTS
window.animateNodes = animateNodes;
window.fixOverlap = fixOverlap;
