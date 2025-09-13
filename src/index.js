// Utils
import { getLocalQuote, isSameDay } from "./utils/index.js";

// Constants
import { mainMenu, WELCOME_MESSAGE } from "./constants/menu.js";

// Modules
import { getRandomUnsplashImage } from "./modules/unsplash.js";

// Packages

import TelegramBot from "node-telegram-bot-api";
import axios from "axios";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const TOKEN = process.env.BOT_TOKEN;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

  if (text === "/start" || text === "/help") {
    return;
  }
  switch (text) {
    case "🌅 Получить цитату":
      getQuoteImage(chatId);
      break;
    case "📚 Женский книжный клуб":
      handleWomensClub(chatId);
      break;
    case "👤 Обо мне":
      handleAboutMe(chatId);
      break;
    case "Игра матрешка":
      handleAboutGame(chatId);
      break;
    default:
      break;
  }
});

// Цитаты
async function getQuoteImage(chatId) {
  const now = new Date();
  const lastRequestDate = userLastRequest[chatId];

  if (lastRequestDate && isSameDay(now, lastRequestDate)) {
    bot.sendMessage(
      chatId,
      `⏳ *На сегодня цитата уже получена*\n\nЗавтра вас ждет новая порция мудрости и вдохновения! 🌅\n\n*Возвращайтесь после полуночи* 💫`,
      { parse_mode: "Markdown" }
    );
  } else {
    userLastRequest[chatId] = now;
    const waitingMessage = await bot.sendMessage(
      chatId,
      "🔍 *Ищем для вас идеальную цитату...*\n\n⏳ Подбираем соответствующее изображение...",
      { parse_mode: "Markdown" }
    );
    const quote = await getRandomQuote();
    const image = await getRandomUnsplashImage();
    await bot.editMessageText("✅ *Готово!* Ваша цитата найдена 💫", {
      chat_id: chatId,
      message_id: waitingMessage.message_id,
      parse_mode: "Markdown",
    });
    try {
      if (image) {
        const imagePath = await downloadImage(
          image.url,
          `quote_${Date.now()}.jpg`
        );
        if (imagePath) {
          await bot.sendPhoto(chatId, imagePath, {
            caption: `${quote.text}`,
            parse_mode: "HTML",
          });
          fs.unlinkSync(imagePath);
        } else {
          await bot.sendMessage(chatId, quote.text);
        }
      } else {
        await bot.sendMessage(chatId, quote.text);
      }
    } catch {
      if (image) {
        const imagePath = await downloadImage(
          image.url,
          `quote_${Date.now()}.jpg`
        );
        if (imagePath) {
          await bot.sendPhoto(chatId, imagePath, {
            caption: `${quote.text}`,
            parse_mode: "HTML",
          });
          fs.unlinkSync(imagePath);
        } else {
          await bot.sendMessage(chatId, quote.text);
        }
      } else {
        await bot.sendMessage(chatId, quote.text);
      }
    }
    await bot.deleteMessage(chatId, waitingMessage.message_id);
  }
}
// Женский клуб
async function handleWomensClub(chatId) {
  const typingMessage = await bot.sendMessage(
    chatId,
    "👩‍👩‍👧‍👧 *Загружаем информацию о клубе...*",
    { parse_mode: "Markdown" }
  );
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

    await bot.deleteMessage(chatId, typingMessage.message_id);

    const mediaGroup = imageFiles.map((file, index) => ({
      type: "photo",
      media: path.join(photosDir, file),
      caption:
        index === 0
          ? `📚 *Женский книжный клуб*\n\n✨ *Пространство, создаваемое вместе с вами* 🕊️\n\n*Что мы делаем:*\n• 🗣️ Разбираем важные темы\n• 💖 Находим поддержку\n• 🌱 Учимся понимать себя\n• ✨ Вдохновляем и вдохновляемся\n\n*Без стереотипов. Без осуждения. Честно к себе.* 💫`
          : undefined,
      parse_mode: "Markdown",
    }));

    await bot.sendMediaGroup(chatId, mediaGroup);

    await bot.sendMessage(
      chatId,
      "💫 *Хотите присоединиться к нашему сообществу?*",
      {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "📖 Записаться в книжный клуб",
                url: "https://t.me/viktoria_albu",
              },
            ],
          ],
        },
      }
    );
  } catch (error) {
    console.error("Ошибка при отправке фото книжного клуба:", error);
    await bot.sendMessage(chatId, "Временно недоступно. Попробуйте позже.");
  }
}

