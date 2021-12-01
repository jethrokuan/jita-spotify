import { useState, useEffect } from "react";
import { Line } from "rc-progress";

function App() {
  const [spotifyTokens, setSpotifyTokens] = useState({});
  const [song, setSong] = useState({});
  const [tabList, setTabList] = useState([]);
  const [tabIndex, setTabIndex] = useState(-1);
  const [tab, setTab] = useState({});
  const [autoScroll, setAutoScroll] = useState(true);


  useEffect(() => {
    const queryString = window.location.search;
    const urlParams = new URLSearchParams(queryString);
    const code = urlParams.get("code");

    if (code) {
      fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        body: new URLSearchParams({
          grant_type: "authorization_code",
          redirect_uri: process.env.REACT_APP_CALLBACK_URI,
          client_id: process.env.REACT_APP_SPOTIFY_CLIENT_ID,
          client_secret: process.env.REACT_APP_SPOTIFY_CLIENT_SECRET,
          code: code,
        }),
      })
        .then((resp) => resp.json())
        .then((json) => {
          const access_token = json["access_token"];
          const refresh_token = json["refresh_token"];
          setSpotifyTokens({
            access_token,
            refresh_token,
          });
        });
    } else {
      let clientId = process.env.REACT_APP_SPOTIFY_CLIENT_ID;
      let callbackUri = encodeURIComponent(process.env.REACT_APP_CALLBACK_URI);
      let url = `https://accounts.spotify.com/authorize?client_id=${clientId}&response_type=code&redirect_uri=${callbackUri}&scope=user-read-currently-playing
%20user-read-email`;
      window.location.replace(url);
    }
  }, []);

  const refreshAccessToken = (refreshToken) => {
    if (refreshToken) {
      fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: refreshToken,
          client_id: process.env.REACT_APP_SPOTIFY_CLIENT_ID,
          client_secret: process.env.REACT_APP_SPOTIFY_CLIENT_SECRET,
        }),
      })
        .then((resp) => resp.json())
        .then((json) => {
          const access_token = json["access_token"];
          setSpotifyTokens((orig) => {
            return {
              ...orig,
              access_token,
            };
          });
        });
    }
  };

  useEffect(() => {
    const interval = setInterval(
      () => refreshAccessToken(spotifyTokens.refresh_token),
      36000
    );
    return () => clearInterval(interval);
  }, [spotifyTokens.refresh_token]);

  useEffect(() => {
    const getCurrentSong = () => {
      if (spotifyTokens.access_token) {
        fetch("https://api.spotify.com/v1/me/player/currently-playing", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${spotifyTokens.access_token}`,
          },
        })
          .then((resp) => resp.json())
          .then((json) => {
            if (!json["item"]) {
              return;
            }
            const artist = json["item"]["artists"]
              .map((a) => a["name"])
              .join(", ");
            const title = json["item"]["name"];
            setSong({
              title,
              artist,
              song_length: json["item"]["duration_ms"],
              progress: json["progress_ms"],
            });
          });
      }
    };
    getCurrentSong();
    const interval = setInterval(getCurrentSong, 5000);

    return () => clearInterval(interval);
  }, [spotifyTokens.access_token]);

  useEffect(() => {
    const getTabs = async () => {
      if (song.artist && song.title) {
        const sortTabs = (results) => {
          return results.filter((r) => !r["marketing_type"]).sort((a, b) => a["votes"] < b["votes"]);
        };

        let strippedTitle = song.title
          .replace(/\(feat.*\)/g, "")
          .replace(/[!"#$%&()*+,-./:;<=>?@[\]^_`{|}~]/g, "");

        let query = `${song.artist.split(", ")[0]} ${strippedTitle}`;
        const response = await fetch(`${process.env.REACT_APP_API_URL}/search`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: query })
        });
        const tablist = await response.json();
        setTab({});
        setTabList(sortTabs(tablist));
        setTabIndex(0);
      }
    };
    getTabs();
  }, [song.artist, song.title]);

  useEffect(() => {
    if (song.progress && autoScroll) {
      let height = Math.max(
        document.body.scrollHeight,
        document.body.offsetHeight,
        document.documentElement.clientHeight,
        document.documentElement.scrollHeight,
        document.documentElement.offsetHeight
      );

      window.scrollTo({
        top: Math.max(0, song.progress / song.song_length - 0.1) * height,
        left: 0,
        behaviour: "smooth",
      });
    }
  }, [song.progress, song.song_length, autoScroll]);

  useEffect(() => {
    if (tabList && tabIndex !== -1) {
      const getTab = async () => {
        const tabUrl = tabList[tabIndex]["tab_url"];
        const response = await fetch(`${process.env.REACT_APP_API_URL}/tab`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: tabUrl })
        });
        const tab = await response.json();
        setTab(tab);
      }
      getTab();
    }
  }, [tabList, tabIndex]);

  return (
    <div>
      {song.title ? (
        <div className="whiteout">
          <section id="song-info">
            <div className="flex">
              <section id="song">
                <h1 id="song-title">{song.title}</h1>
                <h2 id="song-artist">{song.artist}</h2>
              </section>
              <section>
                <button
                  id="button-autoscroll"
                  className={"btn " + (autoScroll ? "on" : "")}
                  onClick={() => setAutoScroll((orig) => !orig)}
                >
                  Autoscroll: {autoScroll ? "On" : "Off"}
                </button>
                <p className="attribution">
                  Made with ❤ by{" "}
                  <a href="https://www.jethro.dev">Jethro Kuan</a>
                </p>
              </section>
            </div>
            <div className="flex" id="tabBar">
              {tabList.slice(0, 10).map((tab, i) => {
                return <button key={i} className="tabItem" onClick={() => setTabIndex(i)}>{i + 1}</button>
              })}
            </div>
            {tab.meta &&
              <div className="flex" id="tabMeta">
                {tab.meta.tuning && <div>Tuning: {tab.meta.tuning}</div>}
                {tab.meta.capo && <div>Capo: {tab.meta.capo}</div>}
                {tab.meta.key && <div>Key: {tab.meta.key}</div>}
                {tab.meta.difficulty && <div>Difficulty: {tab.meta.difficulty}</div>}
              </div>
            }
            <Line
              percent={(song.progress / song.song_length) * 100}
              strokeWidth="1"
              strokeColor="#C4DD85"
              trailColor="#D3D3D3"
            />
          </section>
        </div>
      ) : (
        <section>
          <h2 className="not-playing">Play a song on Spotify to begin!</h2>
          <p className="attribution">
            Made with ❤ by <a href="https://www.jethro.dev">Jethro Kuan</a>
          </p>
        </section>
      )}
      {tab &&
        <pre className="tab">{tab.tab}</pre>
      }
    </div>
  );
}

export default App;
