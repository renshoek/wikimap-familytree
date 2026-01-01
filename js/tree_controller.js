/* global nodes, edges, getNormalizedId, wordwrap, unwrap, getSubPages, startLoading, stopLoading, fixOverlap, addTriggerNode, recenterUnions, animateNodes */

// GLOBAL STATE
window.familyCache = {}; 
window.siblingState = {}; 
window.hoveredNodeId = null;
window.activeTriggers = new Set(); 

const COLORS = {
  male: '#ADD8E6',   
  female: '#FFB6C1', 
  unknown: '#E0E0E0',
  union: '#444444',
  unionButton: '#FFFFFF',
  trigger: '#FFFFFF',
  ringButton: '#FFD700' 
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

// -- VISUAL BUILDERS --

function updateUnionState(unionId, hasChildren) {
    if (!nodes.get(unionId)) return;
    
    if (hasChildren) {
        nodes.update({
            id: unionId,
            label: '▼',
            shape: 'circle', 
            size: 15,
            color: { background: '#fff', border: '#444' },
            font: { size: 14, color: '#000', face: 'arial' },
            borderWidth: 1,
            isUnion: true,
        });
    } else {
        nodes.update({
            id: unionId,
            label: '',
            shape: 'dot',
            size: 5,
            color: COLORS.union,
            font: { size: 0 },
            borderWidth: 1,
            isUnion: true,
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
    });

    // 2. Connect Partners
    edges.add([
      { from: p1Id, to: unionId, color: '#666', width: 1.5, length: 180 },
      { from: p2Id, to: unionId, color: '#666', width: 1.5, length: 180 }
    ]);
  }
  
  updateUnionState(unionId, hasChildren);
  
  return unionId;
}

function addTriggerNode(parentId, type, count, x, y) {
  if (count === 0) return;
  const triggerId = `trigger_${type}_${parentId}`;
  
  let label = '';
  let font = { size: 12, color: '#000' };
  let color = { background: 'white', border: '#ccc' };

  if (type === 'children') {
    return; 
  } else if (type === 'parents') {
    label = '▲'; 
    const parent = nodes.get(parentId);
    if(parent) { x = parent.x; y = parent.y - 35; }
  } else if (type === 'spouses') {
    label = '💍'; 
    const parent = nodes.get(parentId);
    if(parent) { x = parent.x + 30; y = parent.y - 30; }
    color = { background: '#fff', border: '#FFD700' }; 
  }

  if (!nodes.get(triggerId)) {
    nodes.add({
      id: triggerId,
      label: label,
      shape: 'box',
      color: color,
      font: font,
      x: x, 
      y: y,
      isTrigger: true,
      triggerType: type,
      parentId: parentId,
      physics: false 
    });
    window.activeTriggers.add(triggerId);
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
  const animationTargets = [];
  
  const totalW = (childrenIds.length - 1) * 160; 
  let currentX = startX - (totalW / 2);

  childrenIds.forEach(child => {
    if (!nodes.get(child.id)) {
      // START at source position (unionNode) with Size 0
      newNodes.push({
        id: child.id,
        label: wordwrap(child.label, 15),
        color: { background: getGenderColor(child.gender), border: '#666' },
        shape: 'box',
        font: { size: 0 }, // Start tiny
        x: unionNode.x, 
        y: unionNode.y,
      });
      // ANIMATE to target position and Size 14
      animationTargets.push({ id: child.id, x: currentX, y: startY, fontSize: 14 });
    }
    if (!edges.get({ filter: e => e.from === unionId && e.to === child.id }).length) {
      newEdges.push({ from: unionId, to: child.id, arrows: 'to', color: '#666' });
    }
    currentX += 160;
  });

  nodes.add(newNodes);
  edges.add(newEdges);
  updateUnionState(unionId, false);
  
  // Trigger animation
  if (animationTargets.length > 0) {
      if(window.animateNodes) window.animateNodes(animationTargets);
      // Run fixOverlap AFTER animation so it doesn't try to fix nodes stacked at source
      setTimeout(() => { if(window.fixOverlap) window.fixOverlap(startY); }, 650);
  } else {
      if(window.fixOverlap) window.fixOverlap(startY);
  }

  childrenIds.forEach(c => expandNode(c.id, true));
}

function expandParents(childId, parents) {
  const childNode = nodes.get(childId);
  const startY = childNode.y - 250; 
  let startX = childNode.x;
  
  // Logic to shift child if space is needed
  const levelNodes = nodes.get({
    filter: n => Math.abs(n.y - startY) < 20 && n.x < startX
  });
  if (levelNodes.length > 0) {
    const rightMostX = Math.max(...levelNodes.map(n => n.x));
    const myLeftMostX = startX - 80;
    const padding = 50;
    if (myLeftMostX < rightMostX + padding) {
      const shift = (rightMostX + padding) - myLeftMostX;
      startX += shift;
      // We don't animate the child shift here to keep it simple
      nodes.update({ id: childId, x: childNode.x + shift });
      if (typeof window.recenterUnions === 'function') window.recenterUnions();
    }
  }

  const newNodes = [];
  const animationTargets = [];

  parents.forEach((p, i) => {
    const offset = (i === 0) ? -80 : 80;
    const targetX = startX + offset;
    
    if (!nodes.get(p.id)) {
      newNodes.push({
        id: p.id,
        label: wordwrap(p.label, 15),
        color: { background: getGenderColor(p.gender), border: '#666' },
        shape: 'box',
        font: { size: 0 }, // Start tiny
        x: childNode.x,    // Start at child (growing Up)
        y: childNode.y,
      });
      animationTargets.push({ id: p.id, x: targetX, y: startY, fontSize: 14 });
    }
  });
  nodes.add(newNodes);

  // Handle Union creation and animation
  if (parents.length === 2) {
    const unionY = startY + 60;
    const unionId = createUnionNode(parents[0].id, parents[1].id, 1, startX, unionY);
    
    // Snap union to child and animate up
    nodes.update({ id: unionId, x: childNode.x, y: childNode.y }); 
    animationTargets.push({ id: unionId, x: startX, y: unionY });

    const ids = [parents[0].id, parents[1].id].sort();
    edges.add({ from: unionId, to: childId, arrows: 'to', color: '#666', length: 250 });
  } else if (parents.length === 1) {
    edges.add({ from: parents[0].id, to: childId, arrows: 'to', color: '#666', length: 250 });
  }

  const triggerId = `trigger_parents_${childId}`;
  nodes.remove(triggerId);
  window.activeTriggers.delete(triggerId);

  if (animationTargets.length > 0) {
      if(window.animateNodes) window.animateNodes(animationTargets);
      setTimeout(() => { if(window.fixOverlap) window.fixOverlap(startY); }, 650);
  } else {
      if(window.fixOverlap) window.fixOverlap(startY);
  }

  parents.forEach(p => expandNode(p.id, true));
}

function expandSpouses(nodeId) {
  const data = window.familyCache[nodeId];
  if(!data) return;

  const node = nodes.get(nodeId);
  const spouses = data.family.spouses;
  const allChildren = data.family.children;

  let spouseX = node.x + 160;
  const animationTargets = [];
  
  spouses.forEach(spouse => {
    let targetX = spouseX;
    
    if (!nodes.get(spouse.id)) {
      nodes.add({
        id: spouse.id,
        label: wordwrap(spouse.label, 15),
        color: { background: getGenderColor(spouse.gender), border: '#666' },
        shape: 'box',
        font: { size: 0 }, // Start tiny
        x: node.x,         // Start at source (growing Side)
        y: node.y,
      });
      animationTargets.push({ id: spouse.id, x: targetX, y: node.y, fontSize: 14 });
      
      expandNode(spouse.id, true);
      spouseX += 160;
    } else {
        const existingNode = nodes.get(spouse.id);
        targetX = existingNode.x;
        spouseX = existingNode.x + 160;
    }

    // Calc union position
    const finalSpouseX = (nodes.get(spouse.id) ? (animationTargets.find(t=>t.id===spouse.id)?.x || nodes.get(spouse.id).x) : targetX);
    const unionX = (node.x + finalSpouseX) / 2;
    const unionY = node.y + 60;

    const unionChildren = allChildren.filter(c => {
        if (!c.otherParents || c.otherParents.length === 0) return false;
        return c.otherParents.includes(spouse.id);
    });
    
    const unionId = createUnionNode(data.id, spouse.id, unionChildren.length, unionX, unionY);
    
    // Snap union to source and animate
    nodes.update({ id: unionId, x: node.x, y: node.y });
    animationTargets.push({ id: unionId, x: unionX, y: unionY });
    
    if(unionChildren.length > 0) {
        nodes.update({ id: unionId, childrenIds: unionChildren });
        updateUnionState(unionId, true);
    }
  });

  const triggerId = `trigger_spouses_${nodeId}`;
  nodes.remove(triggerId);
  window.activeTriggers.delete(triggerId);

  if (animationTargets.length > 0) {
      if(window.animateNodes) window.animateNodes(animationTargets);
      setTimeout(() => { if(window.fixOverlap) window.fixOverlap(node.y); }, 650);
  } else {
      if(window.fixOverlap) window.fixOverlap(node.y);
  }
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

    if (data.family.spouses.length > 0) {
       addTriggerNode(data.id, 'spouses', data.family.spouses.length);
    }
    if (data.family.parents.length > 0) {
      addTriggerNode(data.id, 'parents', data.family.parents.length);
    }

    if (!isSilent) stopLoading();
  }).catch(err => { console.error(err); if(!isSilent) stopLoading(); });
}

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
    physics: false 
  });
  window.activeTriggers.add(triggerId);
};

window.hideSiblingToggle = function(nodeId) {
  setTimeout(() => {
    const triggerId = `trigger_siblings_${nodeId}`;
    if (window.hoveredNodeId !== nodeId && window.hoveredNodeId !== triggerId) {
      nodes.remove(triggerId);
      window.activeTriggers.delete(triggerId);
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
    const animationTargets = [];

    let direction = -1; 
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
          font: { size: 0 }, // Start tiny
          x: node.x,         // Start at source (growing Side)
          y: node.y,
        });
        
        animationTargets.push({ id: sib.id, x: currentX, y: node.y, fontSize: 14 });
        
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
    
    if (animationTargets.length > 0) {
        if(window.animateNodes) window.animateNodes(animationTargets);
        setTimeout(() => { if(window.fixOverlap) window.fixOverlap(node.y); }, 650);
    } else {
        if(window.fixOverlap) window.fixOverlap(node.y);
    }

    window.siblingState[nodeId] = true;
  }
};

window.handleTriggerClick = function(nodeId) {
  const node = nodes.get(nodeId);
  if (!node) return;

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
  else if (trigger.triggerType === 'spouses') {
      expandSpouses(trigger.parentId);
  }
};
