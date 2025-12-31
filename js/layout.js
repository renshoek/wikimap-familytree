/* global nodes, network, updateNodeValue */

// CONFIGURATION
const SPACING_X = 160; 
const SPACING_Y = 220; 
const UNION_OFFSET_Y = 60; // How far down the "connection point" is
const MIN_NODE_GAP = 20; 

// -- ANIMATION ENGINE --
// Smoothly interpolate node positions over time
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

    nodes.update(frameUpdates);

    if (progress < 1) {
      requestAnimationFrame(step);
    }
  }
  requestAnimationFrame(step);
}

// -- OVERLAP FIXER --
// Ensures nodes on the same Y-level do not touch
function fixOverlap(yLevel) {
  const tolerance = 20; // Y-level tolerance
  const nodesOnLevel = nodes.get({
    filter: n => Math.abs(n.y - yLevel) < tolerance
  });

  if (nodesOnLevel.length < 2) return;

  // Sort by X position
  nodesOnLevel.sort((a, b) => a.x - b.x);

  const updates = [];
  let didMove = false;

  for (let i = 0; i < nodesOnLevel.length - 1; i++) {
    const leftNode = nodesOnLevel[i];
    const rightNode = nodesOnLevel[i+1];

    // Determine widths based on type
    const leftW = (leftNode.isUnion || leftNode.isTrigger) ? 30 : 160;
    const rightW = (rightNode.isUnion || rightNode.isTrigger) ? 30 : 160;

    const minGap = (leftW/2 + rightW/2) + MIN_NODE_GAP;
    const currentDist = rightNode.x - leftNode.x;

    if (currentDist < minGap) {
      const pushDistance = minGap - currentDist;
      
      // Push ALL subsequent nodes to the right
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
    
    // After moving nodes, we must re-center their Unions or Children connections if needed.
    // This is complex, but for now we rely on the visual connectors being flexible.
    // A more advanced solver would recurse up/down the tree.
  }
}