const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");

const TOKEN = "8327969194:AAHoPBBxnHqbNeQvl7vUg5SY2xh5lErnXm0";

const bot = new TelegramBot(TOKEN, { polling: true });

let userLastRequest = {};

function setMainMenu(chatId) {
  const menuOptions = {
    reply_markup: {
      keyboard: [[{ text: "Получить цитату" }]],
    },
    resize_keyboard: true,
    one_time_keyboard: false,
  };
  bot.sendMessage(
    chatId,
    "Добро пожаловать! Нажми кнопку ниже, чтобы получить цитату.",
    menuOptions
  );
}

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

//Проверка даты
function isSameDay(date1, date2) {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
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

function getLocalQuote() {
  const localQuotes = [
    {
      text: "Всё приходит вовремя для того, кто умеет ждать. — © Оноре де Бальзак",
      content: "всё приходит вовремя для того кто умеет ждать",
    },
    {
      text: "Мысль — начало всего. И мыслями можно управлять. И потому главное дело совершенствования: работать над мыслями. — © Лев Толстой",
      content: "мысль начало всего и мыслями можно управлять",
    },
    {
      text: "Ваше время ограничено, не тратьте его, живя чужой жизнью. — © Стив Джобс",
      content: "ваше время ограничено не тратьте его живя чужой жизнью",
    },
    {
      text: "Самый главный человек — тот, кто перед тобой. — © Фёдор Достоевский",
      content: "самый главный человек тот кто перед тобой",
    },
    {
      text: "Никогда не поздно уйти из толпы. Следуй за своей мечтой, двигайся к своей цели. — © Бернард Шоу",
      content: "никогда не поздно уйти из толпы следуй за своей мечтой",
    },
  ];

  // Выбираем случайную цитату из массива
  const randomIndex = Math.floor(Math.random() * localQuotes.length);
  return localQuotes[randomIndex];
}

//Errors
bot.on("polling_error", (error) => {
  console.error("Polling error:", error.code, error.message);
});

console.log("Бот запущен и слушает сообщения...");
