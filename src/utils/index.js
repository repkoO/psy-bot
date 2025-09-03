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

  const randomIndex = Math.floor(Math.random() * localQuotes.length);
  return localQuotes[randomIndex];
}

//Проверка даты
function isSameDay(date1, date2) {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}


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

export { getLocalQuote, isSameDay, getRandomQuote };