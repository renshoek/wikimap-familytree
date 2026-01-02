# WikiMap Family Tree Visualizer

An interactive, web-based tool for visualizing family trees and connections between historical figures, celebrities, and entities using live data from Wikidata.

🔗 **Live Demo:** [https://renshoek.github.io/wikimap-familytree/](https://renshoek.github.io/wikimap-familytree/)

## 📖 Overview

This project utilizes the `vis.js` network library and the Wikidata SPARQL API to generate dynamic family trees. Instead of loading a pre-built static tree, the application builds the graph node-by-node based on user interaction. Users can start with any famous person (e.g., "Queen Victoria") and expand the tree outwards to discover parents, children, spouses, and siblings.

## ✨ Features

* **Live Data Integration:** Queries Wikidata in real-time to fetch relationships.
* **Interactive Expansion:**
    * **Ancestors (▲):** Click above a node to reveal parents.
    * **Descendants (▼):** Click the "Union" node (small circle/dot between partners) to reveal children.
    * **Spouses (💍):** Click the ring icon to reveal partners.
    * **Siblings (⇄):** Toggle sibling nodes to see brothers and sisters.
* **Smart Layouts:** Custom physics and layout algorithms ensure generations are visually separated, with unions centered between partners and children placed below them.
* **Gender coloring:** Nodes are color-coded (Light Blue for Male, Pink for Female) based on Wikidata properties.
* **Multi-Search:** Compare multiple family trees simultaneously by entering multiple names.

## 🛠️ Tech Stack

* **Frontend:** HTML5, CSS3, Vanilla JavaScript (ES6+).
* **Visualization:** [vis.js](https://visjs.org/) (Network module) for rendering the graph.
* **Data Source:** [Wikidata SPARQL API](https://query.wikidata.org/).
* **Tutorial:** [Shepherd.js](https://shepherdjs.dev/) for the "How to use" tour.
* **Icons:** Ionicons.

## 🚀 How to Run Locally

Since this is a client-side static application, you do not need a backend server or a build step.

1.  **Clone the repository:**
    ```bash
    git clone [https://github.com/renshoek/wikimap-familytree.git](https://github.com/renshoek/wikimap-familytree.git)
    ```

2.  **Open the application:**
    Simply open the `index.html` file in your preferred web browser. 
    
    *Note: Due to CORS policies on some browsers regarding local files, it is recommended to run a simple local HTTP server.*
    
    ```bash
    # Python 3 example
    cd wikimap-familytree
    python -m http.server
    ```
    Then visit `http://localhost:8000`.

## 🎮 Usage Controls

* **Search:** Type a name in the top bar (e.g., "Charles III") and press Enter or click "Go".
* **Expand Parents:** Click the **▲** icon above a person's node.
* **Expand Spouses:** Click the **💍** (Ring) icon to the right of a person.
* **Expand Children:** Relationships are represented by a small **Union Node** (dot) between two people. Click this dot to reveal their children.
* **Show/Hide Siblings:** Hover over a person and click the **⇄** icon.

## 🤝 Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

## 📄 License

[MIT](LICENSE)
