/* global nodes, network, updateNodeValue */

// CONFIGURATION
const SPACING_X = 160; 
const SPACING_Y = 220; 
const UNION_OFFSET_Y = 60; // Vertical distance from Parent to Union
const MIN_NODE_GAP = 20; 

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
    const nodesBody = network.body.nodes;
    const edgesBody = network.body.edges;
    
    // Target height for Child levels
    const TARGET_LEVEL_HEIGHT = 280; 

    Object.values(edgesBody).forEach(edge => {
        const n1 = nodesBody[edge.fromId];
        const n2 = nodesBody[edge.toId];
        
        if(!n1 || !n2) return;
        if(n1.options.physics === false || n2.options.physics === false) return;

        // 1. Spouse -> Union (Vertical Placement Logic)
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

        // 2. Vertical Separation (Parent/Union -> Child)
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
     } else if (type === 'siblings') {
         newY = parent.y + 40;
     } else if (type === 'spouses') {
         newX = parent.x + 40;
         newY = parent.y - 30;
     }

     trigger.x = newX;
     trigger.y = newY;
  });
};

function animateNodes(updates) {
  const duration = 600; // Increased duration for smoother "growth"
  const start = performance.now();
  const initialPositions = {};
  
  updates.forEach(u => {
    const node = nodes.get(u.id);
    if(node) {
        initialPositions[u.id] = { 
            x: node.x, 
            y: node.y,
            // Capture initial font size for scaling animation
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

      // Animate Font Size if provided (This creates the growing effect)
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

function fixOverlap(yLevel) {
  const tolerance = 20; 
  const nodesOnLevel = nodes.get({
    filter: n => Math.abs(n.y - yLevel) < tolerance
  });

  if (nodesOnLevel.length < 2) return;

  nodesOnLevel.sort((a, b) => a.x - b.x);

  const updates = [];
  let didMove = false;

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
        const existingUpdate = updates.find(u => u.id === targetId);
        const currentX = existingUpdate ? existingUpdate.x : nodesOnLevel[j].x;
        
        const newX = currentX + pushDistance;

        if(existingUpdate) {
            existingUpdate.x = newX;
        } else {
            updates.push({ id: targetId, x: newX, y: nodesOnLevel[j].y });
        }
      }
      didMove = true;
    }
  }

  if (didMove) {
    animateNodes(updates);
  } else {
    recenterUnions();
  }
}

// EXPORTS
window.animateNodes = animateNodes;
window.fixOverlap = fixOverlap;
