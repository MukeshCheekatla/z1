const TMDB_API_KEY = 'YOUR_TMDB_API_KEY_HERE'; // Replace with your TMDb API key
const BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

export async function searchMovies(query) {
  if (!query) return [];

  try {
    const url = `${BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}`;
    const response = await fetch(url);
    const data = await response.json();

    if (!data.results) return [];

    return data.results.map(movie => ({
      id: movie.id,
      title: movie.title,
      poster: movie.poster_path ? `${IMAGE_BASE_URL}${movie.poster_path}` : 'https://via.placeholder.com/500x750?text=No+Poster',
      release_date: movie.release_date
    }));
  } catch (error) {
    console.error('Error fetching from TMDb:', error);
    return [];
  }
}
