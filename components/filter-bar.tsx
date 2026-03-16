interface FilterBarProps {
  games: string[];
  languages: string[];
  selectedGame?: string;
  selectedLanguage?: string;
}

export function FilterBar({ games, languages, selectedGame, selectedLanguage }: FilterBarProps) {
  return (
    <form className="filterBar" method="get">
      <label>
        <span>Game</span>
        <select name="game" defaultValue={selectedGame ?? 'all'}>
          <option value="all">All games</option>
          {games.map((game) => (
            <option key={game} value={game}>
              {labelize(game)}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Language</span>
        <select name="language" defaultValue={selectedLanguage ?? 'all'}>
          <option value="all">All languages</option>
          {languages.map((language) => (
            <option key={language} value={language}>
              {labelize(language)}
            </option>
          ))}
        </select>
      </label>
      <button type="submit">Apply</button>
    </form>
  );
}

function labelize(value: string): string {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
