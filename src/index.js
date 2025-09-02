const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");
const { getLocalQuote, isSameDay, setMainMenu } = require("./utils");

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
      console.log("Цитата для генерации изображения:", quote.content);
    }
  }
});

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

//Errors
bot.on("polling_error", (error) => {
  console.error("Polling error:", error.code, error.message);
});

console.log("Бот запущен и слушает сообщения...");
