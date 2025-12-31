/* global nodes, edges, getNormalizedId, wordwrap, unwrap, getSubPages, startLoading, stopLoading, fixOverlap, addTriggerNode */

// GLOBAL STATE
window.familyCache = {}; 
window.siblingState = {}; 
window.hoveredNodeId = null;

const COLORS = {
  male: '#ADD8E6',   
  female: '#FFB6C1', 
  unknown: '#E0E0E0',
  union: '#444444',
  trigger: '#FFFFFF'
};

function getGenderColor(gender) {
  return COLORS[gender] || COLORS.unknown;
}

// -- DATA & NODE MANAGEMENT --

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
      nodes.remove(oldId); // Merge
      // Re-link edges
      const moves = [];
      edges.get().forEach(e => {
        if(e.from === oldId) moves.push({id:e.id, from: newId});
        if(e.to === oldId) moves.push({id:e.id, to: newId});
      });
      edges.update(moves);
    } else {
      nodes.remove(oldId);
      nodes.add({ ...oldNode, ...updateData });
      // Re-link edges
      const moves = [];
      edges.get().forEach(e => {
        if(e.from === oldId) moves.push({id:e.id, from: newId});
        if(e.to === oldId) moves.push({id:e.id, to: newId});
      });
      edges.update(moves);
    }
    return newId;
  } else {
    // Just update color
    nodes.update(updateData);
    return oldId;
  }
}

// -- VISUAL BUILDERS --

function createUnionNode(p1Id, p2Id, childrenCount, x, y) {
  const ids = [p1Id, p2Id].sort();
  const unionId = `union_${ids[0]}_${ids[1]}`;
  
  if (!nodes.get(unionId)) {
    // 1. Create the Union Node (The convergence point)
    nodes.add({
      id: unionId,
      label: '', 
      shape: 'dot', 
      size: 4, 
      color: COLORS.union,
      x: x, 
      y: y,
      isUnion: true, 
      spouseIds: ids,
      fixed: true
    });

    // 2. Connect Partners to Union (Converging lines)
    edges.add([
      { from: p1Id, to: unionId, color: '#666', width: 1.5 },
      { from: p2Id, to: unionId, color: '#666', width: 1.5 }
    ]);

    // 3. Add Chevron Trigger if children exist
    if (childrenCount > 0) {
      addTriggerNode(unionId, 'children', childrenCount, x, y);
    }
  }
  return unionId;
}

function addTriggerNode(parentId, type, count, x, y) {
  if (count === 0) return;
  const triggerId = `trigger_${type}_${parentId}`;
  
  let label = '';
  let shape = 'circle';
  let size = 6;
  let font = { size: 12, color: '#000' };

  if (type === 'children') {
    label = '▼'; // Chevron Down
    // Position slightly below the union node
    if (x === undefined) {
      const parent = nodes.get(parentId);
      x = parent.x; 
      y = parent.y + 15;
    } else {
      y = y + 15;
    }
  } else if (type === 'parents') {
    label = '▲'; // Chevron Up
    const parent = nodes.get(parentId);
    x = parent.x;
    y = parent.y - 35;
  } else if (type === 'siblings') {
    // Hover toggle, handled differently
    return; 
  }

  if (!nodes.get(triggerId)) {
    nodes.add({
      id: triggerId,
      label: label,
      shape: 'box',
      color: { background: 'white', border: '#ccc' },
      font: font,
      x: x, 
      y: y,
      isTrigger: true,
      triggerType: type,
      parentId: parentId,
      fixed: true
    });
  }
}

// -- LOGIC --

