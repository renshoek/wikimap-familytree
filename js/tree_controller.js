/* global nodes, edges, getNormalizedId, wordwrap, unwrap, getSubPages, startLoading, stopLoading, fixOverlap, addTriggerNode, recenterUnions */

// GLOBAL STATE
window.familyCache = {}; 
window.siblingState = {}; 
window.hoveredNodeId = null;

const COLORS = {
  male: '#ADD8E6',   
  female: '#FFB6C1', 
  unknown: '#E0E0E0',
  union: '#444444',
  unionButton: '#FFFFFF',
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

function updateUnionState(unionId, hasChildren) {
    if (!nodes.get(unionId)) return;
    
    if (hasChildren) {
        // Show as Button
        nodes.update({
            id: unionId,
            label: '▼',
            shape: 'circle', // Circle looks better as a button
            size: 15,
            color: { background: '#fff', border: '#444' },
            font: { size: 14, color: '#000', face: 'arial' },
            borderWidth: 1,
            isUnion: true,
            fixed: true
        });
    } else {
        // Show as simple Dot
        nodes.update({
            id: unionId,
            label: '',
            shape: 'dot',
            size: 5,
            color: COLORS.union,
            font: { size: 0 },
            borderWidth: 1,
            isUnion: true,
            fixed: true
        });
    }
}

function createUnionNode(p1Id, p2Id, childrenCount, x, y) {
  const ids = [p1Id, p2Id].sort();
  const unionId = `union_${ids[0]}_${ids[1]}`;
  const hasChildren = childrenCount > 0;

  if (!nodes.get(unionId)) {
    // 1. Create Basic Node
    nodes.add({
      id: unionId,
      x: x, 
      y: y,
      isUnion: true, 
      spouseIds: ids,
      fixed: true
    });

    // 2. Connect Partners
    edges.add([
      { from: p1Id, to: unionId, color: '#666', width: 1.5 },
      { from: p2Id, to: unionId, color: '#666', width: 1.5 }
    ]);
  }
  
  // 3. Force Style Update
  updateUnionState(unionId, hasChildren);
  
  return unionId;
}

function addTriggerNode(parentId, type, count, x, y) {
  if (count === 0) return;
  const triggerId = `trigger_${type}_${parentId}`;
  
  let label = '';
  let font = { size: 12, color: '#000' };

  if (type === 'children') {
    return; // Handled by Union Node
  } else if (type === 'parents') {
    label = '▲'; 
    const parent = nodes.get(parentId);
    x = parent.x;
    y = parent.y - 35;
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
  if (!unionNode || !childrenIds || childrenIds.length === 0) return;

  const startY = unionNode.y + 150; 
  const startX = unionNode.x;

  const newNodes = [];
  const newEdges = [];
  
  const totalW = (childrenIds.length - 1) * 160; 
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
    // Check if edge exists
    if (!edges.get({ filter: e => e.from === unionId && e.to === child.id }).length) {
      newEdges.push({ from: unionId, to: child.id, arrows: 'to', color: '#666' });
    }
    currentX += 160;
  });

  nodes.add(newNodes);
  edges.add(newEdges);
  
  // Update Union Node to 'Expanded' state (Dot)
  updateUnionState(unionId, false);

  fixOverlap(startY);
  childrenIds.forEach(c => expandNode(c.id, true));
}

