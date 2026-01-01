/* global nodes, edges, network, getNormalizedId, wordwrap, unwrap, getSubPages, startLoading, stopLoading, fixOverlap, addTriggerNode, recenterUnions, animateNodes */

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

// -- HELPER: Get True Position --
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

// -- HELPER: Lock Node Temporarily --
function lockNodeTemporarily(nodeId, ms = 5000) {
  if (!nodes.get(nodeId)) return;
  nodes.update({ id: nodeId, fixed: true });
  setTimeout(() => {
    if (nodes.get(nodeId)) {
        nodes.update({ id: nodeId, fixed: false });
    }
  }, ms);
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
  const triggerId = `trigger_${type}_${parentId}`;
  
  let label = '';
  let icon = '';
  let font = { size: 12, color: '#000' };
  let color = { background: 'white', border: '#ccc' };

  const parentPos = getPosition(parentId);

  if (type === 'children') {
    return; 
  } else if (type === 'parents') {
    icon = '▲'; 
    if(parentPos) { x = parentPos.x; y = parentPos.y - 35; }
  } else if (type === 'spouses') {
    icon = '💍'; 
    if(parentPos) { x = parentPos.x + 30; y = parentPos.y - 30; }
    color = { background: '#fff', border: '#FFD700' }; 
  } else if (type === 'siblings') {
    icon = '⇄';
    if(parentPos) { x = parentPos.x - 30; y = parentPos.y - 30; }
    font = { size: 12, color: '#000' };
    color = { background: '#fff', border: '#888' };
  }

  // Add number if count is provided and > 0 (and not parents/children which don't request it)
  if (type !== 'parents' && type !== 'children' && typeof count === 'number' && count > 0) {
      label = count + '\n' + icon;
  } else {
      label = icon;
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
  lockNodeTemporarily(unionId);

  const pos = getPosition(unionId);
  if (!pos || !childrenIds || childrenIds.length === 0) return;

  const startY = pos.y + 150; 
  const startX = pos.x;

  const newNodes = [];
  const newEdges = [];
  const animationTargets = [];
  
  const totalW = (childrenIds.length - 1) * 160; 
  let currentX = startX - (totalW / 2);

  childrenIds.forEach(child => {
    if (!nodes.get(child.id)) {
      newNodes.push({
        id: child.id,
        label: wordwrap(child.label, 15),
        color: { background: getGenderColor(child.gender), border: '#666' },
        shape: 'box',
        font: { size: 0 }, 
        x: pos.x, 
        y: pos.y, 
      });
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
  
  if (animationTargets.length > 0) {
      if(window.animateNodes) window.animateNodes(animationTargets);
      setTimeout(() => { if(window.fixOverlap) window.fixOverlap(startY); }, 650);
  } else {
      if(window.fixOverlap) window.fixOverlap(startY);
  }

  childrenIds.forEach(c => expandNode(c.id, true));
}

function expandParents(childId, parents) {
  lockNodeTemporarily(childId);

  const pos = getPosition(childId);
  
  const startY = pos.y - 250; 
  let startX = pos.x;
  
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
      nodes.update({ id: childId, x: pos.x + shift });
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
        font: { size: 0 }, 
        x: pos.x,    
        y: pos.y,
      });
      animationTargets.push({ id: p.id, x: targetX, y: startY, fontSize: 14 });
    }
  });
  nodes.add(newNodes);

  if (parents.length === 2) {
    const unionY = startY + 60;
    const unionId = createUnionNode(parents[0].id, parents[1].id, 1, startX, unionY);
    nodes.update({ id: unionId, x: pos.x, y: pos.y }); 
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

  lockNodeTemporarily(nodeId);

  const pos = getPosition(nodeId);

  const spouses = data.family.spouses;
  const allChildren = data.family.children;

  let spouseX = pos.x + 160;
  const animationTargets = [];
  
  spouses.forEach(spouse => {
    let targetX = spouseX;
    
    if (!nodes.get(spouse.id)) {
      nodes.add({
        id: spouse.id,
        label: wordwrap(spouse.label, 15),
        color: { background: getGenderColor(spouse.gender), border: '#666' },
        shape: 'box',
        font: { size: 0 }, 
        x: pos.x,         
        y: pos.y,
      });
      animationTargets.push({ id: spouse.id, x: targetX, y: pos.y, fontSize: 14 });
      
      expandNode(spouse.id, true);
      spouseX += 160;
    } else {
        const spousePos = getPosition(spouse.id);
        targetX = spousePos.x;
        spouseX = spousePos.x + 160;
    }

    const finalSpouseX = (nodes.get(spouse.id) ? (animationTargets.find(t=>t.id===spouse.id)?.x || getPosition(spouse.id).x) : targetX);
    const unionX = (pos.x + finalSpouseX) / 2;
    const unionY = pos.y + 60;

    const unionChildren = allChildren.filter(c => {
        if (!c.otherParents || c.otherParents.length === 0) return false;
        return c.otherParents.includes(spouse.id);
    });
    
    const unionId = createUnionNode(data.id, spouse.id, unionChildren.length, unionX, unionY);
    nodes.update({ id: unionId, x: pos.x, y: pos.y });
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
      setTimeout(() => { if(window.fixOverlap) window.fixOverlap(pos.y); }, 650);
  } else {
      if(window.fixOverlap) window.fixOverlap(pos.y);
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

    // Handle Spouses: Count unshown, and skip if 1 already shown.
    if (data.family.spouses.length > 0) {
       const unshownSpouses = data.family.spouses.filter(s => !nodes.get(s.id)).length;
       const hideSpouseTrigger = (data.family.spouses.length === 1 && unshownSpouses === 0);
       
       if (!hideSpouseTrigger) {
           addTriggerNode(data.id, 'spouses', unshownSpouses);
       }
    }

    // Handle Parents (no numbers requested)
    if (data.family.parents.length > 0) {
      addTriggerNode(data.id, 'parents', null);
    }

    // Handle Siblings: Count unshown
    if (data.family.siblings && data.family.siblings.length > 0) {
      const unshownSiblings = data.family.siblings.filter(s => !nodes.get(s.id)).length;
      addTriggerNode(data.id, 'siblings', unshownSiblings);
    }

    if (!isSilent) stopLoading();
  }).catch(err => { console.error(err); if(!isSilent) stopLoading(); });
}

