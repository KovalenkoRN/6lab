import React, { useState, useEffect, useRef } from 'react';
import MovieCard from './MovieCard';
import { buildSearchUrl, readOmdbResponse, HAS_API_KEY } from './api';

const HISTORY_KEY = 'movie-search-history';
const HISTORY_SIZE = 5;
const PAGE_SIZE = 10; // OMDb отдаёт по 10 результатов на страницу

const NO_KEY_MESSAGE =
  'не задан API-ключ OMDb. Создайте в папке проекта файл .env со строкой VITE_OMDB_API_KEY=ваш_ключ и перезапустите npm run dev';

// Перевод типичных ошибок OMDb
const OMDB_ERRORS = {
  'Invalid API key!': 'неверный или ещё не активированный API-ключ. Проверьте ключ в файле .env и активируйте его по ссылке из письма OMDb',
  'No API key provided.': 'не указан API-ключ',
  'Too many results.': 'слишком много результатов — уточните запрос',
  'Request limit reached!': 'исчерпан дневной лимит запросов к OMDb (1000 в сутки), попробуйте завтра',
};

// Чтение истории поиска из localStorage (с защитой от ошибок)
function loadHistory() {
  try {
    const saved = JSON.parse(localStorage.getItem(HISTORY_KEY));
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

// Из строки года OMDb ("2010" или "2010–2015") берём первый год
function parseYear(yearStr) {
  const n = parseInt(yearStr, 10);
  return Number.isNaN(n) ? null : n;
}

function App() {
  // Шаг 2. Основные состояния
  const [query, setQuery] = useState('');
  const [movies, setMovies] = useState([]);
  const [status, setStatus] = useState('idle'); // idle, loading, error, success
  const [error, setError] = useState(null);

  // Доп. задания
  const [page, setPage] = useState(1); // пагинация
  const [totalResults, setTotalResults] = useState(0);
  const [lastQuery, setLastQuery] = useState(''); // по какому запросу показаны результаты
  const [yearFrom, setYearFrom] = useState(''); // фильтр по году
  const [yearTo, setYearTo] = useState('');
  const [history, setHistory] = useState(loadHistory); // история поиска
  const [autoSearch, setAutoSearch] = useState(false); // автопоиск с debounce

  // ref нужен для синхронной проверки «идёт ли загрузка» и для отмены запроса
  const loadingRef = useRef(false);
  const controllerRef = useRef(null);

  // Сохраняем историю в localStorage при каждом изменении
  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch {
      /* localStorage может быть недоступен — история просто не сохранится */
    }
  }, [history]);

  // При размонтировании приложения отменяем незавершённый запрос
  useEffect(() => () => controllerRef.current?.abort(), []);

  const addToHistory = (q) => {
    setHistory((prev) => [q, ...prev.filter((item) => item.toLowerCase() !== q.toLowerCase())].slice(0, HISTORY_SIZE));
  };

  // Шаг 3. Функция запроса к OMDb
  // fromAuto = true — вызов из автопоиска: предыдущий запрос отменяется, а не блокирует новый
  const fetchMovies = async (searchQuery, pageNumber = 1, fromAuto = false) => {
    const q = searchQuery.trim();

    // Краевой случай: пустой запрос
    if (!q) {
      setMovies([]);
      setStatus('error');
      setError('Введите название фильма');
      return;
    }

    // Без ключа OMDb не ответит — сразу объясняем, что делать
    if (!HAS_API_KEY) {
      setMovies([]);
      setStatus('error');
      setError(NO_KEY_MESSAGE);
      return;
    }

    // Запрет повторных запросов во время загрузки
    if (loadingRef.current && !fromAuto) return;

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    loadingRef.current = true;
    setStatus('loading');
    setError(null);

    try {
      const res = await fetch(buildSearchUrl(q, pageNumber), { signal: controller.signal });

      // OMDb при ошибке ключа отвечает 401, но с JSON { Error: "..." } — читаем его
      const data = await readOmdbResponse(res);

      if (data.Error) {
        // OMDb возвращает { Response: "False", Error: "..." }
        setMovies([]);
        setTotalResults(0);
        if (data.Error === 'Movie not found!') {
          // Это не сбой, а пустой результат → «Ничего не найдено»
          setStatus('success');
          setLastQuery(q);
          addToHistory(q);
        } else {
          // Invalid API key!, Too many results. и т. п.
          setStatus('error');
          setError(OMDB_ERRORS[data.Error] || data.Error);
        }
        return;
      }

      setMovies(data.Search || []);
      setTotalResults(Number(data.totalResults) || 0);
      setPage(pageNumber);
      setLastQuery(q);
      setStatus('success');
      addToHistory(q);
    } catch (err) {
      if (err.name === 'AbortError') return; // запрос отменён более новым — молча выходим
      setMovies([]);
      setStatus('error');
      setError(err.message === 'Failed to fetch' ? 'Нет соединения с сервером' : err.message);
    } finally {
      if (controllerRef.current === controller) {
        loadingRef.current = false;
      }
    }
  };

  // Шаг 7. Автопоиск при вводе: useEffect + debounce 500 мс
  useEffect(() => {
    if (!autoSearch) return;

    const timer = setTimeout(() => {
      if (query.trim().length > 2) {
        fetchMovies(query, 1, true);
      } else {
        controllerRef.current?.abort();
        loadingRef.current = false;
        setMovies([]);
        setStatus('idle');
        setError(null);
      }
    }, 500);

    // Очистка таймера: каждый новый символ сбрасывает предыдущий таймер
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, autoSearch]);

  // Шаг 4. Обработчики: кнопка «Найти» и Enter (через submit формы)
  const handleSubmit = (e) => {
    e.preventDefault();
    fetchMovies(query, 1);
  };

  const handleHistoryClick = (q) => {
    setQuery(q);
    fetchMovies(q, 1);
  };

  const clearHistory = () => setHistory([]);

  // Фильтрация по году на клиенте
  const from = yearFrom !== '' ? Number(yearFrom) : null;
  const to = yearTo !== '' ? Number(yearTo) : null;
  const yearError = from !== null && to !== null && from > to ? 'Год «от» не может быть больше года «до»' : null;

  const visibleMovies = yearError
    ? movies
    : movies.filter((m) => {
        const y = parseYear(m.Year);
        if (y === null) return true;
        if (from !== null && y < from) return false;
        if (to !== null && y > to) return false;
        return true;
      });

  const totalPages = Math.ceil(totalResults / PAGE_SIZE);
  const isLoading = status === 'loading';

  return (
    <main className="app">
      <h1>Поиск фильмов</h1>

      {!HAS_API_KEY && <div className="error" style={{ marginBottom: '1rem' }}>Внимание: {NO_KEY_MESSAGE}.</div>}

      <form className="search" onSubmit={handleSubmit}>
        <input
          className="search__input"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Например: Matrix"
          aria-label="Название фильма"
        />
        <button className="btn" type="submit" disabled={isLoading}>
          Найти
        </button>
      </form>

      <div className="options">
        <label className="checkbox">
          <input type="checkbox" checked={autoSearch} onChange={(e) => setAutoSearch(e.target.checked)} />
          Автопоиск при вводе (debounce 500 мс, от 3 символов)
        </label>

        <div className="years">
          <span>Год:</span>
          <input
            type="number"
            placeholder="от"
            value={yearFrom}
            onChange={(e) => setYearFrom(e.target.value)}
            aria-label="Год от"
          />
          <span>—</span>
          <input
            type="number"
            placeholder="до"
            value={yearTo}
            onChange={(e) => setYearTo(e.target.value)}
            aria-label="Год до"
          />
        </div>
      </div>
      {yearError && <p className="error-text">{yearError}</p>}

      {history.length > 0 && (
        <div className="history">
          <span>Недавние запросы:</span>
          {history.map((item) => (
            <button key={item} type="button" className="chip" onClick={() => handleHistoryClick(item)} disabled={isLoading}>
              {item}
            </button>
          ))}
          <button type="button" className="chip chip--clear" onClick={clearHistory}>
            очистить
          </button>
        </div>
      )}

      {/* Шаг 5. Отображение UI по состоянию */}
      {status === 'idle' && <p className="hint">Введите название фильма и нажмите «Найти».</p>}

      {status === 'loading' && (
        <div className="loading">
          <div className="spinner" />
          <p>Загрузка...</p>
        </div>
      )}

      {status === 'error' && (
        <div className="error">
          <p>Ошибка: {error}</p>
        </div>
      )}

      {status === 'success' && movies.length === 0 && <p className="hint">Ничего не найдено по вашему запросу.</p>}

      {status === 'success' && movies.length > 0 && (
        <>
          <p className="summary">
            По запросу «{lastQuery}» найдено: {totalResults}. Страница {page} из {totalPages}.
          </p>

          {visibleMovies.length === 0 ? (
            <p className="hint">На этой странице нет фильмов в выбранном диапазоне лет.</p>
          ) : (
            <div className="movie-list">
              {visibleMovies.map((movie) => (
                <MovieCard key={movie.imdbID} movie={movie} />
              ))}
            </div>
          )}
        </>
      )}

      {/* Пагинация: показываем и во время загрузки следующей страницы */}
      {(status === 'success' || isLoading) && totalPages > 1 && (
        <div className="pagination">
          <button className="btn" onClick={() => fetchMovies(lastQuery, page - 1)} disabled={isLoading || page <= 1}>
            ← Предыдущая страница
          </button>
          <span>
            {page} / {totalPages}
          </span>
          <button
            className="btn"
            onClick={() => fetchMovies(lastQuery, page + 1)}
            disabled={isLoading || page >= totalPages}
          >
            Следующая страница →
          </button>
        </div>
      )}
    </main>
  );
}

export default App;
