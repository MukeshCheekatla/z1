import { searchMovies } from './tmdb.js';
import { getSources } from './sources.js';

/**
 * Searches for movies and returns them with playable/clickable source links.
 * @param {string} query - The search query from Nuvio.
 * @returns {Promise<Array>} - Array of movie objects.
 */
export async function search(query) {
  if (!query) return [];

  const movies = await searchMovies(query);

  return movies.map(movie => ({
    title: movie.title,
    poster: movie.poster,
    sources: getSources(movie.title)
  }));
}
