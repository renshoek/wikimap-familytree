
/* global nodes, edges, network, getNormalizedId, wordwrap, unwrap, getSubPages, getPageById, startLoading, stopLoading, fixOverlap, recenterUnions, animateNodes */
/* global getGenderColor, getPosition, lockNodeTemporarily, renameNode, updateUnionState, createUnionNode, addTriggerNode, expandNode */

// -- LOGIC --

function disableSiblingPhysics(nodeId) {
  const connectedEdges = edges.get({
    filter: e => (e.from === nodeId || e.to === nodeId) && e.dashes === true
  });
  
  if (connectedEdges.length > 0) {
    const updates = connectedEdges.map(e => ({ id: e.id, physics: false }));
    edges.update(updates);
  }
}

function collapseChildren(unionId, childrenIds) {
  if (!childrenIds || childrenIds.length === 0) return;

  const idsToRemove = childrenIds.map(c => c.id);
  
  const triggersToRemove = [];
  idsToRemove.forEach(id => {
      triggersToRemove.push(`trigger_parents_${id}`);
      triggersToRemove.push(`trigger_spouses_${id}`);
      triggersToRemove.push(`trigger_siblings_${id}`);
  });

  nodes.remove([...idsToRemove, ...triggersToRemove]);
  updateUnionState(unionId, childrenIds.length);
}

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
        lifeSpan: child.lifeSpan 
      });
      animationTargets.push({ id: child.id, x: currentX, y: startY, fontSize: 14 });
    }
    if (!edges.get({ filter: e => e.from === unionId && e.to === child.id }).length) {
      // UPDATED: Reduced length to 150
      newEdges.push({ from: unionId, to: child.id, arrows: 'to', color: '#666', width: 0.5, length: 150 });
    }
    currentX += 160;
  });

  nodes.add(newNodes);
  edges.add(newEdges);
  
  updateUnionState(unionId, 'expanded');
  
  const unionNode = nodes.get(unionId);
  if (unionNode && unionNode.spouseIds) {
      unionNode.spouseIds.forEach(spouseId => disableSiblingPhysics(spouseId));
  }

  if (animationTargets.length > 0) {
      if(window.animateNodes) window.animateNodes(animationTargets);
      setTimeout(() => { if(window.fixOverlap) window.fixOverlap(startY); }, 650);
  } else {
      if(window.fixOverlap) window.fixOverlap(startY);
  }

  childrenIds.forEach(c => expandNode(c.id, true));
}

function expandParents(childId, parents, visited = new Set()) {
  if (visited.has(childId)) return;
  visited.add(childId);

  lockNodeTemporarily(childId);

  const pos = getPosition(childId);
  const startY = pos.y - 200; // UPDATED: Changed from -250 to -200 to spawn closer
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
        lifeSpan: p.lifeSpan 
      });
      animationTargets.push({ id: p.id, x: targetX, y: startY, fontSize: 14 });
    }
  });
  nodes.add(newNodes);

  const createEdgeSafe = (from, to) => {
      const exists = edges.get({ filter: e => e.from === from && e.to === to }).length > 0;
      if (!exists) {
          // UPDATED: Reduced length to 150
          edges.add({ from: from, to: to, arrows: 'to', color: '#666', width: 0.5, length: 150 });
      }
  };

  if (parents.length === 2) {
    // UPDATED: Calculate children count based on child + siblings
    let childCount = 1; // Start with the node itself
    const childCache = window.familyCache[childId];
    if (childCache && childCache.family && childCache.family.siblings) {
        childCount += childCache.family.siblings.length;
    }

    // UPDATED: Union Y adjusted to be closer (approx 100 below parents)
    const unionY = startY + 100;
    const unionId = createUnionNode(parents[0].id, parents[1].id, childCount, startX, unionY);
    
    if (!nodes.get(unionId)) { 
        nodes.update({ id: unionId, x: pos.x, y: pos.y }); 
        animationTargets.push({ id: unionId, x: startX, y: unionY });
    }
    createEdgeSafe(unionId, childId);

    // NEW: Auto-fetch parent data to find TRUE children count (hidden siblings)
    const p1 = parents[0].id;
    const p2 = parents[1].id;
    expandNode(p1, true).then(data => {
        if (data && nodes.get(unionId)) {
             const allChildren = data.family.children;
             // Filter children who share the other parent (p2)
             const unionChildren = allChildren.filter(c => c.otherParents && c.otherParents.includes(p2));
             
             if (unionChildren.length > 0) {
                 nodes.update({ id: unionId, childrenIds: unionChildren });
                 const curr = nodes.get(unionId);
                 // Only update the label (e.g. "4") if it isn't currently expanded ("✕")
                 if (curr && curr.label !== '✕') {
                     updateUnionState(unionId, unionChildren.length);
                 }
             }
        }
    });

  } else if (parents.length === 1) {
    createEdgeSafe(parents[0].id, childId);
  }

  disableSiblingPhysics(childId);

  const triggerId = `trigger_parents_${childId}`;
  if (nodes.get(triggerId)) {
      nodes.remove(triggerId);
      window.activeTriggers.delete(triggerId);
  }

  if (animationTargets.length > 0) {
      if(window.animateNodes) window.animateNodes(animationTargets);
      setTimeout(() => { if(window.fixOverlap) window.fixOverlap(startY); }, 650);
  } else {
      if(window.fixOverlap) window.fixOverlap(startY);
  }

  parents.forEach(p => expandNode(p.id, true));

  const childData = window.familyCache[childId];
  if (childData && childData.family && childData.family.siblings) {
      childData.family.siblings.forEach(sib => {
          if (sib.id !== childId && nodes.get(sib.id)) {
               expandNode(sib.id, true).then(sibData => {
                   if (sibData && sibData.family && sibData.family.parents.length > 0) {
                       expandParents(sibData.id, sibData.family.parents, visited);
                   }
               });
          }
      });
  }
}

