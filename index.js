const { Telegraf } = require('telegraf');
const fs = require('fs');
const { getData } = require('./sks.js');
const moment = require('moment-timezone'); // require
moment.locale("tr");
moment.tz.setDefault("Europe/Istanbul");
const getAylikMenu = require('./aylik.js');
const aylikMenu = getAylikMenu();
// node -e "const moment = require('moment-timezone'); moment.locale('tr'); moment.tz.setDefault('Europe/Istanbul'); let day = moment(moment().format('DD.MM.YYYY') + ' 09:00','DD.MM.YYYY HH:mm'); console.log(moment(),day,day.diff(moment()))"
require('dotenv').config();

const { BOT_TOKEN, CHANNEL_ID, ADMIN_DM_ID, DB_CHANNEL_ID } = process.env;

const bot = new Telegraf(BOT_TOKEN);

/** @type {import('typegram').ChatFromGetChat} */
let channel;
async function updateChannel() {
    channel = await bot.telegram.getChat(CHANNEL_ID);
}

/** @type {import('typegram').ChatFromGetChat} */
let dbChannel;
/** @type {import('typegram').Message.PhotoMessage} */
let lastMessage;

~async function () {
    dbChannel = await bot.telegram.getChat(DB_CHANNEL_ID);
    await updateChannel();
    console.log(channel.title, "-> Bot başlatıldı.");
    try {
        if (dbChannel.pinned_message) {
            lastMessage = JSON.parse(dbChannel.pinned_message.text);
            console.log("[DB] Son mesaj bulundu. ID:", lastMessage.message_id, '~ Tarih:', moment(lastMessage.date ? lastMessage.date * 1000 : undefined).format());
        } else if (channel.pinned_message) {
            lastMessage = channel.pinned_message;
            await bot.telegram.sendMessage(DB_CHANNEL_ID, JSON.stringify(lastMessage), { disable_notification: true })
                .then(async m => await bot.telegram.pinChatMessage(DB_CHANNEL_ID, m.message_id, { disable_notification: true }))
                .catch(console.error);
        }
    } catch (error) {
        console.error(error);
    }
    await checkData();
}();
let notUpdatedTodayMessageSent = false;
let notUpdatedCounter = 0;
let checkDataTimeout;
async function checkData() {
    await updateChannel();

    let data = await getData();

    if (data.error) {
        console.error(data.error);
        await bot.telegram.sendMessage(ADMIN_DM_ID, data.error?.message ?? data.error.toString?.() ?? data.error + "");
        await bot.telegram.sendMessage(ADMIN_DM_ID, "__Bot duraklatıldı. Başlatmak için__ **start** __yaz.__", { parse_mode: "Markdown" })
        return;
    }
    if (!data.isToday) {
        let day = moment(moment().format('DD.MM.YYYY') + ' 09:00', 'DD.MM.YYYY HH:mm')
        while (day.weekday() >= 5)
            day.add(1, 'day');
        console.log("!data.isToday && day=", day, "moment=", moment(), "diff=", day.diff(moment()))

        if (day.diff(moment()) > 0) {
            let date;
            if (lastMessage)
                date = moment(lastMessage.date * 1000).format("DD.MM.YYYY");
            let nowDate = moment().format("DD.MM.YYYY");

            if (date != nowDate && aylikMenu[nowDate]) {
                lastMessage = await bot.telegram.sendPhoto(CHANNEL_ID, { source: "placeholder.png" }, {
                    caption: "```\n" + aylikMenu[nowDate].join('\n') + "```",
                    parse_mode: "Markdown",
                    disable_notification: true,
                });
                await bot.telegram.sendMessage(DB_CHANNEL_ID, JSON.stringify(lastMessage), { disable_notification: true })
                    .then(async m => await bot.telegram.pinChatMessage(DB_CHANNEL_ID, m.message_id, { disable_notification: true }))
                    .catch(console.error);
            }

            let timeout = day.diff(moment());
            await bot.telegram.sendMessage(ADMIN_DM_ID, "Sonraki kontrol: ```\n" + moment.duration(timeout).humanize(true) + "```", { parse_mode: "Markdown", disable_notification: true });
            clearTimeout(checkDataTimeout);
            checkDataTimeout = setTimeout(checkData, timeout);
        } else {
            if (!notUpdatedTodayMessageSent || notUpdatedCounter % 30 == 0) {
                await bot.telegram.sendMessage(ADMIN_DM_ID, "Bugünkü yemek bilgisi hala güncellenmemiş.", { disable_notification: notUpdatedTodayMessageSent });
                notUpdatedTodayMessageSent = true;
            }
            notUpdatedCounter++;
            clearTimeout(checkDataTimeout);
            checkDataTimeout = setTimeout(checkData, 60 * 1000);
        }
        return;
    }
    notUpdatedTodayMessageSent = false;
    notUpdatedCounter = 0;

    if (!channel.pinned_message) {
        await sendMessage(data);
        await updateChannel();
    } else {
        let date = moment(channel.pinned_message.date * 1000).format("DD.MM.YYYY");
        let nowDate = moment().format("DD.MM.YYYY");

        if (date != nowDate && moment().hours() >= 9) {
            await sendMessage(data);
            await updateChannel();
        }
    }

    let { pinned_message } = channel;
    if (pinned_message.caption != data.rawText) {
        await sendMessage(data);
    }

    let day = moment(moment().format('DD.MM.YYYY') + ' 00:00', 'DD.MM.YYYY HH:mm').add(1, 'day')
    while (day.weekday() >= 5)
        day.add(1, 'day');
    let timeout = day.diff(moment());

    await bot.telegram.sendMessage(ADMIN_DM_ID, "Günlük yemek gönderildi. Sonraki kontrol: ```\n" + moment.duration(timeout).humanize(true) + "```", { parse_mode: "Markdown", disable_notification: true });
    clearTimeout(checkDataTimeout);
    checkDataTimeout = setTimeout(checkData, timeout)
}

