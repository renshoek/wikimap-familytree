/* global nodes, edges, network, getNormalizedId, wordwrap */

// -- GLOBAL STATE --
window.familyCache = {}; 
window.siblingState = {}; 
window.hoveredNodeId = null;
window.activeTriggers = new Set(); 

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
function lockNodeTemporarily(nodeId, ms = 2000) {
  if (!nodes.get(nodeId)) return;
  nodes.update({ id: nodeId, fixed: true });
  setTimeout(() => {
    if (nodes.get(nodeId)) {
        nodes.update({ id: nodeId, fixed: false });
    }
  }, ms);
}

// Rename a node (used when we switch from a search term to a real Wikidata label)
function renameNode(oldId, newName, newQid, gender) {
  const oldNode = nodes.get(oldId);
  const newId = newQid || getNormalizedId(newName);
  
  const updateData = { 
    id: newId, 
    label: wordwrap(newName, 15),
    color: { background: getGenderColor(gender), border: '#666' }
  };

  if (newId !== oldId) {
    if (nodes.get(newId)) {
      // If the new ID already exists, merge/replace
      nodes.remove(oldId); 
      const moves = [];
      edges.get().forEach(e => {
        if(e.from === oldId) moves.push({id:e.id, from: newId});
        if(e.to === oldId) moves.push({id:e.id, to: newId});
      });
      edges.update(moves);
    } else {
      // Update ID by removing and re-adding
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
    // Just update properties
    nodes.update(updateData);
    return oldId;
  }
}