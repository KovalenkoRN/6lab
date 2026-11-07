// Настройки OMDb API.
// Ключ берётся из файла .env (VITE_OMDB_API_KEY=...).
// Для учебной среды допустимо вписать ключ прямо в строку ниже,
// но в открытый репозиторий так делать нельзя.
export const API_KEY = (import.meta.env.VITE_OMDB_API_KEY || 'ВАШ_КЛЮЧ').trim();
export const API_URL = 'https://www.omdbapi.com/';

// Ключ считается заданным, если это не заглушка и не пустая строка
export const HAS_API_KEY = API_KEY !== '' && API_KEY !== 'ВАШ_КЛЮЧ';

// Поиск фильмов по названию (?s=), page — номер страницы (по 10 результатов)
export function buildSearchUrl(query, page = 1) {
  return `${API_URL}?s=${encodeURIComponent(query)}&page=${page}&apikey=${encodeURIComponent(API_KEY)}`;
}

// Подробная информация о фильме (?i=imdbID) — нужна для описания (Plot)
export function buildDetailsUrl(imdbID) {
  return `${API_URL}?i=${encodeURIComponent(imdbID)}&plot=short&apikey=${encodeURIComponent(API_KEY)}`;
}

// Читает ответ OMDb. При неверном ключе или исчерпанном лимите OMDb отвечает
// кодом 401, но в теле всё равно JSON с полем Error — поэтому сначала читаем JSON.
export async function readOmdbResponse(res) {
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* тело не JSON */
  }
  if (data) return data;
  throw new Error(`Ошибка сервера (${res.status})`);
}

// Заглушка постера через Data URI — не зависит от внешних сервисов
export const NO_POSTER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='450' viewBox='0 0 300 450'%3E%3Crect fill='%23e5e7eb' width='300' height='450'/%3E%3Ctext fill='%236b7280' x='50%25' y='50%25' text-anchor='middle' font-size='24' font-family='sans-serif'%3ENo Poster%3C/text%3E%3C/svg%3E";
