/* global nodes, network, updateNodeValue */

// CONFIGURATION
const SPACING_X = 160; 
const SPACING_Y = 220; 
const UNION_OFFSET_Y = 60;
const MIN_NODE_GAP = 20; 

// -- HELPER: RECENTER UNIONS --
// This function moves union nodes to the exact center of their spouses.
// It is called during animation steps to ensure connection points don't detach.
function recenterUnions(specificUnionIds = null) {
  // Find all unions
  const allNodes = nodes.get();
  const unions = allNodes.filter(n => n.isUnion && n.spouseIds && n.spouseIds.length === 2);
  
  const updates = [];
  unions.forEach(u => {
     // If we are only updating specific ones (optimization), skip others
     if (specificUnionIds && !specificUnionIds.includes(u.id)) return;

     const p1 = nodes.get(u.spouseIds[0]);
     const p2 = nodes.get(u.spouseIds[1]);
     
     if (p1 && p2) {
       const midX = (p1.x + p2.x) / 2;
       // Only update if moved significantly
       if (Math.abs(u.x - midX) > 1) {
         updates.push({ id: u.id, x: midX });
       }
     }
  });
  
  if (updates.length > 0) nodes.update(updates);
}

// Make globally available
window.recenterUnions = recenterUnions;


// -- ANIMATION ENGINE --
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
    
    // 1. Move the regular nodes
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
      // 2. FORCE UNIONS TO FOLLOW
      recenterUnions();
    }

    if (progress < 1) {
      requestAnimationFrame(step);
    }
  }
  requestAnimationFrame(step);
}

// -- OVERLAP FIXER --
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
    // Even if no overlap, ensure unions are centered (for initial placements)
    recenterUnions();
  }
}
