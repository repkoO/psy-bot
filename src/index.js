import { getLocalQuote, getRandomQuote, isSameDay } from "./utils/index.js";
import * as dotenv from "dotenv";
import TelegramBot from "node-telegram-bot-api";
import axios from "axios";

dotenv.config();

const TOKEN = process.env.BOT_TOKEN;
const FBAPI = process.env.FB_API_KEY;
const FBSECRET = process.env.FB_SECRET_KEY;

const requiredEnvVars = ["BOT_TOKEN", "FB_API_KEY", "FB_SECRET_KEY"];
const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);

if (missingVars.length > 0) {
  console.error("❌ Отсутствуют переменные окружения:", missingVars.join(", "));
  console.error("Проверьте файл .env");
  process.exit(1);
}

console.log("✅ Все переменные окружения загружены");

// Исправляем URL и заголовки согласно документации
const FUSIONBRAIN_URL = "https://api-key.fusionbrain.ai/";
const AUTH_HEADERS = {
  "X-Key": `Key ${FBAPI}`,
  "X-Secret": `Secret ${FBSECRET}`,
};

async function getModelId() {
  try {
    const response = await axios.get(FUSIONBRAIN_URL + "key/api/v1/pipelines", {
      headers: AUTH_HEADERS,
    });

    console.log("Статус ответа:", response.status);
    console.log("Данные ответа:", response.data);

    // Ищем модель Kandinsky в ответе
    const model = response.data.find(
      (m) =>
        m.name &&
        (m.name.includes("Kandinsky") || m.nameEn.includes("Kandinsky"))
    );

    return model ? model.uuid : null;
  } catch (error) {
    console.error(
      "Полная ошибка при получении ID модели:",
      error.response?.status,
      error.response?.data || error.message
    );
    return null;
  }
}

async function generateImageWithFusionBrain(prompt) {
  try {
    const modelId = await getModelId();
    if (!modelId) {
      throw new Error("Не удалось получить ID модели Kandinsky");
    }

    const enhancedPrompt = `Психологическая цитата: "${prompt}".
    Абстрактное изображение в спокойных тонах, цифровое искусство,
    психология, арт-терапия, метафорическое изображение, глубина`;

    console.log("Генерируем изображение для промпта:", enhancedPrompt);

    // Используем правильный endpoint и параметры
    const generateResponse = await axios.post(
      FUSIONBRAIN_URL + "key/api/v1/pipeline/run",
      {
        model_id: modelId,
        params: {
          type: "GENERATE",
          width: 1024,
          height: 1024,
          num_images: 1,
          style: "DEFAULT",
          generate_params: {
            query: enhancedPrompt,
          },
        },
      },
      {
        headers: AUTH_HEADERS,
        timeout: 30000,
      }
    );

    const generationId = generateResponse.data.uuid;
    console.log("Запущена генерация с ID:", generationId);

    // Ждем завершения генерации
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 5000)); // Ждем 5 секунд

      const statusResponse = await axios.get(
        FUSIONBRAIN_URL + `key/api/v1/pipeline/status/${generationId}`,
        {
          headers: AUTH_HEADERS,
        }
      );

      console.log("Статус генерации:", statusResponse.data.status);

      if (statusResponse.data.status === "DONE") {
        const images = statusResponse.data.images;
        if (images && images.length > 0) {
          console.log("Изображение успешно сгенерировано");
          return images[0]; // Возвращаем base64 строку
        }
      } else if (statusResponse.data.status === "FAILED") {
        throw new Error("Генерация не удалась");
      }

      attempts++;
    }

    throw new Error("Превышено время ожидания генерации");
  } catch (error) {
    console.error(
      "Ошибка при генерации изображения FusionBrain:",
      error.response?.data || error.message
    );
    return null;
  }
}

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
      return;
    }

    userLastRequest[chatId] = now;

    try {
      const waitingMessage = await bot.sendMessage(
        chatId,
        "🔄 Генерируем уникальную цитату и изображение нейросетью... Это может зануть 15-20 секунд."
      );

      const quote = await getRandomQuote();
      const imageBase64 = await generateImageWithFusionBrain(quote.content);

      await bot.deleteMessage(chatId, waitingMessage.message_id);

      if (imageBase64) {
        const imageBuffer = Buffer.from(imageBase64, "base64");
        await bot.sendPhoto(chatId, imageBuffer, {
          caption: `${quote.text}\n\n🖼️ Изображение сгенерировано нейросетью FusionBrain`,
        });
      } else {
        await bot.sendMessage(
          chatId,
          `К сожалению, не удалось сгенерировать изображение. 😔\n\n${quote.text}`
        );
      }
    } catch (error) {
      console.error("Общая ошибка в обработчике:", error);
      await bot.sendMessage(
        chatId,
        "Произошла ошибка при обработке запроса. Попробуйте позже."
      );
    }
  }
});

// Menu
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

// Errors
bot.on("error", (error) => {
  console.error("Ошибка Telegram Bot API:", error);
});

console.log("🤖 Бот запущен и готов к работе с FusionBrain AI!");
