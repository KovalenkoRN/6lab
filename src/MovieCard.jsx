import React, { useState, useEffect } from 'react';
import { buildDetailsUrl, readOmdbResponse, NO_POSTER } from './api';

// Кэш описаний: imdbID -> Plot. Не делаем повторных запросов
// для фильмов, описание которых уже загружено.
const plotCache = new Map();

// Карточка фильма: постер, название, год, краткое описание
function MovieCard({ movie }) {
  const posterUrl = movie.Poster && movie.Poster !== 'N/A' ? movie.Poster : NO_POSTER;

  const [plot, setPlot] = useState(plotCache.get(movie.imdbID) ?? null);
  const [plotLoading, setPlotLoading] = useState(!plotCache.has(movie.imdbID));

  // Доп. задание: описание фильма отдельным запросом ?i=imdbID
  useEffect(() => {
    if (plotCache.has(movie.imdbID)) return;

    const controller = new AbortController();
    setPlotLoading(true);

    fetch(buildDetailsUrl(movie.imdbID), { signal: controller.signal })
      .then(readOmdbResponse)
      .then((data) => {
        if (data.Error) throw new Error(data.Error);
        const text = data.Plot && data.Plot !== 'N/A' ? data.Plot : 'Описание отсутствует.';
        plotCache.set(movie.imdbID, text);
        setPlot(text);
        setPlotLoading(false);
      })
      .catch((err) => {
        if (err.name === 'AbortError') return; // карточка исчезла — ничего не делаем
        setPlot('Не удалось загрузить описание.');
        setPlotLoading(false);
      });

    // Очистка: если карточка размонтирована (новый поиск) — отменяем запрос
    return () => controller.abort();
  }, [movie.imdbID]);

  return (
    <article className="movie-card">
      <img
        src={posterUrl}
        alt={movie.Title}
        // если ссылка на постер битая — подменяем заглушкой
        onError={(e) => {
          if (e.currentTarget.src !== NO_POSTER) e.currentTarget.src = NO_POSTER;
        }}
      />
      <div className="movie-card__body">
        <h3>{movie.Title}</h3>
        <p>
          <strong>Год:</strong> {movie.Year}
        </p>
        {plotLoading ? (
          <div className="spinner spinner--small" aria-label="Загрузка описания" />
        ) : (
          <p className="movie-card__plot">{plot}</p>
        )}
      </div>
    </article>
  );
}

export default MovieCard;