function expandSpouses(nodeId) {
  const data = window.familyCache[nodeId];
  if(!data) return;

  lockNodeTemporarily(nodeId);

  const pos = getPosition(nodeId);
  const spouses = data.family.spouses;
  const allChildren = data.family.children;

  const animationTargets = [];
  
  let count = 0;
  spouses.forEach(spouse => {
    const dir = (count % 2 === 0) ? 1 : -1;
    const dist = (Math.floor(count / 2) + 1) * 160;
    let targetX = pos.x + (dir * dist);
    
    if (!nodes.get(spouse.id)) {
      nodes.add({
        id: spouse.id,
        label: wordwrap(spouse.label, 15),
        color: { background: getGenderColor(spouse.gender), border: '#666' },
        shape: 'box',
        font: { size: 0 }, 
        x: pos.x,         
        y: pos.y,
        lifeSpan: spouse.lifeSpan
      });
      animationTargets.push({ id: spouse.id, x: targetX, y: pos.y, fontSize: 14 });
      expandNode(spouse.id, true);
    } else {
        const spousePos = getPosition(spouse.id);
        targetX = spousePos.x;
    }

    const finalSpouseX = (nodes.get(spouse.id) ? (animationTargets.find(t=>t.id===spouse.id)?.x || getPosition(spouse.id).x) : targetX);
    const unionX = (pos.x + finalSpouseX) / 2;
    // UPDATED: Spawn offset set to 100 to appear closer
    const unionY = pos.y + 100; 

    const unionChildren = allChildren.filter(c => {
        if (!c.otherParents || c.otherParents.length === 0) return false;
        return c.otherParents.includes(spouse.id);
    });
    
    const unionId = createUnionNode(data.id, spouse.id, unionChildren.length, unionX, unionY);
    
    nodes.update({ id: unionId, x: pos.x, y: pos.y });
    animationTargets.push({ id: unionId, x: unionX, y: unionY });
    
    if(unionChildren.length > 0) {
        nodes.update({ id: unionId, childrenIds: unionChildren });
    }
    
    count++;
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

  if (window.loadingNodes) {
      window.loadingNodes.add(id);
      if (window.startSpinnerLoop) window.startSpinnerLoop();
  }

  let promise;
  if (window.familyCache[id]) promise = Promise.resolve(window.familyCache[id]);
  else {
    const node = nodes.get(id);
    if (!node) { 
        if (window.loadingNodes) window.loadingNodes.delete(id);
        stopLoading(); 
        return Promise.resolve(null); 
    }

    if (/^Q\d+$/.test(id)) {
        promise = getPageById(id, unwrap(node.label)).then(data => {
            const finalId = renameNode(id, data.redirectedTo, data.id, data.gender, data.lifeSpan);
            data.id = finalId; window.familyCache[finalId] = data; return data;
        });
    } else {
        promise = getSubPages(unwrap(node.label)).then(data => {
            const finalId = renameNode(id, data.redirectedTo, data.id, data.gender, data.lifeSpan);
            data.id = finalId; window.familyCache[finalId] = data; return data;
        });
    }
  }

  return promise.then(data => {
    if (window.loadingNodes) window.loadingNodes.delete(id);

    if (!data) return null;
    const node = nodes.get(data.id);
    if (!node) return data;

    if (data.family.spouses.length > 0) {
       const unshownSpouses = data.family.spouses.filter(s => !nodes.get(s.id)).length;
       const hideSpouseTrigger = (data.family.spouses.length === 1 && unshownSpouses === 0);
       if (!hideSpouseTrigger) {
           addTriggerNode(data.id, 'spouses', unshownSpouses);
       }
    }

    if (data.family.parents.length > 0) {
      addTriggerNode(data.id, 'parents', null);
    }

    if (data.family.siblings && data.family.siblings.length > 0) {
      const unshownSiblings = data.family.siblings.filter(s => !nodes.get(s.id)).length;
      addTriggerNode(data.id, 'siblings', unshownSiblings);
    }

    if (!isSilent) stopLoading();
    return data;
  }).catch(err => { 
      if (window.loadingNodes) window.loadingNodes.delete(id);
      console.error(err); 
      if(!isSilent) stopLoading();
      return null;
  });
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
    const triggersToRemove = [];
    ids.forEach(id => {
       triggersToRemove.push(`trigger_parents_${id}`);
       triggersToRemove.push(`trigger_spouses_${id}`);
       triggersToRemove.push(`trigger_siblings_${id}`);
    });
    nodes.remove([...ids, ...triggersToRemove]);
    triggersToRemove.forEach(t => window.activeTriggers.delete(t));
    window.siblingState[nodeId] = false;
  } else {
    const newNodes = [];
    const newEdges = [];
    const edgeUpdates = [];
    const animationTargets = [];
    const siblingsToExpand = [];

    let count = 0;
    const mainNodeParents = data.family.parents || [];
    const parentsVisible = mainNodeParents.length > 0 && mainNodeParents.every(p => nodes.get(p.id));

    siblings.forEach(sib => {
      if (sib.id === nodeId) return;
      
      const dir = (count % 2 === 0) ? 1 : -1;
      const dist = (Math.floor(count / 2) + 1) * 160;
      let targetX = pos.x + (dir * dist);
      
      if (!nodes.get(sib.id)) {
        newNodes.push({
          id: sib.id,
          label: wordwrap(sib.label, 15),
          color: { background: getGenderColor(sib.gender), border: '#666' },
          shape: 'box',
          font: { size: 0 }, 
          x: pos.x,         
          y: pos.y,
          lifeSpan: sib.lifeSpan
        });
        animationTargets.push({ id: sib.id, x: targetX, y: pos.y, fontSize: 14 });
        siblingsToExpand.push(sib.id);
      }

      const existingEdges = edges.get({
        filter: e => (e.from === nodeId && e.to === sib.id) || (e.from === sib.id && e.to === nodeId)
      });
      
      const customEdgeColor = { color: '#e0e0e0', highlight: '#c9c9c9', hover: '#c9c9c9' };

      if (existingEdges.length === 0) {
        newEdges.push({ 
            from: nodeId, 
            to: sib.id, 
            color: customEdgeColor, 
            dashes: true, 
            physics: false 
        });
      } else {
        existingEdges.forEach(e => {
            edgeUpdates.push({ 
                id: e.id, 
                color: customEdgeColor, 
                dashes: true,
                physics: false 
            });
        });
      }
      count++;
    });

    if (newNodes.length > 0) nodes.add(newNodes);
    if (newEdges.length > 0) edges.add(newEdges);
    if (edgeUpdates.length > 0) edges.update(edgeUpdates);
    
    if (animationTargets.length > 0) {
        if(window.animateNodes) window.animateNodes(animationTargets);
        setTimeout(() => { if(window.fixOverlap) window.fixOverlap(pos.y); }, 650);
    } else {
        if(window.fixOverlap) window.fixOverlap(pos.y);
    }
    
    siblingsToExpand.forEach(id => {
        expandNode(id, true).then(sibData => {
            if (parentsVisible && sibData && sibData.family && sibData.family.parents.length > 0) {
                expandParents(sibData.id, sibData.family.parents, new Set());
            }
        });
    });

    window.siblingState[nodeId] = true;
  }
};

window.handleTriggerClick = function(nodeId) {
  const node = nodes.get(nodeId);
  if (!node) return;

  if (node.isUnion) {
     const p1Id = node.spouseIds ? node.spouseIds[0] : null;
     const p2Id = node.spouseIds ? node.spouseIds[1] : null;

     const proceed = () => {
         const updatedNode = nodes.get(nodeId);
         const cIds = updatedNode.childrenIds;
         if (cIds && cIds.length > 0) {
             // UPDATED: Check if ALL children are present.
             // If the user started with one child (A) and the union now has [A, B, C],
             // logic based on just cIds[0] (A) would say "present" -> Collapse.
             // But the user wants to see B and C.
             // So if ANY child is missing, we EXPAND.
             const allPresent = cIds.every(c => nodes.get(c.id));
             
             if (allPresent) {
                 collapseChildren(nodeId, cIds);
             } else {
                 expandChildren(nodeId, cIds);
             }
         }
     };

     if (p1Id && p2Id) {
         startLoading();
         // Always ensure we have the parent's data (if cached, promise resolves instantly)
         expandNode(p1Id, true).then(data => {
             if (data) {
                 const allChildren = data.family.children;
                 const unionChildren = allChildren.filter(c => c.otherParents && c.otherParents.includes(p2Id));
                 if (unionChildren.length > 0) {
                     nodes.update({ id: nodeId, childrenIds: unionChildren });
                 }
             }
             stopLoading();
             proceed();
         });
     } else {
         proceed();
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
     let label = '✕';
     if (!isExpanded) {
        const data = window.familyCache[trigger.parentId];
        const unshown = data.family.siblings.filter(s => !nodes.get(s.id)).length;
        label = (unshown > 0 ? unshown + '\n' : '') + '⇄';
     }
     nodes.update({ id: nodeId, label: label });
  }
  else if (trigger.triggerType === 'spouses') {
      expandSpouses(trigger.parentId);
  }
};
