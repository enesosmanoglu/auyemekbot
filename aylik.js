const fs = require('fs');


module.exports = function getAylikMenu() {
    let data = fs.readFileSync('aylik_menu', 'utf-8').replace(/\r/g, '').split('\n').filter(a => a.split('\t').every(a => a));
    let result = {}
    data.map(l => l.split('\t').slice(0, -1)).forEach(a => {
        result[a.shift()] = [...a];
    })
    return result;
}