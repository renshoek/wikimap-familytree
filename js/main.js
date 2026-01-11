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
   "Queen Victoria", "Elizabeth II", "King Charles III", "Henry VIII", "William the Conqueror",
    "George III", "Mary, Queen of Scots", "Diana, Princess of Wales", "Prince William", "Prince Harry",
    "Richard III", "Edward VII", "George V", "George VI", "Princess Victoria",
    "Edward Longshanks", "Alfred the Great", "Eleanor of Aquitaine", "Richard the Lionheart", "John, King of England",

    // European Royalty & Leaders
    "Napoleon", "Louis XIV", "Queen Marie Antoinette", "Charles the Great", "Empress Elisabeth of Austria",
    "Franz Joseph I of Austria", "Catherine the Great", "Peter the Great", "Nicholas II of Russia", "Ivan the Terrible",
    "Frederick the Great", "Maria Theresa", "Philip II of Spain", "Isabella I of Castile", "Ferdinand II of Aragon",
    "Frederik X", "Carl XVI Gustaf", "Harald V of Norway", "Willem-Alexander of the Netherlands", "Philippe of Belgium",

    // Ancient History
    "Julius Caesar", "Gaius Octavius", "Alexander the Great", "Cleopatra VII", "Nero",
    "Gaius Caesar Augustus Germanicus", "Marcus Aurelius", "Constantine the Great", "Tutankhamun", "Ramses II",
    "Akhenaten", "Hatshepsut", "Cyrus the Great", "Darius I", "Xerxes I",
    "Pericles the Younger", "Leonidas I", "Hannibal Barca", "Scipio Africanus", "Attila the Hun",

    // US Presidents & Figures
    "George Washington", "Abraham Lincoln", "Thomas Jefferson", "Theodore Roosevelt", "Franklin D. Roosevelt",
    "John F. Kennedy", "Barack Obama", "Donald Trump", "Joe Biden", "Ronald Reagan",
    "Dwight D. Eisenhower", "Harry S. Truman", "Woodrow Wilson", "Ulysses S. Grant", "Andrew Jackson",
    "Benjamin Franklin", "Alexander Hamilton", "Eleanor Roosevelt", "Jackie Kennedy", "Michelle Obama",

    // Science & Exploration
    "Albert Einstein", "Marie Curie", "Charles Darwin", "Isaac Newton", "Galileo Galilei",
    "Nikola Tesla", "Thomas Edison", "Leonardo da Vinci", "Stephen Hawking", "Ada Lovelace",
    "Alan Turing", "Rosalind Franklin", "Louis Pasteur", "Alexander Graham Bell", "Orville Wright",
    "Neil Armstrong", "Buzz Aldrin", "Yuri Gagarin", "Christopher Columbus", "Marco Polo",

    // Arts, Literature & Philosophy
    "William Shakespeare", "Charles Dickens", "Jane Austen", "Mark Twain", "Ernest Hemingway",
    "J.R.R. Tolkien", "Joanne Rowling", "Agatha Christie", "Oscar Wilde", "Victor Hugo",
    "Wolfgang Amadeus Mozart", "Ludwig van Beethoven", "Johann Sebastian Bach", "Frederic Chopin", "Elvis Presley",
    "Michael Jackson", "John Lennon", "George Harrison", "Paul McCartney", "Pablo Picasso", "Vincent van Gogh", "Salvador Dali",

    // World Leaders & Activists
    "Winston Churchill", "Margaret Thatcher", "Nelson Mandela", "Mahatma Gandhi", "Martin Luther King Jr.",
    "Malcolm X", "Dalai Lama", "Mikhail Gorbachev", "Vladimir Putin", "Angela Merkel",
    "Emmanuel Macron", "Indira Gandhi", "Benazir Bhutto", "Golda Meir", "Eva Peron",
    "Che Guevara", "Fidel Castro", "Mao Zedong", "Deng Xiaoping", "Sun Yat-sen",

    // Mythology & Religion
    "Ζεύς", "Heracles", "Wōden", "Donar", "Hveðrungr",
    "God the Father", "Mary, mother of Jesus", "King David", "King Salomon", "Moshe Rabbeinu",
    "Prophet Muhammad", "Kong Qiu", "Siddhartha Gautama", "Poseidon", "Hā́idēs",
    "Pallas Athena", "Apollōn", "Artemis Brauronia", "Acadalia",

    // Modern Business & Tech
    "Elon Musk", "Steve Jobs", "Bill Gates", "Mark Zuckerberg", "Jeff Bezos",
    "Warren Buffett", "Walt Disney", "Henry Ford", "Enzo Ferrari", "Coco Chanel",
    
    // Pop Culture & Actors
    "Marilyn Monroe", "Audrey Hepburn", "Charlie Chaplin", "Walt Disney", "Stan Lee",
    "Arnold Schwarzenegger", "Sylvester Stallone", "Tom Cruise", "Brad Pitt", "Angelina Jolie",
    "Kim Kardashian", "Kanye West", "Beyonce", "Jay-Z", "Rihanna",
    "Madonna", "David Bowie", "Freddie Mercury", "Elton John", "Oprah Winfrey",

    // Miscellaneous Historical
    "Chinggis Khan", "Kublai Khan", "Tamerlane the Great", "Suleiman the Magnificent", "Mehmed the Conqueror",
    "Salah ad-Din Yusuf ibn Ayyub", "Joan of Arc", "William Wallace", "Robert the Bruce", "Vlad the Impaler",
    "Grigori Rasputin", "Goyaałé", "Tȟatȟáŋka Íyotake", "Pocahontas", "Sacagawea",
    "Amelia Earhart", "Florence Nightingale", "Mother Teresa", "Rosa Louise McCauley Parks", "Harriet Tubman",
    "Chulalongkorn", "Bhumibol",

    // -- NEW ADDITIONS (Sports, Cinema, Music, Philosophy, History) --
    // Sports Legends
    "Muhammad Ali", "Michael Jordan", "LeBron James", "Serena Williams",
    "Pelé", "Lionel Messi", "Cristiano Ronaldo", "Roger Federer", "Tiger Woods",
    "Kobe Bryant", "Shaquille O'Neal", "Wayne Gretzky", "Tom Brady",
    "Lewis Hamilton", "Max Verstappen", "Novak Djokovic", "Rafael Nadal",
    "Simone Biles", "Michael Phelps", "Jesse Owens",

    // Cinema & Directors
    "Steven Spielberg", "Alfred Hitchcock", "Quentin Tarantino", "Martin Scorsese",
    "Meryl Streep", "Robert De Niro", "Leonardo DiCaprio",
    "Bruce Lee", "Hayao Miyazaki", "Jim Henson",

    // Music Legends
    "Bob Dylan", "Bob Marley", "Jimi Hendrix", "Kurt Cobain", "Aretha Franklin",
    "Frank Sinatra", "Louis Armstrong", "Miles Davis", "Taylor Swift", "Lady Gaga",
    "Tupac Shakur", "Whitney Houston", "Celine Dion", "Mariah Carey",

    // Philosophy & Thinkers
    "Socrates", "Plato", "Aristotélēs", "René Descartes", "Immanuel Kant",
    "Friedrich Nietzsche", "Karl Marx", "Dante Alighieri", "Ὅμηρος",

    // Science & Math (Pre-20th Century & Modern)
    "Pythagoras of Samos", "Euclid", "Archimedes of Syracuse", "Carl Sagan", "Richard Feynman",
    "Sigmund Freud", "Carl Jung", "Jane Goodall", "Tim Berners-Lee", "Grace Hopper",

    // Art & Architecture
    "Michelangelo", "Rembrandt", "Claude Monet", "Frida Kahlo", "Andy Warhol",
    "Frank Lloyd Wright", "Zaha Hadid", "Banksy", "Georgia O'Keeffe",

    "Sun Tzu", "Cicero", "Hammurabi", "Al Capone",
    "Harry Houdini", "P.T. Barnum", "Anne Frank",
    "Helen Keller", "Malala Yousafzai", "Greta Thunberg", "Edward Snowden",
   "Zoser",
    "Gaius Julius Arminius", "Ibn Sina", "Miyamoto Musashi", "Zheng He",
    "Leif Erikson", "Petrarch", "Nicolaus Copernicus", "Johannes Kepler",
    "Tycho Brahe", "Paracelsus", "Guy Fawkes", "Simón Bolívar",
    "Joseph Lister", "Ernest Shackleton",
    "Julie d'Aubigny", "Gilgamesh", "Ramesses I", "Ramesses II", "Ramesses III",
  
];

const container = document.getElementById('container');

// Detect touch device (using a different variable name than help.js to avoid conflicts)
const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0;

const options = {
  nodes: {
    shape: 'box', 
    margin: 10,
    mass: 0.5, // ADDED: Halve the weight of nodes
    font: { 
        size: 14, 
        face: 'arial',
        multi: 'md',  // UPDATED: Enable Markdown support for formatting
        ital: { color: '#777777', size: 12 } // UPDATED: Define subtle gray color for italics (used for dates)
    },
    borderWidth: 1,
    shadow: true,
    fixed: { x: false, y: false }
  },
  edges: {
    smooth: {
      type: 'cubicBezier', 
      forceDirection: 'vertical',
      roundness: 0.35 // UPDATED: Lower value makes lines less "bendy" (was 0.4)
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
      springConstant: 0.009,       
      damping: 0.25,                 
      avoidOverlap: 0.3             
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
