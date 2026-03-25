const fs = require('fs');
const path = 'd:\\\\AI\\\\Antigravity\\\\feedback-service\\\\src\\\\app\\\\admin\\\\branches\\\\page.tsx';
let content = fs.readFileSync(path, 'utf8');

// Replace the literal 'отзыв' on line 255 with unicode escapes
content = content.replace(/\\s\*отзыв/g, '\\\\s*\\\\\\\\u043e\\\\\\\\u0442\\\\\\\\u0437\\\\\\\\u044b\\\\\\\\u0432');
fs.writeFileSync(path, content, 'utf8');
console.log("Fixed the remaining cyrillic string.");
