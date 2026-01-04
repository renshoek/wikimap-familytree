/* global nodes, network, updateNodeValue */

// -- GLOBAL LAYOUT CONFIGURATION --
// We expose these to window.LAYOUT so the debug panel can edit them in real-time.
window.LAYOUT = {
    SPACING_X: 160,
    SPACING_Y: 220,
    UNION_OFFSET_Y: 60,    // Vertical distance from Parent to Union
    MIN_NODE_GAP: 20,
    TARGET_LEVEL_HEIGHT: 200, // Vertical distance between generations
    HARD_MIN_Y_GAP: 40,    // Minimum gap to prevent overlap
    RECENTER_STRENGTH: 0.1 // How strongly parents align with children
};

// -- HELPER: RECENTER UNIONS --
function recenterUnions(specificUnionIds = null) {
  const allNodes = nodes.get();
  const unions = allNodes.filter(n => n.isUnion && n.spouseIds && n.spouseIds.length === 2);
  
  const updates = [];
  unions.forEach(u => {
     if (u.fixed) return; 

     if (specificUnionIds && !specificUnionIds.includes(u.id)) return;

     const p1 = nodes.get(u.spouseIds[0]);
     const p2 = nodes.get(u.spouseIds[1]);
     
     if (p1 && p2) {
       const midX = (p1.x + p2.x) / 2;
       const targetY = ((p1.y + p2.y) / 2) + window.LAYOUT.UNION_OFFSET_Y;

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
    const nodesBody = network.body.nodes;
    const edgesBody = network.body.edges;
    
    const { TARGET_LEVEL_HEIGHT, HARD_MIN_Y_GAP, UNION_OFFSET_Y } = window.LAYOUT;

    Object.values(edgesBody).forEach(edge => {
        const n1 = nodesBody[edge.fromId];
        const n2 = nodesBody[edge.toId];
        
        if(!n1 || !n2) return;
        if(n1.options.physics === false || n2.options.physics === false) return;

        const n1Fixed = n1.options.fixed === true || (n1.options.fixed && n1.options.fixed.x && n1.options.fixed.y);
        const n2Fixed = n2.options.fixed === true || (n2.options.fixed && n2.options.fixed.x && n2.options.fixed.y);

        // 1. Spouse -> Union
        if (n2.options.isUnion && !n1.options.isUnion) {
            if (n2.y < n1.y + UNION_OFFSET_Y) {
               const needed = (n1.y + UNION_OFFSET_Y) - n2.y;
               if (!n2Fixed && !n1Fixed) {
                   n1.y -= needed * 0.5; 
                   n2.y += needed * 0.5; 
                   n1.vy = 0; n2.vy = 0; 
               } else if (!n2Fixed) {
                   n2.y += needed; n2.vy = 0;
               } else if (!n1Fixed) {
                   n1.y -= needed; n1.vy = 0;
               }
            }

            // X Cohesion
            const dx = n1.x - n2.x;
            const targetDist = 100;
            if (Math.abs(dx) > targetDist) {
                 const pull = (Math.abs(dx) - targetDist) * 0.08; 
                 if (n1.x > n2.x) { if (!n1Fixed) n1.x -= pull; } 
                 else { if (!n1Fixed) n1.x += pull; }
            }
        }

        // 2. Parent -> Child
        else {
             let isParentChild = false;
             if (n1.options.isUnion && !n2.options.isUnion) isParentChild = true;
             else if (!n1.options.isUnion && !n2.options.isUnion && edge.options.arrows === 'to') isParentChild = true;

             if (isParentChild) {
                 if (n2.y < n1.y + HARD_MIN_Y_GAP) {
                     const diff = (n1.y + HARD_MIN_Y_GAP) - n2.y;
                     if (!n1Fixed && !n2Fixed) {
                         n1.y -= diff * 0.5; n2.y += diff * 0.5;
                         n1.vy = 0; n2.vy = 0;
                     } else if (!n2Fixed) {
                         n2.y += diff; n2.vy = 0;
                     } else if (!n1Fixed) {
                         n1.y -= diff; n1.vy = 0;
                     }
                 }

                 const currentYDiff = n2.y - n1.y; 
                 if (currentYDiff < TARGET_LEVEL_HEIGHT) {
                     const distMissing = TARGET_LEVEL_HEIGHT - currentYDiff;
                     const force = Math.min(distMissing * 0.05, 10); 
                     if (!n1Fixed) n1.y -= force; 
                     if (!n2Fixed) n2.y += force; 
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

     if (type === 'parents') newY = parent.y - 35;
     else if (type === 'siblings') { newX = parent.x - 75; newY = parent.y; }
     else if (type === 'spouses') { newX = parent.x + 75; newY = parent.y; }

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
    const ease = 1 - Math.pow(1 - progress, 3); 
    
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
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function fixOverlap(yLevel) {
  const tolerance = 20; 
  const nodesOnLevel = nodes.get({ filter: n => Math.abs(n.y - yLevel) < tolerance });
  if (nodesOnLevel.length < 2) return;
  nodesOnLevel.sort((a, b) => a.x - b.x);

  const updates = [];
  let didMove = false;
  const MIN_NODE_GAP = window.LAYOUT.MIN_NODE_GAP;

  for (let i = 0; i < nodesOnLevel.length - 1; i++) {
    const leftNode = nodesOnLevel[i];
    const rightNode = nodesOnLevel[i+1];
    const leftW = (leftNode.isUnion || leftNode.isTrigger) ? 30 : 160;
    const rightW = (rightNode.isUnion || rightNode.isTrigger) ? 30 : 160;
    const minGap = (leftW/2 + rightW/2) + MIN_NODE_GAP;
    const currentDist = rightNode.x - leftNode.x;

    if (currentDist < minGap) {
      const pushDistance = minGap - currentDist;
      for (let j = i + 1; j < nodesOnLevel.length; j++) {
        const targetId = nodesOnLevel[j].id;
        if (nodesOnLevel[j].fixed) continue; 
        const existingUpdate = updates.find(u => u.id === targetId);
        const currentX = existingUpdate ? existingUpdate.x : nodesOnLevel[j].x;
        const newX = currentX + pushDistance;
        if(existingUpdate) existingUpdate.x = newX;
        else updates.push({ id: targetId, x: newX, y: nodesOnLevel[j].y });
      }
      didMove = true;
    }
  }

  if (didMove) animateNodes(updates);
  else recenterUnions();
}

window.animateNodes = animateNodes;
window.fixOverlap = fixOverlap;
