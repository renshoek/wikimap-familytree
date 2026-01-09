/* global nodes, edges, network, getNormalizedId, wordwrap, addTriggerNode */

// -- GLOBAL STATE --
window.familyCache = {}; 
window.siblingState = {}; 
window.hoveredNodeId = null;
window.activeTriggers = new Set(); 

// Track nodes that are currently fetching data
window.loadingNodes = new Set();
let spinnerLoopActive = false;

window.startSpinnerLoop = function() {
    if (spinnerLoopActive) return;
    spinnerLoopActive = true;
    
    function step() {
        if (window.loadingNodes.size === 0) {
            spinnerLoopActive = false;
            // Force one last redraw to clear spinners
            if (typeof network !== 'undefined' && network) network.redraw();
            return; 
        }
        if (typeof network !== 'undefined' && network) {
            network.redraw(); // Force canvas update for animation
        }
        requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
};

// -- CONSTANTS --
window.COLORS = {
  male: '#ADD8E6',   
  female: '#FFB6C1', 
  unknown: '#E0E0E0',
  union: '#444444',
  unionButton: '#FFFFFF',
  trigger: '#FFFFFF',
  ringButton: '#FFD700' 
};

// -- HELPER FUNCTIONS --

function getGenderColor(gender) {
  return window.COLORS[gender] || window.COLORS.unknown;
}

// Get True Position of a node (fallback to data if physics isn't ready)
function getPosition(nodeId) {
  try {
    const positions = network.getPositions([nodeId]);
    if (positions && positions[nodeId]) {
      return positions[nodeId];
    }
  } catch (e) {
    // Fallback
  }
  const node = nodes.get(nodeId);
  return node ? { x: node.x, y: node.y } : { x: 0, y: 0 };
}

// Lock Node Temporarily to prevent it flying away during expansion
// UPDATED: Default is now 1000ms (1 second)
function lockNodeTemporarily(nodeId, ms = 1000) {
  if (!nodes.get(nodeId)) return;
  
  // 1. Pin the node (Visual Lock)
  nodes.update({ id: nodeId, fixed: true });

  // 2. Schedule Unpin after 1 second
  setTimeout(() => {
    if (nodes.get(nodeId)) {
        nodes.update({ id: nodeId, fixed: false });
    }
  }, ms);

  // 3. Keep Physics Engine Awake (System Lock)
  const physicsDuration = 60000; // 60 seconds
  const start = Date.now();
  
  const interval = setInterval(() => {
    if (Date.now() - start > physicsDuration) {
        clearInterval(interval);
        return;
    }
    if (network) network.startSimulation();
  }, 500);
}

// Rename a node
function renameNode(oldId, newName, newQid, gender, lifeSpan) {
  const oldNode = nodes.get(oldId);
  const newId = newQid || getNormalizedId(newName);
  
  // UPDATED: Do NOT append lifeSpan to label. Store it in the node object.
  const updateData = { 
    id: newId, 
    label: wordwrap(newName, 15),
    color: { background: getGenderColor(gender), border: '#666' },
    lifeSpan: lifeSpan // Store here for custom drawing
  };

  if (newId !== oldId) {
    if (nodes.get(newId)) {
      nodes.remove(oldId); 
      const moves = [];
      edges.get().forEach(e => {
        if(e.from === oldId) moves.push({id:e.id, from: newId});
        if(e.to === oldId) moves.push({id:e.id, to: newId});
      });
      edges.update(moves);
    } else {
      nodes.remove(oldId);
      nodes.add({ ...oldNode, ...updateData });
      const moves = [];
      edges.get().forEach(e => {
        if(e.from === oldId) moves.push({id:e.id, from: newId});
        if(e.to === oldId) moves.push({id:e.id, to: newId});
      });
      edges.update(moves);
    }
    return newId;
  } else {
    nodes.update(updateData);
    return oldId;
  }
}
