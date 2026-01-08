/* global getNormalizedId */
// Service to interact with Wikidata via SPARQL and API

const WD_API = 'https://www.wikidata.org/w/api.php';
const WD_SPARQL = 'https://query.wikidata.org/sparql';

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

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

// -- DATE HELPERS --

function formatYearStr(year) {
    if (year === null || year === undefined) return 'unknown';
    if (year < 0) return `${Math.abs(year)} BC`;
    return `${year}`;
}

function getOrdinal(n) {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// Main formatting function based on precision
// Precision: 11=Day, 10=Month, 9=Year, 8=Decade, 7=Century, 6=Millennium
// Added 'showMonthsDays' param (defaults to true) to control detailed output
function formatDateByPrecision(isoStr, precision, showMonthsDays = true) {
    if (!isoStr) return null;
    const prec = parseInt(precision, 10);
    
    try {
        const isBC = isoStr.startsWith('-');
        const cleanStr = isoStr.replace(/^[+-]/, '');
        const parts = cleanStr.split('T')[0].split('-');
        
        let year = parseInt(parts[0], 10);
        let month = parts[1] ? parseInt(parts[1], 10) : null;
        let day = parts[2] ? parseInt(parts[2], 10) : null;

        if (isNaN(year)) return null;
        const absYear = year;
        if (isBC) year = -year;

        // 1. Century (7)
        if (prec === 7) {
            const century = Math.ceil(absYear / 100);
            return `${getOrdinal(century)} century${isBC ? ' BCE' : ''}`;
        }

        // 2. Millennium (6)
        if (prec === 6) {
             const mill = Math.ceil(absYear / 1000);
             return `${getOrdinal(mill)} millennium${isBC ? ' BCE' : ''}`;
        }

        // 3. Decade (8)
        if (prec === 8) {
            return `${year}s`;
        }

        // 4. Specific Date (9, 10, 11)
        let result = "";
        
        // Only show Day/Month if precision allows AND requested
        if (showMonthsDays) {
            if (prec >= 11 && day && month) {
                result += `${day} ${MONTH_NAMES[month - 1]} `;
            } else if (prec >= 10 && month) {
                result += `${MONTH_NAMES[month - 1]} `;
            }
        }
        
        result += formatYearStr(year);
        return result;

    } catch (e) {
        return null;
    }
}

function formatLifeSpan(dobStr, dobPrec, dodStr, dodPrec) {
    let birthText = null;
    let deathText = null;
    let birthYear = null;
    let deathYear = null;

    // Parse Birth - Pass FALSE to suppress day/month for canvas nodes
    if (dobStr) {
        birthText = formatDateByPrecision(dobStr, dobPrec || 9, false);
        try {
            const d = new Date(dobStr);
            if (!isNaN(d.getFullYear())) {
                birthYear = d.getFullYear();
                if (dobStr.startsWith('-')) birthYear = -Math.abs(birthYear);
            }
        } catch(e){}
    }

    // Parse Death - Pass FALSE to suppress day/month for canvas nodes
    if (dodStr) {
        deathText = formatDateByPrecision(dodStr, dodPrec || 9, false);
        try {
            const d = new Date(dodStr);
            if (!isNaN(d.getFullYear())) {
                deathYear = d.getFullYear();
                if (dodStr.startsWith('-')) deathYear = -Math.abs(deathYear);
            }
        } catch(e){}
    }

    // Logic
    if (birthText && deathText) {
        let ageStr = "";
        if (birthYear !== null && deathYear !== null && (!dobPrec || dobPrec >= 9) && (!dodPrec || dodPrec >= 9)) {
            const age = deathYear - birthYear;
            ageStr = ` (${age})`;
        }
        return `${birthText} - ${deathText}${ageStr}`;
    } 
    else if (birthText && !deathText) {
        // Assume dead logic
        let isAssumedDead = false;
        if (birthYear !== null) {
            const currentYear = new Date().getFullYear();
            if (currentYear - birthYear > 115) isAssumedDead = true;
        }

        if (isAssumedDead) {
            return `${birthText} - unknown`;
        } else {
            // Living
            let ageStr = "";
            if (birthYear !== null && (!dobPrec || dobPrec >= 9)) {
                const currentYear = new Date().getFullYear();
                ageStr = ` (${currentYear - birthYear})`;
            }
            return `${birthText}${ageStr}`;
        }
    } 
    else if (!birthText && deathText) {
        return `unknown - ${deathText}`;
    }
    
    return null;
}

/**
 * Get family members...
 */
async function getFamilyData(qid) {
  const query = `
    SELECT ?relative ?relativeLabel ?type ?genderLabel ?otherParent ?dob ?dobPrec ?dod ?dodPrec WHERE {
      VALUES ?subject { wd:${qid} }
      
      {
        ?subject wdt:P40 ?relative .
        BIND("child" AS ?type)
        OPTIONAL { ?relative wdt:P22 ?p22 . FILTER(?p22 != ?subject) }
        OPTIONAL { ?relative wdt:P25 ?p25 . FILTER(?p25 != ?subject) }
        BIND(COALESCE(?p22, ?p25) AS ?otherParent)
      } 
      UNION {
        { ?subject wdt:P22 ?relative } UNION { ?subject wdt:P25 ?relative }
        BIND("parent" AS ?type)
      } 
      UNION {
        ?subject wdt:P3373 ?relative .
        BIND("sibling" AS ?type)
      } 
      UNION {
        ?subject wdt:P26 ?relative .
        BIND("spouse" AS ?type)
      } 
      UNION {
        ?subject wdt:P40 ?child .
        { ?child wdt:P22 ?relative } UNION { ?child wdt:P25 ?relative }
        FILTER(?relative != ?subject)
        BIND("spouse" AS ?type)
      }
      
      OPTIONAL { ?relative wdt:P21 ?gender . }
      
      OPTIONAL { 
        ?relative p:P569/psv:P569 ?dobNode .
        ?dobNode wikibase:timeValue ?dob ; wikibase:timePrecision ?dobPrec .
      }
      
      OPTIONAL { 
        ?relative p:P570/psv:P570 ?dodNode .
        ?dodNode wikibase:timeValue ?dod ; wikibase:timePrecision ?dodPrec .
      }
      
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
    children: [], 
    siblings: [],
    spouses: []
  };

  const seenChildren = {}; 
  const seenOthers = new Set();

  if (data.results && data.results.bindings) {
    data.results.bindings.forEach(row => {
      const id = row.relative.value.split('/').pop();
      if (!/^Q\d+$/.test(id)) return; 

      const name = row.relativeLabel.value;
      const type = row.type.value;
      const gender = getGender(row.genderLabel ? row.genderLabel.value : '');
      
      const dob = row.dob ? row.dob.value : null;
      const dobPrec = row.dobPrec ? row.dobPrec.value : null;
      const dod = row.dod ? row.dod.value : null;
      const dodPrec = row.dodPrec ? row.dodPrec.value : null;

      const lifeSpan = formatLifeSpan(dob, dobPrec, dod, dodPrec);
      
      if (name.match(/^Q\d+$/)) return; 

      const person = { id, label: name, gender, lifeSpan };

      if (type === 'child') {
        if (!seenChildren[id]) {
          seenChildren[id] = { ...person, otherParents: [] };
          family.children.push(seenChildren[id]);
        }
        if (row.otherParent) {
          const pid = row.otherParent.value.split('/').pop();
          if (/^Q\d+$/.test(pid)) {
             if (!seenChildren[id].otherParents.includes(pid)) {
                seenChildren[id].otherParents.push(pid);
             }
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

// Fetches Gender AND Dates for the specific entity (used for the center node)
async function getEntityBasicInfo(qid) {
  const query = `
    SELECT ?genderLabel ?dob ?dobPrec ?dod ?dodPrec WHERE { 
      wd:${qid} wdt:P21 ?gender . 
      
      OPTIONAL { 
        wd:${qid} p:P569/psv:P569 ?dobNode .
        ?dobNode wikibase:timeValue ?dob ; wikibase:timePrecision ?dobPrec .
      }
      OPTIONAL { 
        wd:${qid} p:P570/psv:P570 ?dodNode .
        ?dodNode wikibase:timeValue ?dod ; wikibase:timePrecision ?dodPrec .
      }
      
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } 
    } LIMIT 1`;
    
  const url = `${WD_SPARQL}?query=${encodeURIComponent(query)}&format=json`;
  const data = await fetchJson(url);
  
  const result = { gender: 'unknown', lifeSpan: null };
  
  if (data.results && data.results.bindings.length > 0) {
    const row = data.results.bindings[0];
    const label = row.genderLabel ? row.genderLabel.value.toLowerCase() : '';
    if (label.includes('female')) result.gender = 'female';
    else if (label.includes('male')) result.gender = 'male';
    
    const dob = row.dob ? row.dob.value : null;
    const dobPrec = row.dobPrec ? row.dobPrec.value : null;
    const dod = row.dod ? row.dod.value : null;
    const dodPrec = row.dodPrec ? row.dodPrec.value : null;
    
    result.lifeSpan = formatLifeSpan(dob, dobPrec, dod, dodPrec);
  }
  return result;
}

function sanitizeLocation(labelObj) {
    if (!labelObj) return null;
    const val = labelObj.value;
    if (val.startsWith('http')) return null; 
    return val;
}

async function getPersonDetails(qid) {
  const query = `
    SELECT ?desc ?dob ?dobPrec ?dod ?dodPrec ?pobLabel ?podLabel ?pobCountryLabel ?podCountryLabel ?img ?article ?entityLabel ?entityDescription WHERE {
      BIND(wd:${qid} AS ?entity)
      
      OPTIONAL { 
        ?entity p:P569/psv:P569 ?dobNode .
        ?dobNode wikibase:timeValue ?dob ; wikibase:timePrecision ?dobPrec .
      }
      OPTIONAL { 
        ?entity p:P570/psv:P570 ?dodNode .
        ?dodNode wikibase:timeValue ?dod ; wikibase:timePrecision ?dodPrec .
      }
      
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
      
      let isAssumedDead = false;
      let birthYear = null;
      if (row.dob) {
           const d = new Date(row.dob.value);
           if (!isNaN(d.getFullYear())) {
               birthYear = d.getFullYear();
               if (row.dob.value.startsWith('-')) birthYear = -Math.abs(birthYear);
               if (!row.dod && (new Date().getFullYear() - birthYear > 115)) {
                   isAssumedDead = true;
               }
           }
      }

      // Keep default (true) for Modal to show day/month
      let birthDateStr = row.dob ? formatDateByPrecision(row.dob.value, row.dobPrec ? row.dobPrec.value : 9) : null;
      let deathDateStr = row.dod ? formatDateByPrecision(row.dod.value, row.dodPrec ? row.dodPrec.value : 9) : null;

      if (!birthDateStr) {
          if (row.dod || isAssumedDead) birthDateStr = "unknown";
      }
      
      if (!deathDateStr) {
          if (isAssumedDead) deathDateStr = "unknown";
      }

      return {
          id: qid,
          label: row.entityLabel ? row.entityLabel.value : qid,
          description: row.entityDescription ? row.entityDescription.value : '',
          
          birthDate: birthDateStr,
          deathDate: deathDateStr,
          
          birthPlace: sanitizeLocation(row.pobLabel),
          birthCountry: sanitizeLocation(row.pobCountryLabel),
          deathPlace: sanitizeLocation(row.podLabel),
          deathCountry: sanitizeLocation(row.podCountryLabel),
          
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
    const info = await getEntityBasicInfo(entity.id);

    return {
      redirectedTo: entity.label, 
      id: entity.id,
      gender: info.gender,
      lifeSpan: info.lifeSpan, 
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
    const info = await getEntityBasicInfo(id);

    return {
      redirectedTo: label, 
      id: id,
      gender: info.gender,
      lifeSpan: info.lifeSpan, 
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
window.getPersonDetails = getPersonDetails;