window.toggleSiblings = function(nodeId) {
  const data = window.familyCache[nodeId];
  if (!data) return;

  lockNodeTemporarily(nodeId);
  
  const siblings = data.family.siblings;
  const isExpanded = window.siblingState[nodeId];
  const node = nodes.get(nodeId);
  const pos = getPosition(nodeId);

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
       spouses.forEach(s => { 
           const p = getPosition(s.id); 
           if(p) spouseXTotal += p.x; 
       });
       const avg = spouseXTotal / spouses.length;
       if (avg < pos.x) direction = 1; 
       else direction = -1;
    }
    
    const spacing = direction * 160;
    let currentX = pos.x + spacing;
    
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
          font: { size: 0 }, 
          x: pos.x,         
          y: pos.y,
        });
        
        animationTargets.push({ id: sib.id, x: currentX, y: pos.y, fontSize: 14 });
        
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
        setTimeout(() => { if(window.fixOverlap) window.fixOverlap(pos.y); }, 650);
    } else {
        if(window.fixOverlap) window.fixOverlap(pos.y);
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
     
     // Update label: if Expanded -> '✕', if Collapsed -> 'count\n⇄'
     let label = '✕';
     if (!isExpanded) {
        const data = window.familyCache[trigger.parentId];
        // We just collapsed, so calculate unshown count (should be all)
        const unshown = data.family.siblings.filter(s => !nodes.get(s.id)).length;
        label = (unshown > 0 ? unshown + '\n' : '') + '⇄';
     }
     nodes.update({ id: nodeId, label: label });
  }
  else if (trigger.triggerType === 'spouses') {
      expandSpouses(trigger.parentId);
  }
};