function expandChildren(unionId, childrenIds) {
  const unionNode = nodes.get(unionId);
  if (!unionNode || childrenIds.length === 0) return;

  const startY = unionNode.y + 150; // Distance to children
  const startX = unionNode.x;

  const newNodes = [];
  const newEdges = [];
  
  // Calculate centering
  const totalW = (childrenIds.length - 1) * SPACING_X;
  let currentX = startX - (totalW / 2);

  childrenIds.forEach(child => {
    if (!nodes.get(child.id)) {
      newNodes.push({
        id: child.id,
        label: wordwrap(child.label, 15),
        color: { background: getGenderColor(child.gender), border: '#666' },
        shape: 'box',
        x: currentX,
        y: startY,
        fixed: true
      });
    }
    // Diverge from Union
    if (!edges.get({ filter: e => e.from === unionId && e.to === child.id }).length) {
      newEdges.push({ from: unionId, to: child.id, arrows: 'to', color: '#666' });
    }
    currentX += SPACING_X;
  });

  nodes.add(newNodes);
  edges.add(newEdges);
  
  // Remove trigger after expanding
  nodes.remove(`trigger_children_${unionId}`);

  fixOverlap(startY);
  childrenIds.forEach(c => expandNode(c.id, true));
}

function expandParents(childId, parents) {
  const childNode = nodes.get(childId);
  const startY = childNode.y - 200;
  const startX = childNode.x;
  
  // Place parents centered above
  const newNodes = [];
  
  parents.forEach((p, i) => {
    // Offset parents: P1 Left, P2 Right
    const offset = (i === 0) ? -80 : 80;
    if (!nodes.get(p.id)) {
      newNodes.push({
        id: p.id,
        label: wordwrap(p.label, 15),
        color: { background: getGenderColor(p.gender), border: '#666' },
        shape: 'box',
        x: startX + offset,
        y: startY,
        fixed: true
      });
    }
  });
  nodes.add(newNodes);

  // Create Union for them
  if (parents.length === 2) {
    const unionY = startY + UNION_OFFSET_Y;
    createUnionNode(parents[0].id, parents[1].id, 1, startX, unionY); // 1 child (us)
    
    // Connect Union -> Child
    const ids = [parents[0].id, parents[1].id].sort();
    const unionId = `union_${ids[0]}_${ids[1]}`;
    edges.add({ from: unionId, to: childId, arrows: 'to', color: '#666' });
  } else if (parents.length === 1) {
    // Single parent line
    edges.add({ from: parents[0].id, to: childId, arrows: 'to', color: '#666' });
  }

  nodes.remove(`trigger_parents_${childId}`);
  fixOverlap(startY);
  parents.forEach(p => expandNode(p.id, true));
}

function expandNode(id, isSilent = false) {
  if (!isSilent) startLoading();

  let promise;
  if (window.familyCache[id]) promise = Promise.resolve(window.familyCache[id]);
  else {
    const node = nodes.get(id);
    if (!node) { stopLoading(); return; }
    promise = getSubPages(unwrap(node.label)).then(data => {
      const finalId = renameNode(id, data.redirectedTo, data.id, data.gender);
      data.id = finalId; window.familyCache[finalId] = data; return data;
    });
  }

  promise.then(data => {
    const node = nodes.get(data.id);
    if (!node) return;

    // 1. Spouses & Unions (Convergence)
    const spouses = data.family.spouses;
    const allChildren = data.family.children;
    const mappedChildren = new Set();

    if (spouses.length > 0) {
      let spouseX = node.x + SPACING_X;
      
      spouses.forEach(spouse => {
        // Place Spouse
        if (!nodes.get(spouse.id)) {
          nodes.add({
            id: spouse.id,
            label: wordwrap(spouse.label, 15),
            color: { background: getGenderColor(spouse.gender), border: '#666' },
            shape: 'box',
            x: spouseX,
            y: node.y,
            fixed: true
          });
          expandNode(spouse.id, true);
        } else {
           // If exists, use its position
           spouseX = nodes.get(spouse.id).x + SPACING_X;
        }

        // CONVERGENCE POINT (Union)
        // Position: Below and between
        const sNode = nodes.get(spouse.id);
        const unionX = (node.x + sNode.x) / 2;
        const unionY = node.y + UNION_OFFSET_Y;

        // Find specific children
        const unionChildren = allChildren.filter(c => c.otherParents && c.otherParents.includes(spouse.id));
        unionChildren.forEach(c => mappedChildren.add(c.id));

        const unionId = createUnionNode(data.id, spouse.id, unionChildren.length, unionX, unionY);
        
        // Tag union with specific children for expansion later
        if(unionChildren.length > 0) {
           nodes.update({ id: unionId, childrenIds: unionChildren });
        }
      });
      fixOverlap(node.y);
    }
    
    // 2. Parents
    if (data.family.parents.length > 0) {
      addTriggerNode(data.id, 'parents', data.family.parents.length);
    }

    if (!isSilent) stopLoading();
  }).catch(err => { console.error(err); if(!isSilent) stopLoading(); });
}

