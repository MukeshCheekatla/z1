export function getSources(movieTitle) {
  const encodedTitle = encodeURIComponent(movieTitle);
  const searchTitle = encodeURIComponent(`${movieTitle} full movie`);

  return [
    {
      name: "YouTube",
      url: `https://www.youtube.com/results?search_query=${searchTitle}`
    },
    {
      name: "Google Search",
      url: `https://www.google.com/search?q=${encodedTitle}+watch+online`
    },
    {
      name: "Disney+ Hotstar",
      url: `https://www.hotstar.com/in/search?q=${encodedTitle}`
    },
    {
      name: "Zee5",
      url: `https://www.zee5.com/search?q=${encodedTitle}`
    },
    {
      name: "SonyLIV",
      url: `https://www.sonyliv.com/search?q=${encodedTitle}`
    }
  ];
}
