import { getLocalQuote, getRandomQuote, isSameDay } from "./utils/index.js";
import * as dotenv from "dotenv";
import TelegramBot from "node-telegram-bot-api";
import axios from "axios";
import FormData from "form-data";

dotenv.config();

const TOKEN = process.env.BOT_TOKEN;
const FBAPI = process.env.FB_API_KEY;
const FBSECRET = process.env.FB_SECRET_KEY;

const requiredEnvVars = ["BOT_TOKEN", "FB_API_KEY", "FB_SECRET_KEY"];
const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);

if (missingVars.length > 0) {
  console.error("❌ Отсутствуют переменные окружения:", missingVars.join(", "));
  process.exit(1);
}

console.log("✅ Все переменные окружения загружены");

const FUSIONBRAIN_URL = "https://api-key.fusionbrain.ai/";
const AUTH_HEADERS = {
  "X-Key": `Key ${FBAPI}`,
  "X-Secret": `Secret ${FBSECRET}`,
};

// Получаем pipeline_id (аналог get_pipeline из Python)
async function getPipelineId() {
  try {
    const response = await axios.get(FUSIONBRAIN_URL + "key/api/v1/pipelines", {
      headers: AUTH_HEADERS,
    });

    console.log("Доступные пайплайны:", response.data);

    // Берем первый доступный пайплайн
    if (response.data && response.data.length > 0) {
      const pipelineId = response.data[0].id;
      console.log("Используем pipeline ID:", pipelineId);
      return pipelineId;
    }

    return null;
  } catch (error) {
    console.error(
      "Ошибка при получении pipeline ID:",
      error.response?.data || error.message
    );
    return null;
  }
}

// Запуск генерации (аналог generate из Python)
async function generateImage(prompt, pipelineId) {
  try {
    const enhancedPrompt = `PSYCHOLOGICAL CONCEPT: "${prompt}"

CREATE a detailed metaphorical visual representation WITHOUT ANY TEXT.

STRICT REQUIREMENTS:
- ABSOLUTELY NO TEXT, WORDS, LETTERS, OR WRITING OF ANY KIND
- NO inscriptions, labels, watermarks, signatures, or logos
- NO text-like patterns or arrangements that could be mistaken for writing

VISUAL METAPHORS ONLY:
- Use natural elements: trees, water, light, landscapes
- Abstract shapes and patterns that convey emotion
- Color psychology and lighting to express meaning
- Composition and perspective to tell the story

BANNED: text, words, letters, numbers, writing, inscription, label, typography, font, alphabet, character, symbol, written, printed, watermark, signature, logo, brand, caption, subtitle, title, heading, paragraph, sentence, phrase, word art, calligraphy, handwriting, type, print, lettering, scribbles, marks, signs
`;

    const params = {
      type: "GENERATE",
      numImages: 1,
      width: 648,
      height: 648,
      generateParams: {
        query: enhancedPrompt,
      },
    };

    const formData = new FormData();
    formData.append("pipeline_id", pipelineId);
    formData.append("params", JSON.stringify(params), {
      contentType: "application/json",
    });

    const response = await axios.post(
      FUSIONBRAIN_URL + "key/api/v1/pipeline/run",
      formData,
      {
        headers: {
          ...AUTH_HEADERS,
          ...formData.getHeaders(),
        },
        timeout: 30000,
      }
    );

    console.log("Ответ запуска генерации:", response.data);

    if (response.data.uuid) {
      return response.data.uuid;
    } else {
      throw new Error("Не получили UUID генерации");
    }
  } catch (error) {
    console.error(
      "Ошибка при запуске генерации:",
      error.response?.data || error.message
    );
    return null;
  }
}

