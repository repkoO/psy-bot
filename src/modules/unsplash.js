import axios from "axios";
import dotenv from "dotenv";
import { UNSPLASH_KEYWORDS } from "../constants/quotes.js";
dotenv.config();

const UNSPLASH_TOKEN = process.env.UNSPLASH_ACCESS_KEY;
async function getRandomUnsplashImage() {
  try {
    const randomKeyword =
      UNSPLASH_KEYWORDS[Math.floor(Math.random() * UNSPLASH_KEYWORDS.length)];

    const response = await axios.get("https://api.unsplash.com/photos/random", {
      params: {
        query: randomKeyword,
        orientation: "landscape",
        content_filter: "high",
      },
      headers: {
        Authorization: `Client-ID ${UNSPLASH_TOKEN}`,
      },
      timeout: 10000,
    });

    return {
      url: response.data.urls.regular,
      alt: response.data.alt_description || `Image about ${randomKeyword}`,
      author: response.data.user.name,
      authorUrl: response.data.user.links.html,
    };
  } catch (error) {
    console.error(
      "Ошибка при получении изображения с Unsplash:",
      error.message
    );
    return null;
  }
}

export { getRandomUnsplashImage };