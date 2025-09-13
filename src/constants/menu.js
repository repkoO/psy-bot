const mainMenu = {
  reply_markup: {
    keyboard: [
      [{ text: "🌅 Получить цитату" }],
      [{ text: "📚 Женский книжный клуб" }, { text: "Игра матрешка" }],
      [{ text: "👤 Обо мне" }],
    ],
    resize_keyboard: true,
  },
  one_time_keyboard: false,
};

const WELCOME_MESSAGE = `✨ *Добро пожаловать в пространство гармонии и мудрости!* ✨

Я помогу вам найти вдохновение и поддержку в течение дня.

Выберите действие ниже или напишите мне, если нужна помощь 💫`;

export { mainMenu, WELCOME_MESSAGE };
