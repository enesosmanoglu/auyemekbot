const fs = require('fs');
const http = require('http');

http.createServer(function (req, res) {
    res.write('Bot is Active!');
    res.end();
}).listen(80);

try {
    try { require('dotenv').config(); } catch (error) { }
    if (process.env.code)
        eval(process.env.code);
    else if (fs.existsSync("code.js"))
        eval(fs.readFileSync("code.js", "utf8"));
    else
        console.log("Please import a code to run!")
} catch (error) {
    console.error(require('util').inspect(error));
}
