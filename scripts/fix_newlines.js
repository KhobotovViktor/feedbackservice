const fs = require('fs');
const path = 'd:\\\\AI\\\\Antigravity\\\\feedback-service\\\\src\\\\app\\\\admin\\\\branches\\\\page.tsx';
let content = fs.readFileSync(path, 'utf8');

// The file is currently one single line with literal '\n' characters.
// This means the file contains exactly "\" followed by "n".
// But wait, what if Next.js error just renders newlines as '\n' for display?
// Let's verify if the file has actual '\n' strings or if they are literal backslash-n.
if (content.includes('\\n') && !content.includes('\r\n') && content.split('\n').length === 1) {
    console.log("Found literal \\n. Fixing...");
    content = content.split('\\n').join('\n');
    fs.writeFileSync(path, content, 'utf8');
    console.log("Fixed newlines!");
} else {
    console.log("File does not seem to have literal \\n characters on a single line. Number of actual lines: " + content.split('\n').length);
}
