const URL = "http://sks.ankara.edu.tr/yemek-hizmetleri-2/";

const fetch = require('node-fetch');
const { parse } = require('node-html-parser');

async function getData() {
    try {
        let html = await fetch(URL, { method: "GET" }).then(r => r.text());
        return htmlToData(html);
    } catch (error) {
        return { error };
    }
}
module.exports = { getData };

function htmlToData(html) {
    try {
        const document = parse(html);

        const imgUrl = document.querySelector("img.img-responsive")?.getAttribute('src');
        const header = document.querySelector("div.content-container")?.parentNode?.querySelector("h2")?.innerText?.trim();
        const date = header?.split?.(' ')?.[0];
        const isToday = date == new Date().toLocaleDateString("tr");

        const textLines = Array.from(document.querySelector("div.content-container")?.parentNode?.querySelectorAll("p") ?? []).map(d => d.innerText.trim());
        const rawText = textLines.join('\n') || "Yemek bilgisi bulunamadı";
        const text = '```\n' + rawText + '```';

        let result = {
            imgUrl,
            header,
            date,
            isToday,
            rawText,
            text,
            textLines,
            document,
        };

        console.log("Yemek bilgisi çekildi.", result.date);

        return result;
    } catch (error) {
        console.error(error);
        return { error };
    }
}