// Обо мне
async function handleAboutMe(chatId) {
  const typingMessage = await bot.sendMessage(
    chatId,
    "👤 *Загружаем информацию...*",
    { parse_mode: "Markdown" }
  );
  try {
    const photosDir = path.join(
      __dirname,
      "assets",
      "images",
      "self",
      "IMG_2148.jpg"
    );

    const caption = `🌿 *Виктория Албу*

*Гештальт-терапевт | Семейный психолог*


✨ *Я помогаю женщинам возвращаться к себе* и строить отношения, в которых по-настоящему комфортно и безопасно.

Я не верю в шаблоны и «как правильно». Я верю в вашу уникальность.


🛡️ *В моем пространстве можно безопасно:*
• Увидеть свою глубину и перестать себя упрекать
• Разрешить себе быть разной — сильной и нежной
• Научиться любить себя просто потому, что вы есть
• Построить отношения, где вас слышат и уважают


🎯 *Моя цель* — помочь вам услышать свой внутренний голос сквозь шум долженствований.


💫 *Если вы чувствуете, что:*
• Потеряли связь с собой
• В отношениях не хватает гармонии
• Хотите научиться слышать себя
*Давайте знакомиться!* Ваш путь к себе начинается здесь.`;

    await bot.deleteMessage(chatId, typingMessage.message_id);
    await bot.sendPhoto(chatId, photosDir, {
      caption: caption,
      parse_mode: "Markdown",
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

// Матрешка
async function handleAboutGame(chatId) {
  const typingMessage = await bot.sendMessage(
    chatId,
    "👤 *Загружаем информацию...*",
    { parse_mode: "Markdown" }
  );

  const videoPath = path.join(__dirname, "assets", "video", "IMG_3328.mov");
  const videoStream = fs.createReadStream(videoPath);
  await bot.sendVideo(chatId, videoStream, {
    caption: `🎮 *Игра «Матрёшка»*

✨ *Собирает целостный образ вас* и помогает получить завершение неоконченных ситуаций, которые вытягивают вашу энергию.`,
    parse_mode: "Markdown",
  });

  await bot.deleteMessage(chatId, typingMessage.message_id);

  await bot.sendMessage(
    chatId,
    `🎯 *Что такое игра «Матрёшка»?*

✨ *Это глубокая психологическая практика*, которая помогает:

• 🧩 *Собрать целостный образ* себя
• ⚡ *Получить разрядку* незавершенных ситуаций
• 💫 *Вернуть энергию*, которую забирают прошлые травмы
• 🌱 *Создать новые стратегии* поведения

*Машина — это больше, чем набор деталей*
*Человек — больше, чем набор органов*
🧸 *Символика матрёшек:*

• 🎎 *Большая матрёшка* — это наш взрослый аватар, та версия себя, которую мы показываем миру

• 🪆 *Маленькие матрёшки* — утраченные части нас:
  - Забытые таланты и мечты
  - Подавленные эмоции и чувства
  - Части, потерянные в травматичных событиях
  - То, что нельзя было проявлять в прошлом

*Травмы могут быть из:*
🔸 Детства и подросткового периода
🔸 Разрывов отношений
🔸 Личностных кризисов
🔸 Сложных жизненных ситуаций

🎯 *Задача игры:*

✨ *Присвоить себе утраченные части* и вернуть себе ресурс для:

• 🚀 *Свершений* и достижений
• 💖 *Гармоничных отношений* с собой
• 🌍 *Гармонии* с миром и другими людьми
• 🧘 *Целостности* и самопринятия

🌱 *Результат:*
• Формируются *новые поведенческие стратегии*
• Разрешаются *глубинные запросы*
• Возвращается *энергия и радость жизни*
• Появляется *ясность* и понимание себя

*Готовы начать путешествие к себе?*

✨ Игра «Матрёшка» — это безопасное пространство для:
• 🧭 Самопознания и исследования
• 🛡️ Возвращения к себе настоящей
• 🌈 Преобразования жизни

🎮 *Хотите попробовать?`,
    {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "Играть", url: "https://t.me/viktoria_albu" }],
        ],
      },
    }
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

//Menu

function setMainMenu(chatId) {
  bot.sendMessage(chatId, WELCOME_MESSAGE, mainMenu);
}

// Unsplash

async function downloadImage(imageUrl, filename) {
  try {
    const response = await axios({
      method: "GET",
      url: imageUrl,
      responseType: "stream",
      timeout: 15000,
    });

    const tempDir = path.join(__dirname, "temp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const filePath = path.join(tempDir, filename);
    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on("finish", () => resolve(filePath));
      writer.on("error", reject);
    });
  } catch (error) {
    console.error("Ошибка при загрузке изображения:", error.message);
    return null;
  }
}

process.on("SIGINT", () => {
  const tempDir = path.join(__dirname, "temp");
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  process.exit(0);
});

//Errors
bot.on("polling_error", (error) => {
  console.error("Polling error:", error.code, error.message);
});

console.log("Бот запущен и слушает сообщения...");
