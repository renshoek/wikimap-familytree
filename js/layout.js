/* global nodes, network, updateNodeValue */

// CONFIGURATION
const SPACING_X = 160; 
const SPACING_Y = 220; 
const UNION_OFFSET_Y = 60;
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
       const midX = (p1.x + p2.x) / 2;
       if (Math.abs(u.x - midX) > 1) {
         updates.push({ id: u.id, x: midX });
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
    
    // CHANGED: Increased target height (matching 250 length)
    const TARGET_LEVEL_HEIGHT = 230; 

    Object.values(edgesBody).forEach(edge => {
        const n1 = nodesBody[edge.fromId];
        const n2 = nodesBody[edge.toId];
        
        if(!n1 || !n2) return;
        if(n1.options.physics === false || n2.options.physics === false) return;

        // 1. Spouse -> Union (Horizontal Alignment & Cohesion)
        if (n2.options.isUnion && !n1.options.isUnion) {
            // Y Alignment
            const dy = n1.y - n2.y;
            if (Math.abs(dy) > 1) {
                const force = dy * 0.1; 
                n1.y -= force; 
                n2.y += force; 
            }
            
            // X Cohesion
            // CHANGED: targetDist 150 (since edge length is 180)
            const dx = n1.x - n2.x;
            const targetDist = 150; 
            
            // Only pull if they drift further than targetDist
            if (Math.abs(dx) > targetDist + 20) {
                 const pull = (Math.abs(dx) - targetDist) * 0.05;
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
                 // If Child is above Parent or too close
                 if (currentYDiff < TARGET_LEVEL_HEIGHT) {
                     const distMissing = TARGET_LEVEL_HEIGHT - currentYDiff;
                     const force = Math.min(distMissing * 0.08, 10); 
                     
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
  const duration = 400; // ms
  const start = performance.now();
  const initialPositions = {};
  
  updates.forEach(u => {
    const node = nodes.get(u.id);
    if(node) initialPositions[u.id] = { x: node.x, y: node.y };
  });

  function step(time) {
    const progress = Math.min((time - start) / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 3); // Cubic Ease Out
    
    const frameUpdates = updates.map(u => {
      const init = initialPositions[u.id];
      if (!init) return null;
      return {
        id: u.id,
        x: init.x + (u.x - init.x) * ease,
        y: init.y + (u.y - init.y) * ease
      };
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
