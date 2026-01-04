/* global nodes, edges, network, getPosition, getGenderColor */

// -- VISUAL BUILDERS --

function updateUnionState(unionId, hasChildren) {
    if (!nodes.get(unionId)) return;
    
    if (hasChildren) {
        // Show as a button (▼) if it has children to expand
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
        // Show as a simple dot if just a connector
        nodes.update({
            id: unionId,
            label: '',
            shape: 'dot',
            size: 5,
            color: window.COLORS.union,
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

    // 2. Connect Partners to the Union
    // REMOVED hardcoded length: 180
    edges.add([
      { from: p1Id, to: unionId, color: '#666', width: 1.5 },
      { from: p2Id, to: unionId, color: '#666', width: 1.5 }
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
    return; // Children triggers are handled by Union nodes usually
  } else if (type === 'parents') {
    icon = '▲'; 
    if(parentPos) { x = parentPos.x; y = parentPos.y - 35; }
  } else if (type === 'spouses') {
    icon = '💍'; 
    // Side: Right
    if(parentPos) { x = parentPos.x + 75; y = parentPos.y; }
    color = { background: '#fff', border: '#FFD700' }; 
  } else if (type === 'siblings') {
    icon = '⇄';
    // Side: Left
    if(parentPos) { x = parentPos.x - 75; y = parentPos.y; }
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