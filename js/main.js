/* global vis, bindNetwork, getNormalizedId, wordwrap, getGenderColor, noInputDetected, getItems, addItem, clearItems, unlockAll, expandNode, startLoading, stopLoading */

// FIX: Use 'var' so these are globally accessible
var nodes;
var edges;
var network;

window.startpages = [];
window.initialExpanded = false; 

const container = document.getElementById('container');

const options = {
  nodes: {
    shape: 'box', 
    margin: 10,
    font: { size: 14, face: 'arial' },
    borderWidth: 1,
    shadow: true,
    fixed: { x: false, y: false }
  },
  edges: {
    smooth: {
      type: 'cubicBezier', 
      forceDirection: 'vertical',
      roundness: 0.5 // Increased roundness for "looser" look
    },
    color: { color: '#666666', highlight: '#000000' }
  },
  interaction: {
    hover: true,
    dragNodes: true, 
    zoomView: true,
    dragView: true
  },
  physics: {
    enabled: true,
    barnesHut: {
      // LOOSE & RELAXED SETTINGS
      gravitationalConstant: -350,  
      centralGravity: 0.1,
      springLength: 120,            // Longer resting length
      springConstant: 0.01,         // Very Soft springs (Loose)
      damping: 0.9,                 // Less friction (allows gentle sway)
      avoidOverlap: 1
    },
    stabilization: {
      enabled: true,
      iterations: 1000
    }
  },
  layout: {
    hierarchical: false 
  }
};

nodes = new vis.DataSet();
edges = new vis.DataSet();
// Use 'var' for data as well to avoid block-scope issues
var data = { nodes, edges };
var initialized = false;

function makeNetwork() {
  if (initialized) throw new Error('Network is already initialized');
  network = new vis.Network(container, data, options);
  bindNetwork();

  window.startpages = [];
  window.familyCache = {};
  window.initialExpanded = false;
  window.siblingState = {};
  if (window.activeTriggers) window.activeTriggers.clear();

  nodes = new vis.DataSet();
  edges = new vis.DataSet();
  data = { nodes, edges };
  network.setData(data);

  initialized = true;
}

const getStartNode = pageName => ({
  id: getNormalizedId(pageName),
  label: wordwrap(decodeURIComponent(pageName), 20),
  color: { background: '#E0E0E0', border: '#666' }, 
  x: 0,
  y: 0
});

function clearNetwork() {
  if (initialized && network) {
    network.destroy();
    network = null;
  }
  initialized = false;
  makeNetwork();

  const cf = document.getElementById('input');
  unlockAll(cf);
  clearItems(cf);
}

function setStartPages(starts) {
  const newStartPages = starts.map(getNormalizedId);
  if (!initialized) makeNetwork();
  
  nodes.clear(); 
  edges.clear();
  
  nodes.add(starts.map(getStartNode));
  window.startpages = newStartPages;
}

function go() {
  const cf = document.getElementById('input');
  const inputs = getItems(cf);
  if (!inputs[0]) {
    noInputDetected();
    return;
  }

  startLoading();
  
  Promise.resolve(inputs).then((pageTitles) => {
    setStartPages(pageTitles);
    if (pageTitles.length > 0) {
      setTimeout(() => {
         const id = getNormalizedId(pageTitles[0]);
         expandNode(id, false); 
      }, 100);
    }
    stopLoading();
  });

  document.getElementById('clear').style.display = '';
}

function goRandom() {
  const cf = document.getElementsByClassName('commafield')[0];
  const randomPeople = [
    "Queen Victoria", "Barack Obama", "Donald Trump", "Elizabeth II", 
    "Charles III", "Napoleon", "Genghis Khan", "Julius Caesar"
  ];
  const ra = randomPeople[Math.floor(Math.random() * randomPeople.length)];
  addItem(cf, ra);
  go(); 
}