// Проверка статуса генерации (аналог check_generation из Python)
async function checkGenerationStatus(requestId, attempts = 20, delay = 3000) {
  try {
    while (attempts > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));

      const response = await axios.get(
        FUSIONBRAIN_URL + "key/api/v1/pipeline/status/" + requestId,
        {
          headers: AUTH_HEADERS,
          timeout: 10000,
        }
      );

      console.log("Статус генерации:", response.data.status);

      if (response.data.status === "DONE") {
        // ВОТ ОНО! Изображение в result.files как в Python примере
        if (
          response.data.result &&
          response.data.result.files &&
          response.data.result.files.length > 0
        ) {
          return response.data.result.files[0]; // Возвращаем URL или base64 изображения
        } else {
          console.log("❌ Файлы не найдены в result:", response.data.result);
          return null;
        }
      } else if (response.data.status === "FAILED") {
        console.log("❌ Генерация не удалась:", response.data);
        return null;
      }

      attempts--;
    }

    console.log("⏰ Превышено время ожидания генерации");
    return null;
  } catch (error) {
    console.error(
      "Ошибка при проверке статуса:",
      error.response?.data || error.message
    );
    return null;
  }
}

// Основная функция для генерации изображения
async function generateImageWithFusionBrain(prompt) {
  try {
    // 1. Получаем pipeline ID
    const pipelineId = await getPipelineId();
    if (!pipelineId) {
      throw new Error("Не удалось получить pipeline ID");
    }

    // 2. Запускаем генерацию
    const generationId = await generateImage(prompt, pipelineId);
    if (!generationId) {
      throw new Error("Не удалось запустить генерацию");
    }

    console.log("Запущена генерация с ID:", generationId);

    // 3. Проверяем статус и получаем изображение
    const imageFile = await checkGenerationStatus(generationId);
    return imageFile;
  } catch (error) {
    console.error("Ошибка в generateImageWithFusionBrain:", error.message);
    return null;
  }
}

const bot = new TelegramBot(TOKEN, { polling: true });
let userLastRequest = {};

// Menu
function setMainMenu(chatId) {
  const menuOptions = {
    reply_markup: {
      keyboard: [[{ text: "Получить цитату" }]],
    },
    resize_keyboard: true,
  };
  bot.sendMessage(
    chatId,
    "Добро пожаловать! Нажми кнопку ниже, чтобы получить цитату.",
    menuOptions
  );
}

// Обработчики
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
        "На сегодня цитата уже получена. Возвращайтесь завтра! 🌅"
      );
      return;
    }

    userLastRequest[chatId] = now;

    try {
      const waitingMessage = await bot.sendMessage(
        chatId,
        "🔄 Генерируем уникальную цитату и изображение... Это может занять 30-60 секунд."
      );

      const quote = await getRandomQuote();
      const imageFile = await generateImageWithFusionBrain(quote.content);

      await bot.deleteMessage(chatId, waitingMessage.message_id);

      if (imageFile) {
        // Проверяем тип файла (URL или base64)
        if (imageFile.startsWith("http")) {
          // Если это URL - скачиваем изображение
          const imageResponse = await axios.get(imageFile, {
            responseType: "arraybuffer",
          });
          await bot.sendPhoto(chatId, Buffer.from(imageResponse.data), {
            caption: `${quote.text}\n\n🖼️ Изображение сгенерировано нейросетью FusionBrain`,
          });
        } else {
          // Если это base64
          const imageBuffer = Buffer.from(imageFile, "base64");
          await bot.sendPhoto(chatId, imageBuffer, {
            caption: `${quote.text}\n\n🖼️ Изображение сгенерировано нейросетью FusionBrain`,
          });
        }

        console.log("✅ Изображение успешно отправлено");
      } else {
        await bot.sendMessage(
          chatId,
          `К сожалению, не удалось сгенерировать изображение. 😔\n\n${quote.text}`
        );
      }
    } catch (error) {
      console.error("Ошибка:", error);
      await bot.sendMessage(chatId, "Произошла ошибка. Попробуйте позже.");
    }
  }
});

bot.on("error", (error) => {
  console.error("Ошибка Telegram Bot API:", error);
});

console.log("🤖 Бот запущен!");
