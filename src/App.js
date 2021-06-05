import {useState, useEffect} from 'react';
import JSSoup from 'jssoup';

function App() {
  const [accessToken, setAccessToken] = useState();
  const [refreshToken, setRefreshToken] = useState();
  const [songArtist, setSongArtist] = useState("");
  const [songTitle, setSongTitle] = useState("");
  const [tab, setTab] = useState("");

  const decodeHTML = (html) => {
    var txt = document.createElement('textarea');
    txt.innerHTML = html;
    return txt.value;
  };

  useEffect(() => {
    const queryString = window.location.search;
    const urlParams = new URLSearchParams(queryString);
    const code = urlParams.get("code");

    if (window.localStorage.getItem("jita.access_token")
        && window.localStorage.getItem("jita.refresh_token")) {
      setAccessToken(window.localStorage.getItem("jita.access_token"));
      setRefreshToken(window.localStorage.getItem("jita.refresh_token"));
    } else if (code) {
      fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        body: new URLSearchParams({
          'grant_type': 'authorization_code',
          'redirect_uri': process.env.REACT_APP_CALLBACK_URI,
          'client_id': process.env.REACT_APP_SPOTIFY_CLIENT_ID,
          'client_secret': process.env.REACT_APP_SPOTIFY_CLIENT_SECRET,
          'code': code,
        })
      }).then(resp => resp.json())
        .then(json => {
          const access_token = json["access_token"];
          const refresh_token = json["refresh_token"];
          window.localStorage.setItem("jita.access_token", access_token);
          window.localStorage.setItem("jita.refresh_token", refresh_token);
          setAccessToken(access_token);
          setRefreshToken(refresh_token);
        });
    } else {
      let clientId = process.env.REACT_APP_SPOTIFY_CLIENT_ID;
      let callbackUri = encodeURI(process.env.REACT_APP_CALLBACK_URI);  
      let url = `https://accounts.spotify.com/authorize?client_id=${clientId}&response_type=code&redirect_uri=${callbackUri}&scope=user-read-currently-playing
%20user-read-email`;
      window.location.replace(url);
    };
  }, [])

  useEffect(() => {
    const refreshTokenFn = () => {
      if (refreshToken) {
        fetch("https://accounts.spotify.com/api/token", {
          method: "POST",
          body: new URLSearchParams({
            'grant_type': 'refresh_token',
            "refresh_token": refreshToken,
            'client_id': process.env.REACT_APP_SPOTIFY_CLIENT_ID,
            'client_secret': process.env.REACT_APP_SPOTIFY_CLIENT_SECRET,
          })
        }).then(resp => resp.json())
          .then(json => {
            const access_token = json["access_token"];
            window.localStorage.setItem("jita.access_token", access_token);
            setAccessToken(access_token);
          });
      }
    }

    const interval = setInterval(refreshTokenFn, 36000);

    return () => clearInterval(interval);
  }, [refreshToken]);

  useEffect(() => {
    const getCurrentSong = () => {
      if (accessToken) {
        fetch("https://api.spotify.com/v1/me/player/currently-playing", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }).then(resp => resp.json())
          .then(json => {
            setSongArtist(json["item"]["artists"].map(a => a["name"]).join(", "));
            setSongTitle(json["item"]["name"]);
          });
      }
    }
    getCurrentSong();
    const interval = setInterval(getCurrentSong, 5000);

    return () => clearInterval(interval);
  }, [accessToken]);

  useEffect(() => {
    const getTab = async () => {
      if (songArtist && songTitle) {
        const getBestTab = (results) => {
          let filtered_results = results.filter( r => !r["marketing_type"]);
          filtered_results.sort((a, b) => a["votes"] < b["votes"]);
          return filtered_results[0];
        }

        const cleanTab = tab => {
          return tab.replace(/\[\/?tab\]/g, "").replace(/\[\/?ch\]/g, "");
        }
        let strippedTitle = songTitle.replace(/\(feat.*\)/g, '');
        let search = encodeURI(`${songArtist} ${strippedTitle}`);
        let url = `https://www.ultimate-guitar.com/search.php?search_type=title&value=${search}`;
        const response = await fetch(`https://cors.bridged.cc/${url}`)
        const text = await response.text();
        const soup = new JSSoup(text);
        const results = soup.find("div", "js-store").attrs["data-content"];
        const resultsObj = JSON.parse(decodeHTML(results));
        if (resultsObj["store"]["page"]["data"]["results"].length === 0) {
          setTab("No tab, sorry :(");
          return;
        }
        const bestTab = getBestTab(resultsObj["store"]["page"]["data"]["results"]);
        const tabResponse = await fetch(`https://cors.bridged.cc/${bestTab["tab_url"]}`);
        const tabText = await tabResponse.text();
        const tabSoup = new JSSoup(tabText);
        const tabResults = tabSoup.find("div", "js-store").attrs["data-content"];
        const tabObj = JSON.parse(decodeHTML(tabResults));
        const tab = String(tabObj["store"]["page"]["data"]["tab_view"]["wiki_tab"]["content"]);
        const cleanedTab = cleanTab(tab);
        setTab(cleanedTab);
      }
    }
    getTab();
  }, [songArtist, songTitle])

  return (
      <div className="App">
      <h1 id="song-title">{songArtist} - {songTitle}</h1>
      <pre className="tab">{tab}</pre>
      </div>
  );
}

export default App;
