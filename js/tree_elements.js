/* global nodes, edges, network, getPosition, getGenderColor */

// -- VISUAL BUILDERS --

function updateUnionState(unionId, state) {
    if (!nodes.get(unionId)) return;
    
    let label = '';
    let shape = 'dot';
    let size = 5;
    let color = window.COLORS ? window.COLORS.union : '#444';
    let fontSize = 0;

    // state can be:
    // 1. Number (count) -> Collapsed, show count.
    // 2. 'expanded'     -> Expanded, show '✕'.
    // 3. false/null     -> Empty/Hidden (dot).

    if (typeof state === 'number' && state > 0) {
        // COLLAPSED with children: Show Count
        label = state.toString();
        shape = 'circle';
        size = 15;
        color = { background: '#fff', border: '#444' };
        fontSize = 14;
    } else if (state === 'expanded') {
        // EXPANDED: Show Close Button
        label = '✕'; 
        shape = 'circle'; 
        size = 15;
        color = { background: '#fff', border: '#444' }; 
        fontSize = 14;
    } 
    // If state is 0 or false, stay as dot (connector only).

    nodes.update({
        id: unionId,
        label: label,
        shape: shape,
        size: size,
        color: color,
        font: { size: fontSize, color: '#000', face: 'arial' },
        borderWidth: 1,
        isUnion: true,
    });
}

function createUnionNode(p1Id, p2Id, childrenCount, x, y) {
  const ids = [p1Id, p2Id].sort();
  const unionId = `union_${ids[0]}_${ids[1]}`;

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
    edges.add([
      { from: p1Id, to: unionId, color: '#666', width: 1.5 },
      { from: p2Id, to: unionId, color: '#666', width: 1.5 }
    ]);
    
    // 3. Bind spouses physically (invisible edge)
    const spouseEdgeId = `spouse_bind_${ids[0]}_${ids[1]}`;
    if (!edges.get(spouseEdgeId)) {
        edges.add({
            id: spouseEdgeId,
            from: p1Id,
            to: p2Id,
            color: { opacity: 0 }, 
            physics: true,         
            length: 100,           
            width: 0,
            smooth: false,
            dashes: false,
            hidden: false          
        });
    }
  }
  
  // Show the number immediately (Collapsed State)
  updateUnionState(unionId, childrenCount);
  
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
    color = { background: 'rgba(255, 255, 255, 0.2)', border: '#ccc' };
  } else if (type === 'spouses') {
    icon = '💍'; 
    if(parentPos) { x = parentPos.x + 75; y = parentPos.y; }
    color = { background: '#fff', border: '#FFD700' }; 
  } else if (type === 'siblings') {
    icon = '⇄';
    if(parentPos) { x = parentPos.x - 75; y = parentPos.y; }
    font = { size: 12, color: '#000' };
    color = { background: '#fff', border: '#888' };
  }

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
