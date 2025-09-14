// Database
import {
  addUser,
  getDailyStats,
  getPopularActions,
  getStats,
  logAction,
  updateUserActivity
} from "./database/db.js";

// Utils
import { isSameDay } from "./utils/index.js";
import delay from "./utils/delay.js";

// Constants
import { mainMenu, WELCOME_MESSAGE } from "./constants/menu.js";

// Modules
import { getRandomUnsplashImage } from "./modules/unsplash.js";
import getRandomQuote from "./modules/quotes.js";

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

  try {
    await addUser(chatId, msg.from);
    await logAction(chatId, "message_received", { text });
    updateUserActivity(chatId);
  } catch (error) {
    console.error("Ошибка логирования:", error);
  }

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
    case "/admin_stats":
      showAdminStats(chatId, msg.from.id);
      break;
    default:
      break;
  }
});

// Цитаты
async function getQuoteImage(chatId) {
  try {
    await logAction(chatId, "quote_requested");
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
      await logAction(chatId, "quote_delivered", {
        hasImage: !!image,
        quoteLength: quote.text.length,
      });
    }
  } catch (error) {
    await logAction(chatId, "quote_error", { error: error.message });
  }
}
// Женский клуб
async function handleWomensClub(chatId) {
  try {
    await logAction(chatId, "womens_club_opened");
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
  } catch (error) {
    await logAction(chatId, "womens_club_error", { error: error.message });
  }
}

// Обо мне
async function handleAboutMe(chatId) {
  try {
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
  } catch (error) {
    await logAction(chatId, "about_error", { error: error.message });
  }
}

// Матрешка
async function handleAboutGame(chatId) {
  try {
    await logAction(chatId, "game_opened");
    const typingMessage = await bot.sendMessage(
      chatId,
      "👤 *Загружаем информацию...*",
      { parse_mode: "Markdown" }
    );

    const videoPath = path.join(__dirname, "assets", "video", "IMG_3328.mp4");
    const videoStream = fs.createReadStream(videoPath);

    await bot.sendVideo(chatId, videoStream, {
      caption: `🎮 *Игра «Матрёшка»*

✨ Собирает целостный образ вас и помогает получить завершение неоконченных ситуаций, которые вытягивают вашу энергию.`,
      parse_mode: "Markdown",
      width: 1080,
      height: 1920,
    });

    await bot.deleteMessage(chatId, typingMessage.message_id);

    await bot.sendMessage(
      chatId,
      `🎯 *Что такое игра «Матрёшка»?*

✨ *Это глубокая психологическая практика*, которая помогает:

• 🧩 Собрать целостный образ себя
• ⚡ Получить разрядку незавершенных ситуаций
• 💫 Вернуть энергию, которую забирают прошлые травмы
• 🌱 Создать новые стратегии поведения`,
      { parse_mode: "Markdown" }
    );

    await delay(1000);

    await bot.sendMessage(
      chatId,
      `*Машина — это больше, чем набор деталей*
*Человек — больше, чем набор органов*

🧸 Символика матрёшек:

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

✨ Присвоить себе утраченные части и вернуть себе ресурс для:

• 🚀 Свершений и достижений
• 💖 Гармоничных отношений с собой
• 🌍 Гармонии с миром и другими людьми
• 🧘 Целостности и самопринятия`,
      { parse_mode: "Markdown" }
    );

    await delay(1000);

    await bot.sendMessage(
      chatId,
      `🌱 *Результат:*
• Формируются новые поведенческие стратегии
• Разрешаются глубинные запросы
• Возвращается энергия и радость жизни
• Появляется ясность и понимание себя

*Готовы начать путешествие к себе?*

✨ Игра «Матрёшка» — это безопасное пространство для:
• 🧭 Самопознания и исследования
• 🛡️ Возвращения к себе настоящей
• 🌈 Преобразования жизни

🎮 Хотите попробовать?`,
      {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "Играть", url: "https://t.me/viktoria_albu" }],
          ],
        },
      }
    );
  } catch (error) {
    await logAction(chatId, "game_error", { error: error.message });
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

// Статистика для админа

async function showAdminStats(chatId, userId) {
  const ADMIN_ID = 258095033;
  if (userId !== ADMIN_ID) {
    await bot.sendMessage(chatId, "❌ Недостаточно прав");
    return;
  }

  try {
    const stats = await getStats();
    const popularActions = await getPopularActions(5);
    const dailyStats = await getDailyStats(7);

    let message = `📊 Статистика бота\n\n`;
    message += `👥 Всего пользователей: ${stats.total_users}\n`;
    message += `🎯 Всего действий: ${stats.total_actions}\n`;
    message += `📅 Активных дней: ${stats.active_days}\n\n`;

    message += `🔥 Топ действий:\n`;
    popularActions.forEach((action, index) => {
      message += `${index + 1}. ${action.action_type}: ${action.count}\n`;
    });

    message += `\n📈 *Статистика за 7 дней:*\n`;
    dailyStats.forEach((day) => {
      message += `${day.date}: ${day.actions_count} действий (${day.unique_users} пользователей)\n`;
    });
    await bot.sendMessage(chatId, message);
  } catch (error) {
    console.error("Ошибка получения статистики:", error);
    await bot.sendMessage(chatId, "❌ Ошибка получения статистики");
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
