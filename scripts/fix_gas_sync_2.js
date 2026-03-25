const fs = require('fs');
const path = 'd:\\AI\\Antigravity\\feedback-service\\src\\app\\admin\\branches\\page.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(/fetchUrl = "http:\/\/api\.scraperapi\.com/g, 'finalUrl = "http://api.scraperapi.com');

fs.writeFileSync(path, content, 'utf8');
console.log("Fixed finalUrl variable bug.");
