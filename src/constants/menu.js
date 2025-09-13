const mainMenu = {
  reply_markup: {
    keyboard: [
      [{ text: "Получить цитату" }],
      [{ text: "Женский книжный клуб" }, { text: "Игра матрешка" }],
      [{ text: "Обо мне" }],
    ],
  },
  resize_keyboard: true,
  one_time_keyboard: false,
};

const WELCOME_MESSAGE =
  "Добро пожаловать! Нажми кнопку ниже, чтобы получить цитату.";

export { mainMenu, WELCOME_MESSAGE };