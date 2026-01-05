/* global getNormalizedId */
// Service to interact with Wikidata via SPARQL and API

const WD_API = 'https://www.wikidata.org/w/api.php';
const WD_SPARQL = 'https://query.wikidata.org/sparql';

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Fetch error: ${response.statusText}`);
  return response.json();
}

async function searchEntity(term) {
  const url = `${WD_API}?action=wbsearchentities&search=${encodeURIComponent(term)}&language=en&format=json&origin=*`;
  const data = await fetchJson(url);
  if (data.search && data.search.length > 0) {
    return { id: data.search[0].id, label: data.search[0].label };
  }
  throw new Error('Entity not found');
}

/**
 * Get family members, gender, AND parentage info for children.
 * Uses COALESCE to robustly find the co-parent.
 */
async function getFamilyData(qid) {
  const query = `
    SELECT ?relative ?relativeLabel ?type ?genderLabel ?otherParent WHERE {
      VALUES ?subject { wd:${qid} }
      
      {
        # 1. CHILDREN & Their Other Parent
        ?subject wdt:P40 ?relative .
        BIND("child" AS ?type)
        
        # Robustly try to find the other parent (P22=Father, P25=Mother)
        OPTIONAL { ?relative wdt:P22 ?p22 . FILTER(?p22 != ?subject) }
        OPTIONAL { ?relative wdt:P25 ?p25 . FILTER(?p25 != ?subject) }
        BIND(COALESCE(?p22, ?p25) AS ?otherParent)
      } 
      UNION {
        # 2. PARENTS
        { ?subject wdt:P22 ?relative } UNION { ?subject wdt:P25 ?relative }
        BIND("parent" AS ?type)
      } 
      UNION {
        # 3. SIBLINGS
        ?subject wdt:P3373 ?relative .
        BIND("sibling" AS ?type)
      } 
      UNION {
        # 4. SPOUSES (Explicit)
        ?subject wdt:P26 ?relative .
        BIND("spouse" AS ?type)
      } 
      UNION {
        # 5. IMPLIED PARTNERS (Co-parents)
        # Find children, then find their other parent.
        ?subject wdt:P40 ?child .
        { ?child wdt:P22 ?relative } UNION { ?child wdt:P25 ?relative }
        FILTER(?relative != ?subject)
        BIND("spouse" AS ?type)
      }
      
      OPTIONAL { ?relative wdt:P21 ?gender . }
      
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    }
  `;

  const url = `${WD_SPARQL}?query=${encodeURIComponent(query)}&format=json`;
  const data = await fetchJson(url);

  const getGender = (label) => {
    if (!label) return 'unknown';
    const l = label.toLowerCase();
    if (l.includes('female') || l.includes('woman')) return 'female';
    if (l.includes('male') || l.includes('man')) return 'male';
    return 'unknown';
  };

  const family = {
    parents: [],
    children: [], // Stores { id, label, gender, otherParents: [] }
    siblings: [],
    spouses: []
  };

  const seenChildren = {}; 
  const seenOthers = new Set();

  if (data.results && data.results.bindings) {
    data.results.bindings.forEach(row => {
      const id = row.relative.value.split('/').pop();
      const name = row.relativeLabel.value;
      const type = row.type.value;
      const gender = getGender(row.genderLabel ? row.genderLabel.value : '');
      
      if (name.match(/^Q\d+$/)) return; 

      const person = { id, label: name, gender };

      if (type === 'child') {
        if (!seenChildren[id]) {
          seenChildren[id] = { ...person, otherParents: [] };
          family.children.push(seenChildren[id]);
        }
        if (row.otherParent) {
          const pid = row.otherParent.value.split('/').pop();
          if (!seenChildren[id].otherParents.includes(pid)) {
             seenChildren[id].otherParents.push(pid);
          }
        }
      } else {
        if (seenOthers.has(id)) return;
        seenOthers.add(id);
        if (type === 'parent') family.parents.push(person);
        if (type === 'sibling') family.siblings.push(person);
        if (type === 'spouse') family.spouses.push(person);
      }
    });
  }

  return family;
}

async function getEntityGender(qid) {
  const query = `SELECT ?genderLabel WHERE { wd:${qid} wdt:P21 ?gender . SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } LIMIT 1`;
  const url = `${WD_SPARQL}?query=${encodeURIComponent(query)}&format=json`;
  const data = await fetchJson(url);
  if (data.results && data.results.bindings.length > 0) {
    const label = data.results.bindings[0].genderLabel.value.toLowerCase();
    if (label.includes('female')) return 'female';
    if (label.includes('male')) return 'male';
  }
  return 'unknown';
}

// NEW: Fetch detailed biographical info for the Modal
async function getPersonDetails(qid) {
  // UPDATED QUERY: Now fetches Country (P17) for Birth/Death places
  const query = `
    SELECT ?desc ?dob ?dod ?pobLabel ?podLabel ?pobCountryLabel ?podCountryLabel ?img ?article ?entityLabel ?entityDescription WHERE {
      BIND(wd:${qid} AS ?entity)
      
      OPTIONAL { ?entity wdt:P569 ?dob . }
      OPTIONAL { ?entity wdt:P570 ?dod . }
      
      OPTIONAL { 
        ?entity wdt:P19 ?pob . 
        OPTIONAL { ?pob wdt:P17 ?pobCountry . }
      }
      
      OPTIONAL { 
        ?entity wdt:P20 ?pod . 
        OPTIONAL { ?pod wdt:P17 ?podCountry . }
      }
      
      OPTIONAL { ?entity wdt:P18 ?img . }
      
      OPTIONAL {
        ?article schema:about ?entity ;
                 schema:isPartOf <https://en.wikipedia.org/> .
      }
      
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    } LIMIT 1
  `;

  const url = `${WD_SPARQL}?query=${encodeURIComponent(query)}&format=json`;
  const data = await fetchJson(url);
  
  if (data.results && data.results.bindings.length > 0) {
      const row = data.results.bindings[0];
      return {
          id: qid,
          label: row.entityLabel ? row.entityLabel.value : qid,
          description: row.entityDescription ? row.entityDescription.value : '',
          birthDate: row.dob ? new Date(row.dob.value).toLocaleDateString() : null,
          deathDate: row.dod ? new Date(row.dod.value).toLocaleDateString() : null,
          birthPlace: row.pobLabel ? row.pobLabel.value : null,
          birthCountry: row.pobCountryLabel ? row.pobCountryLabel.value : null, // Added
          deathPlace: row.podLabel ? row.podLabel.value : null,
          deathCountry: row.podCountryLabel ? row.podCountryLabel.value : null, // Added
          image: row.img ? row.img.value : null,
          wikipedia: row.article ? row.article.value : null
      };
  }
  return null;
}

async function getSubPages(pageName) {
  try {
    const entity = await searchEntity(pageName);
    const family = await getFamilyData(entity.id);
    const gender = await getEntityGender(entity.id);

    return {
      redirectedTo: entity.label, 
      id: entity.id,
      gender: gender,
      family: family,             
      links: [] 
    };
  } catch (err) {
    console.error(err);
    return {
      redirectedTo: pageName,
      family: { parents: [], children: [], siblings: [], spouses: [] },
      links: []
    };
  }
}

async function getPageById(id, label) {
  try {
    const family = await getFamilyData(id);
    const gender = await getEntityGender(id);

    return {
      redirectedTo: label, 
      id: id,
      gender: gender,
      family: family,             
      links: [] 
    };
  } catch (err) {
    console.error(err);
    return {
      redirectedTo: label,
      family: { parents: [], children: [], siblings: [], spouses: [] },
      links: []
    };
  }
}

window.getSubPages = getSubPages;
window.getPageById = getPageById;
window.getPersonDetails = getPersonDetails; // Export