async function sendMessage(data) {
    await bot.telegram.sendChatAction(CHANNEL_ID, "upload_photo");
    if (!data)
        data = await getData();
    if (!data.isToday) {
        return;
    }

    if (lastMessage)
        try {
            let date = moment(lastMessage.date * 1000).format("DD.MM.YYYY");
            let nowDate = moment().format("DD.MM.YYYY");
            if (date == nowDate) {
                await bot.telegram.editMessageMedia(CHANNEL_ID, lastMessage.message_id, null, {
                    media: data.imgUrl || { source: "placeholder.png" },
                    caption: data.text,
                    parse_mode: "Markdown",
                    type: "photo",
                });
                await bot.telegram.pinChatMessage(CHANNEL_ID, lastMessage.message_id);

                return lastMessage;
            }
        } catch (error) {
            console.error(error);
            await bot.telegram.sendMessage(ADMIN_DM_ID, error?.message ?? error.toString?.() ?? error + "");
        }

    lastMessage = await bot.telegram.sendPhoto(CHANNEL_ID, data.imgUrl || { source: "placeholder.png" }, {
        caption: data.text,
        parse_mode: "Markdown",
    });
    await bot.telegram.sendMessage(DB_CHANNEL_ID, JSON.stringify(lastMessage), { disable_notification: true })
        .then(async m => await bot.telegram.pinChatMessage(DB_CHANNEL_ID, m.message_id, { disable_notification: true }))
        .catch(console.error);
    await bot.telegram.pinChatMessage(CHANNEL_ID, lastMessage.message_id);
    return lastMessage;
}

bot.on('text', async ctx => {
    console.log(ctx.message.chat.id, ctx.message.from.username, ctx.message.text);

    if (ctx.message.chat.id == ADMIN_DM_ID) {
        await updateChannel();

        if (ctx.message.text == "test") {
            await bot.telegram.sendChatAction(CHANNEL_ID, "upload_photo");
            let msg = await bot.telegram.sendPhoto(CHANNEL_ID, { source: "placeholder.png" }, {
                caption: `\`\`\`\nKÖYLÜM ÇORBA (160 kkal)
ÇOBAN KAVURMA (434 kkal)
SADE PİRİNÇ PİLAVI (360 kkal)
ŞAM TATLISI (440 kkal)\`\`\``,
                parse_mode: "Markdown",
            });
            lastMessage = msg;
            await bot.telegram.pinChatMessage(CHANNEL_ID, msg.message_id);



            return;
        }
        if (ctx.message.text == "start") {
            clearTimeout(checkDataTimeout);
            checkDataTimeout = setTimeout(checkData, 100);
            return;
        }
        if (ctx.message.text == "deletephoto" || ctx.message.text == "deleteimage") {
            await bot.telegram.editMessageMedia(CHANNEL_ID, channel.pinned_message.message_id, null, {
                media: { source: "placeholder.png" },
                caption: "```\n" + channel.pinned_message.caption + "```",
                parse_mode: "Markdown",
                type: "photo",
            });
            return;
        }
        if (ctx.message.text == "skipday") {
            let day = moment(moment().format('DD.MM.YYYY') + ' 09:00', 'DD.MM.YYYY HH:mm').add(1, 'day')
            let timeout = day.diff(moment());
            await bot.telegram.sendMessage(ADMIN_DM_ID, "Bugünlük kontrol atlandı. Sonraki kontrol: ```\n" + moment.duration(timeout).humanize(true) + "```", { parse_mode: "Markdown", disable_notification: true });
            clearTimeout(checkDataTimeout);
            checkDataTimeout = setTimeout(checkData, timeout)
        }



    }

    await ctx.reply(`\`\`\`\nSelam ${ctx.message.from.first_name}, günlük yemek menüsünü otomatik olarak paylaştığımız kanalımıza katılarak her gün bildirim alabilirsin!\`\`\`\n\n[${channel.title}](${channel.invite_link})`, {
        parse_mode: "Markdown"
    });
});

bot.on("photo", async ctx => {
    if (ctx.message.chat.id != ADMIN_DM_ID) return;

    if (ctx.message.caption == "edit") {
        await updateChannel();
        await bot.telegram.editMessageMedia(CHANNEL_ID, channel.pinned_message.message_id, null, {
            media: ctx.message.photo[0].file_id,
            caption: "```\n" + channel.pinned_message.caption + "```",
            parse_mode: "Markdown",
            type: "photo",
        });

    }

})

bot.on('channel_post', async ctx => {
    await updateChannel();
    let { channelPost } = ctx;
    console.log(channelPost.author_signature ?? channelPost.sender_chat?.title ?? channelPost.chat.title, '>>', channelPost.caption ?? channelPost.text, '    --', channelPost.message_id);

    if (channelPost.pinned_message) {
        bot.telegram.deleteMessage(ctx.chat.id, channelPost.message_id)
            .then(b => console.log("Sistem mesajı silindi."))
            .catch(err => console.error("Sistem mesajı silinirken hata meydana geldi:", err))
    }
    // bot.telegram.editMessageText(CHANNEL_ID,lastMessage.id, null, "");

})

bot.on('channel_chat_created', async ctx => {
    console.log(ctx.message.chat.id, ctx.message.from.username, ctx.message.text);
});

bot.launch();

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));