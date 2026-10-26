// Team identity sourced from https://github.com/nflverse/nflverse-data/releases/download/teams/teams_colors_logos.csv
export type Team = { abbreviation: string; name: string; primary: string; secondary: string };
export const teams: Record<string, Team> = {
  "ARI": {
    "abbreviation": "ARI",
    "name": "Arizona Cardinals",
    "primary": "#97233F",
    "secondary": "#000000"
  },
  "ATL": {
    "abbreviation": "ATL",
    "name": "Atlanta Falcons",
    "primary": "#A71930",
    "secondary": "#000000"
  },
  "BAL": {
    "abbreviation": "BAL",
    "name": "Baltimore Ravens",
    "primary": "#241773",
    "secondary": "#9E7C0C"
  },
  "BUF": {
    "abbreviation": "BUF",
    "name": "Buffalo Bills",
    "primary": "#00338D",
    "secondary": "#C60C30"
  },
  "CAR": {
    "abbreviation": "CAR",
    "name": "Carolina Panthers",
    "primary": "#0085CA",
    "secondary": "#000000"
  },
  "CHI": {
    "abbreviation": "CHI",
    "name": "Chicago Bears",
    "primary": "#0B162A",
    "secondary": "#E64100"
  },
  "CIN": {
    "abbreviation": "CIN",
    "name": "Cincinnati Bengals",
    "primary": "#FB4F14",
    "secondary": "#000000"
  },
  "CLE": {
    "abbreviation": "CLE",
    "name": "Cleveland Browns",
    "primary": "#FF3C00",
    "secondary": "#311D00"
  },
  "DAL": {
    "abbreviation": "DAL",
    "name": "Dallas Cowboys",
    "primary": "#002244",
    "secondary": "#B0B7BC"
  },
  "DEN": {
    "abbreviation": "DEN",
    "name": "Denver Broncos",
    "primary": "#002244",
    "secondary": "#FB4F14"
  },
  "DET": {
    "abbreviation": "DET",
    "name": "Detroit Lions",
    "primary": "#0076B6",
    "secondary": "#B0B7BC"
  },
  "GB": {
    "abbreviation": "GB",
    "name": "Green Bay Packers",
    "primary": "#203731",
    "secondary": "#FFB612"
  },
  "HOU": {
    "abbreviation": "HOU",
    "name": "Houston Texans",
    "primary": "#03202F",
    "secondary": "#A71930"
  },
  "IND": {
    "abbreviation": "IND",
    "name": "Indianapolis Colts",
    "primary": "#002C5F",
    "secondary": "#a5acaf"
  },
  "JAX": {
    "abbreviation": "JAX",
    "name": "Jacksonville Jaguars",
    "primary": "#006778",
    "secondary": "#000000"
  },
  "KC": {
    "abbreviation": "KC",
    "name": "Kansas City Chiefs",
    "primary": "#E31837",
    "secondary": "#FFB612"
  },
  "LA": {
    "abbreviation": "LA",
    "name": "Los Angeles Rams",
    "primary": "#003594",
    "secondary": "#FFD100"
  },
  "LAC": {
    "abbreviation": "LAC",
    "name": "Los Angeles Chargers",
    "primary": "#007BC7",
    "secondary": "#ffc20e"
  },
  "LV": {
    "abbreviation": "LV",
    "name": "Las Vegas Raiders",
    "primary": "#000000",
    "secondary": "#A5ACAF"
  },
  "MIA": {
    "abbreviation": "MIA",
    "name": "Miami Dolphins",
    "primary": "#008E97",
    "secondary": "#F58220"
  },
  "MIN": {
    "abbreviation": "MIN",
    "name": "Minnesota Vikings",
    "primary": "#4F2683",
    "secondary": "#FFC62F"
  },
  "NE": {
    "abbreviation": "NE",
    "name": "New England Patriots",
    "primary": "#002244",
    "secondary": "#C60C30"
  },
  "NO": {
    "abbreviation": "NO",
    "name": "New Orleans Saints",
    "primary": "#D3BC8D",
    "secondary": "#000000"
  },
  "NYG": {
    "abbreviation": "NYG",
    "name": "New York Giants",
    "primary": "#0B2265",
    "secondary": "#A71930"
  },
  "NYJ": {
    "abbreviation": "NYJ",
    "name": "New York Jets",
    "primary": "#003F2D",
    "secondary": "#000000"
  },
  "PHI": {
    "abbreviation": "PHI",
    "name": "Philadelphia Eagles",
    "primary": "#004C54",
    "secondary": "#A5ACAF"
  },
  "PIT": {
    "abbreviation": "PIT",
    "name": "Pittsburgh Steelers",
    "primary": "#000000",
    "secondary": "#FFB612"
  },
  "SEA": {
    "abbreviation": "SEA",
    "name": "Seattle Seahawks",
    "primary": "#002244",
    "secondary": "#69be28"
  },
  "SF": {
    "abbreviation": "SF",
    "name": "San Francisco 49ers",
    "primary": "#AA0000",
    "secondary": "#B3995D"
  },
  "TB": {
    "abbreviation": "TB",
    "name": "Tampa Bay Buccaneers",
    "primary": "#A71930",
    "secondary": "#322F2B"
  },
  "TEN": {
    "abbreviation": "TEN",
    "name": "Tennessee Titans",
    "primary": "#4495D2",
    "secondary": "#D50A0A"
  },
  "WAS": {
    "abbreviation": "WAS",
    "name": "Washington Commanders",
    "primary": "#5A1414",
    "secondary": "#FFB612"
  }
};
export const aliases: Record<string,string> = {OAK:"LV",SD:"LAC",STL:"LA",JAC:"JAX",LAR:"LA"};
export function teamName(code: string, year: number) {
 if(code === "LV" && year < 2020) return "Oakland Raiders";
 if(code === "LAC" && year < 2017) return "San Diego Chargers";
 if(code === "LA" && year < 2016) return "St. Louis Rams";
 if(code === "WAS" && year < 2020) return "Washington Redskins";
 if(code === "WAS" && year < 2022) return "Washington Football Team";
 return teams[code].name;
}
