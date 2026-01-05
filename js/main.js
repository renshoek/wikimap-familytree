/* global vis, bindNetwork, getNormalizedId, wordwrap, getGenderColor, noInputDetected, getItems, addItem, clearItems, unlockAll, expandNode, startLoading, stopLoading */

// FIX: Use 'var' so these are globally accessible
var nodes;
var edges;
var network;

window.startpages = [];
window.initialExpanded = false; 

// -- MASTER LIST OF SUGGESTIONS --
window.SUGGESTIONS = [
    // British Monarchy & Royalty
    "Queen Victoria", "Elizabeth II", "Charles III", "Henry VIII", "William the Conqueror",
    "George III", "Mary, Queen of Scots", "Princess Diana", "Prince William", "Prince Harry",
    "Richard III", "Edward VII", "George V", "George VI", "Victoria, Princess Royal",
    "Edward Longshanks", "Alfred the Great", "Eleanor of Aquitaine", "Richard the Lionheart", "John, King of England",

    // European Royalty & Leaders
    "Napoleon", "Louis XIV", "Marie Antoinette", "Charlemagne", "Empress Elisabeth of Austria",
    "Franz Joseph I of Austria", "Catherine the Great", "Peter the Great", "Nicholas II of Russia", "Ivan the Terrible",
    "Frederick the Great", "Maria Theresa", "Philip II of Spain", "Isabella I of Castile", "Ferdinand II of Aragon",
    "Queen Margrethe II", "Carl XVI Gustaf", "Harald V of Norway", "Willem-Alexander of the Netherlands", "Philippe of Belgium",

    // Ancient History
    "Julius Caesar", "Augustus", "Alexander the Great", "Cleopatra", "Nero",
    "Caligula", "Marcus Aurelius", "Constantine the Great", "Tutankhamun", "Ramses II",
    "Nefertiti", "Hatshepsut", "Cyrus the Great", "Darius I", "Xerxes I",
    "Pericles", "Leonidas I", "Hannibal", "Scipio Africanus", "Attila the Hun",

    // US Presidents & Figures
    "George Washington", "Abraham Lincoln", "Thomas Jefferson", "Theodore Roosevelt", "Franklin D. Roosevelt",
    "John F. Kennedy", "Barack Obama", "Donald Trump", "Joe Biden", "Ronald Reagan",
    "Dwight D. Eisenhower", "Harry S. Truman", "Woodrow Wilson", "Ulysses S. Grant", "Andrew Jackson",
    "Benjamin Franklin", "Alexander Hamilton", "Eleanor Roosevelt", "Jackie Kennedy", "Michelle Obama",

    // Science & Exploration
    "Albert Einstein", "Marie Curie", "Charles Darwin", "Isaac Newton", "Galileo Galilei",
    "Nikola Tesla", "Thomas Edison", "Leonardo da Vinci", "Stephen Hawking", "Ada Lovelace",
    "Alan Turing", "Rosalind Franklin", "Louis Pasteur", "Alexander Graham Bell", "Wright Brothers",
    "Neil Armstrong", "Buzz Aldrin", "Yuri Gagarin", "Christopher Columbus", "Marco Polo",

    // Arts, Literature & Philosophy
    "William Shakespeare", "Charles Dickens", "Jane Austen", "Mark Twain", "Ernest Hemingway",
    "J.R.R. Tolkien", "J.K. Rowling", "Agatha Christie", "Oscar Wilde", "Victor Hugo",
    "Wolfgang Amadeus Mozart", "Ludwig van Beethoven", "Johann Sebastian Bach", "Frederic Chopin", "Elvis Presley",
    "Michael Jackson", "The Beatles", "Pablo Picasso", "Vincent van Gogh", "Salvador Dali",

    // World Leaders & Activists
    "Winston Churchill", "Margaret Thatcher", "Nelson Mandela", "Mahatma Gandhi", "Martin Luther King Jr.",
    "Malcolm X", "Dalai Lama", "Mikhail Gorbachev", "Vladimir Putin", "Angela Merkel",
    "Emmanuel Macron", "Indira Gandhi", "Benazir Bhutto", "Golda Meir", "Eva Peron",
    "Che Guevara", "Fidel Castro", "Mao Zedong", "Deng Xiaoping", "Sun Yat-sen",

    // Mythology & Religion
    "Zeus", "Hercules", "Odin", "Thor", "Loki",
    "Jesus", "Mary (mother of Jesus)", "King David", "King Solomon", "Moses",
    "Prophet Muhammad", "Confucius", "Buddha", "Poseidon", "Hades",
    "Athena", "Apollo", "Artemis", "Ares", "Aphrodite",

    // Modern Business & Tech
    "Elon Musk", "Steve Jobs", "Bill Gates", "Mark Zuckerberg", "Jeff Bezos",
    "Warren Buffett", "Walt Disney", "Henry Ford", "Enzo Ferrari", "Coco Chanel",
    
    // Pop Culture & Actors
    "Marilyn Monroe", "Audrey Hepburn", "Charlie Chaplin", "Walt Disney", "Stan Lee",
    "Arnold Schwarzenegger", "Sylvester Stallone", "Tom Cruise", "Brad Pitt", "Angelina Jolie",
    "Kim Kardashian", "Kanye West", "Beyonce", "Jay-Z", "Rihanna",
    "Madonna", "David Bowie", "Freddie Mercury", "Elton John", "Oprah Winfrey",

    // Miscellaneous Historical
    "Genghis Khan", "Kublai Khan", "Tamerlane", "Suleiman the Magnificent", "Mehmed the Conqueror",
    "Saladin", "Joan of Arc", "William Wallace", "Robert the Bruce", "Vlad the Impaler",
    "Rasputin", "Geronimo", "Sitting Bull", "Pocahontas", "Sacagawea",
    "Amelia Earhart", "Florence Nightingale", "Mother Teresa", "Rosa Parks", "Harriet Tubman"
];

const container = document.getElementById('container');

// Detect touch device (using a different variable name than help.js to avoid conflicts)
const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0;

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
      roundness: 0.4 
    },
    color: { color: '#666666', highlight: '#000000' }
  },
  interaction: {
    hover: !isTouch, 
    dragNodes: true, 
    zoomView: true,
    dragView: true
  },
  physics: {
    enabled: true,
    solver: 'barnesHut',
    barnesHut: {
      gravitationalConstant: -7000, 
      centralGravity: 0.02,         
      springLength: 120,            
      springConstant: 0.005,        
      damping: 0.9,                 
      avoidOverlap: 0.5             
    },
    minVelocity: 0.1, 
    stabilization: {
      enabled: false, 
      iterations: 1000,
      updateInterval: 50
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
  // UPDATED: Preserve Physics values from the ACTIVE NETWORK if possible
  // This ensures we keep user's debug settings rather than resetting to defaults or reading stale DOM values.
  if (network && network.physics && network.physics.options && network.physics.options.barnesHut) {
      options.physics.barnesHut = { ...network.physics.options.barnesHut };
  }

  if (initialized && network) {
    network.destroy();
    network = null;
  }
  initialized = false;
  makeNetwork();

  const cf = document.getElementById('input');
  unlockAll(cf);
  // clearItems(cf); // Keep names in input bar
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
  const ra = window.SUGGESTIONS[Math.floor(Math.random() * window.SUGGESTIONS.length)];
  addItem(cf, ra);
  go(); 
}