function expandParents(childId, parents) {
  const childNode = nodes.get(childId);
  const startY = childNode.y - 200;
  let startX = childNode.x;
  
  // GROUPING LOGIC
  const levelNodes = nodes.get({
    filter: n => Math.abs(n.y - startY) < 20 && n.x < startX
  });
  
  if (levelNodes.length > 0) {
    const rightMostX = Math.max(...levelNodes.map(n => n.x));
    const myLeftMostX = startX - 80;
    const padding = 50;

    if (myLeftMostX < rightMostX + padding) {
      const shift = (rightMostX + padding) - myLeftMostX;
      const newChildX = childNode.x + shift;
      nodes.update({ id: childId, x: newChildX });
      startX += shift;
      if (typeof window.recenterUnions === 'function') window.recenterUnions();
    }
  }

  const newNodes = [];
  parents.forEach((p, i) => {
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

  if (parents.length === 2) {
    const unionY = startY + 60;
    createUnionNode(parents[0].id, parents[1].id, 1, startX, unionY); // 1 child
    
    const ids = [parents[0].id, parents[1].id].sort();
    const unionId = `union_${ids[0]}_${ids[1]}`;
    edges.add({ from: unionId, to: childId, arrows: 'to', color: '#666' });
  } else if (parents.length === 1) {
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

    // 1. Spouses & Unions
    const spouses = data.family.spouses;
    const allChildren = data.family.children;

    if (spouses.length > 0) {
      let spouseX = node.x + 160;
      
      spouses.forEach(spouse => {
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
          spouseX += 160;
        } else {
           const existingNode = nodes.get(spouse.id);
           spouseX = existingNode.x + 160;
        }

        const sNode = nodes.get(spouse.id);
        const unionX = (node.x + sNode.x) / 2;
        const unionY = node.y + 60;

        // MATCH CHILDREN TO THIS COUPLE
        // Robust matching check
        const unionChildren = allChildren.filter(c => {
           if (!c.otherParents || c.otherParents.length === 0) return false;
           return c.otherParents.includes(spouse.id);
        });
        
        const unionId = createUnionNode(data.id, spouse.id, unionChildren.length, unionX, unionY);
        
        // Attach data for click handler
        if(unionChildren.length > 0) {
           nodes.update({ id: unionId, childrenIds: unionChildren });
           updateUnionState(unionId, true);
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

// -- SIBLING LOGIC --
window.showSiblingToggle = function(nodeId) {
  const node = nodes.get(nodeId);
  const data = window.familyCache[nodeId];
  if (!data || !data.family.siblings || data.family.siblings.length === 0) return;
  
  const triggerId = `trigger_siblings_${nodeId}`;
  if (nodes.get(triggerId)) return; 

  const isExpanded = window.siblingState[nodeId];
  nodes.add({
    id: triggerId,
    label: isExpanded ? 'Hide Siblings ><' : 'Siblings ><',
    shape: 'box',
    color: { background: '#fff', border: '#888' },
    font: { size: 10, color: '#555' },
    x: node.x,
    y: node.y + 40,
    isTrigger: true,
    triggerType: 'siblings',
    parentId: nodeId,
    fixed: true
  });
};

window.hideSiblingToggle = function(nodeId) {
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
    const ids = siblings.map(s => s.id).filter(id => id !== nodeId);
    nodes.remove(ids);
    window.siblingState[nodeId] = false;
  } else {
    const newNodes = [];
    const newEdges = [];

    // Direction logic: Opposite to spouses
    let direction = -1; // Default Left
    const spouses = data.family.spouses || [];
    if (spouses.length > 0) {
       let spouseXTotal = 0;
       spouses.forEach(s => { const n = nodes.get(s.id); if(n) spouseXTotal+=n.x; });
       const avg = spouseXTotal / spouses.length;
       if (avg < node.x) direction = 1; 
       else direction = -1;
    }
    
    const spacing = direction * 160;
    let currentX = node.x + spacing;
    
    let parentUnionId = null;
    if (data.family.parents && data.family.parents.length === 2) {
         const ids = [data.family.parents[0].id, data.family.parents[1].id].sort();
         const attemptId = `union_${ids[0]}_${ids[1]}`;
         if (nodes.get(attemptId)) parentUnionId = attemptId;
    }

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
        
        if (parentUnionId) {
            newEdges.push({ from: parentUnionId, to: sib.id, arrows: 'to', color: '#666' });
        } else {
            newEdges.push({ from: nodeId, to: sib.id, color: '#ccc', dashes: true });
        }
      }
      currentX += spacing;
    });
    nodes.add(newNodes);
    edges.add(newEdges);
    fixOverlap(node.y);
    window.siblingState[nodeId] = true;
  }
};

window.handleTriggerClick = function(nodeId) {
  const node = nodes.get(nodeId);
  if (!node) return;

  // Handles Union Button Clicks
  if (node.isUnion) {
     if (node.childrenIds && node.childrenIds.length > 0) {
        expandChildren(nodeId, node.childrenIds);
     }
     return;
  }

  const trigger = node;
  if (trigger.triggerType === 'parents') {
    const data = window.familyCache[trigger.parentId];
    if (data) expandParents(trigger.parentId, data.family.parents);
  } 
  else if (trigger.triggerType === 'siblings') {
     window.toggleSiblings(trigger.parentId);
     const isExpanded = window.siblingState[trigger.parentId];
     nodes.update({ id: nodeId, label: isExpanded ? 'Hide Siblings ><' : 'Siblings ><' });
  }
};