// -- SIBLING TOGGLE LOGIC (HOVER TRIGGER) --
window.showSiblingToggle = function(nodeId) {
  const node = nodes.get(nodeId);
  const data = window.familyCache[nodeId];
  if (!data || !data.family.siblings || data.family.siblings.length === 0) return;
  
  const triggerId = `trigger_siblings_${nodeId}`;
  if (nodes.get(triggerId)) return; // Already shown

  const isExpanded = window.siblingState[nodeId];

  nodes.add({
    id: triggerId,
    label: isExpanded ? 'Hide ><' : 'Siblings ><',
    shape: 'box',
    color: { background: '#fff', border: '#888' },
    font: { size: 10, color: '#555' },
    x: node.x,
    y: node.y + 40, // Float below
    isTrigger: true,
    triggerType: 'siblings',
    parentId: nodeId,
    fixed: true
  });
};

window.hideSiblingToggle = function(nodeId) {
  // We remove the toggle if the mouse leaves the node area?
  // Use a timeout to allow moving mouse to the button
  setTimeout(() => {
    if (window.hoveredNodeId !== nodeId && window.hoveredNodeId !== `trigger_siblings_${nodeId}`) {
      nodes.remove(`trigger_siblings_${nodeId}`);
    }
  }, 200);
};

window.toggleSiblings = function(nodeId) {
  const data = window.familyCache[nodeId];
  if (!data) return;
  
  const siblings = data.family.siblings;
  const isExpanded = window.siblingState[nodeId];
  const node = nodes.get(nodeId);

  if (isExpanded) {
    // Hide
    const ids = siblings.map(s => s.id).filter(id => id !== nodeId);
    nodes.remove(ids);
    window.siblingState[nodeId] = false;
  } else {
    // Show (To the LEFT usually, to avoid spouses on Right)
    const newNodes = [];
    let currentX = node.x - SPACING_X;

    siblings.forEach(sib => {
      if (sib.id === nodeId) return;
      if (!nodes.get(sib.id)) {
        newNodes.push({
          id: sib.id,
          label: wordwrap(sib.label, 15),
          color: { background: getGenderColor(sib.gender), border: '#666' },
          shape: 'box',
          x: currentX,
          y: node.y,
          fixed: true
        });
      }
      currentX -= SPACING_X;
    });
    nodes.add(newNodes);
    fixOverlap(node.y);
    siblings.forEach(s => { if(s.id !== nodeId) expandNode(s.id, true); });
    window.siblingState[nodeId] = true;
  }
};

window.handleTriggerClick = function(nodeId) {
  const trigger = nodes.get(nodeId);
  if (!trigger) return;

  if (trigger.triggerType === 'parents') {
    const data = window.familyCache[trigger.parentId];
    if (data) expandParents(trigger.parentId, data.family.parents);
  } 
  else if (trigger.triggerType === 'children') {
    const unionNode = nodes.get(trigger.parentId); // The Union Node
    if (unionNode && unionNode.childrenIds) {
       expandChildren(trigger.parentId, unionNode.childrenIds);
    }
  }
  else if (trigger.triggerType === 'siblings') {
     window.toggleSiblings(trigger.parentId);
     // Update button label
     const isExpanded = window.siblingState[trigger.parentId];
     nodes.update({ id: nodeId, label: isExpanded ? 'Hide ><' : 'Siblings ><' });
  }
};