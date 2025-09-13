import { getLocalQuote, isSameDay } from "./utils/index.js";

import TelegramBot from "node-telegram-bot-api";
import axios from "axios";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { mainMenu, WELCOME_MESSAGE } from "./constants/menu.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TOKEN = "8327969194:AAHoPBBxnHqbNeQvl7vUg5SY2xh5lErnXm0";

const bot = new TelegramBot(TOKEN, { polling: true });

let userLastRequest = {};

bot.onText(/\/start|\/help/, (msg) => {
  const chatId = msg.chat.id;
  if (!userLastRequest[chatId]) {
    userLastRequest[chatId] = null;
  }
  setMainMenu(chatId);
});

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (text === "Получить цитату") {
    const now = new Date();
    const lastRequestDate = userLastRequest[chatId];

    if (lastRequestDate && isSameDay(now, lastRequestDate)) {
      bot.sendMessage(
        chatId,
        "На сегодня цитата уже получена. Возвращайтесь завтра за новой мудростью! 🌅"
      );
    } else {
      userLastRequest[chatId] = now;
      const waitingMessage = await bot.sendMessage(
        chatId,
        "Ищем для вас мудрую цитату... ✨"
      );
      const quote = await getRandomQuote();
      await bot.deleteMessage(chatId, waitingMessage.message_id);
      bot.sendMessage(chatId, quote.text);
    }
  } else if (text === "Женский книжный клуб") {
    handleWomensClub(chatId);
  } else if (text === "Обо мне") {
    handleAboutMe(chatId);
  }
});

// Женский клуб
async function handleWomensClub(chatId) {
  try {
    const photosDir = path.join(__dirname, "assets", "images", "womens");
    const files = fs.readdirSync(photosDir);
    const imageFiles = files
      .filter((file) => /\.(jpg|jpeg|png|gif)$/i.test(file))
      .slice(0, 5);

    if (imageFiles.length === 0) {
      await bot.sendMessage(chatId, "Фотографии временно недоступны.");
      return;
    }
    const mediaGroup = imageFiles.map((file, index) => ({
      type: "photo",
      media: path.join(photosDir, file),
      caption:
        index === 0
          ? `Женский книжный клуб 📚

  <strong>Это пространство, для женщин и про женщин, которое создаётся вместе с вами 🕊️</strong>

  Место, где через книги, фильмы, психологию и душевные разговоры, истории мы будем:

    • Разбирать то, о чем обычно молчат.
    • Находить поддержку.
    • Учиться лучше понимать себя и других.
    • Вдохновляться и вдохновлять.

  <em>Без стереотипов. Без осуждения. Честно к себе.</em>`
          : undefined,
      parse_mode: "HTML",
    }));

    await bot.sendMediaGroup(chatId, mediaGroup);

    await bot.sendMessage(chatId, "Хотите присоединиться к женскому клубу?", {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "📖 Записаться в книжный клуб",
              url: "https://t.me/viktoria_albu",
            },
          ],
        ],
        resize_keyboard: true,
      },
    });
  } catch (error) {
    console.error("Ошибка при отправке фото книжного клуба:", error);
    await bot.sendMessage(chatId, "Временно недоступно. Попробуйте позже.");
  }
}

// Обо мне
async function handleAboutMe(chatId) {
  try {
    const photosDir = path.join(
      __dirname,
      "assets",
      "images",
      "self",
      "IMG_2148.jpg"
    );

    const caption =
      "Я профессиональный психолог с многолетним опытом работы. Специализируюсь на женской психологии, отношениях и личностном росте. Рада помочь вам на пути к гармонии!";

    await bot.sendPhoto(chatId, photosDir, {
      caption: caption,
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "💫 Записаться на прием",
              url: "https://t.me/viktoria_albu",
            },
          ],
        ],
      },
    });
  } catch (error) {
    console.error("Ошибка при отправке фото 'Обо мне':", error);
    await bot.sendMessage(chatId, "Временно недоступно. Попробуйте позже.");
  }
}

//Получение цитат

async function getRandomQuote() {
  try {
    const response = await axios.get("https://api.forismatic.com/api/1.0/", {
      params: {
        method: "getQuote",
        lang: "ru",
        format: "json",
      },
    });

    const quoteData = response.data;
    const author = quoteData.quoteAuthor || "Неизвестный автор";
    const fullQuoteText = `${quoteData.quoteText} — © ${author}`;

    return {
      text: fullQuoteText,
      content: quoteData.quoteText,
    };
  } catch {
    console.error();
    return getLocalQuote();
  }
}

//Menu

function setMainMenu(chatId) {
  bot.sendMessage(chatId, WELCOME_MESSAGE, mainMenu);
}

//Errors
bot.on("polling_error", (error) => {
  console.error("Polling error:", error.code, error.message);
});

console.log("Бот запущен и слушает сообщения...");
