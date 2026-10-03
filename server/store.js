// Simple JSON-file persistence for candidates (no database needed).
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'data', 'candidates.json');

function load() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function save(candidates) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(candidates, null, 2));
}

module.exports = { load, save };
