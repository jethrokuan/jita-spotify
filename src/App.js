import { useState, useEffect } from "react";
import { Line } from "rc-progress";
import JSSoup from "jssoup";

function App() {
  const [accessToken, setAccessToken] = useState();
  const [refreshToken, setRefreshToken] = useState();
  const [songArtist, setSongArtist] = useState();
  const [songTitle, setSongTitle] = useState();
  const [songProgress, setSongProgress] = useState();
  const [autoScroll, setAutoScroll] = useState(true);
  const [tab, setTab] = useState("");

  const decodeHTML = (html) => {
    var txt = document.createElement("textarea");
    txt.innerHTML = html;
    return txt.value;
  };

  useEffect(() => {
    const queryString = window.location.search;
    const urlParams = new URLSearchParams(queryString);
    const code = urlParams.get("code");

    if (
      window.localStorage.getItem("jita.access_token") &&
      window.localStorage.getItem("jita.refresh_token")
    ) {
      setAccessToken(window.localStorage.getItem("jita.access_token"));
      setRefreshToken(window.localStorage.getItem("jita.refresh_token"));
    } else if (code) {
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
    }
  }, []);

  useEffect(() => {
    const refreshTokenFn = () => {
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
            window.localStorage.setItem("jita.access_token", access_token);
            setAccessToken(access_token);
          });
      }
    };

    const interval = setInterval(refreshTokenFn, 36000);

    return () => clearInterval(interval);
  }, [refreshToken]);

  useEffect(() => {
    const getCurrentSong = () => {
      if (accessToken) {
        fetch("https://api.spotify.com/v1/me/player/currently-playing", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        })
          .then((resp) => resp.json())
          .then((json) => {
            const artist = json["item"]["artists"]
              .map((a) => a["name"])
              .join(", ");
            const title = json["item"]["name"];
            setSongArtist(artist);
            setSongTitle(title);
            setSongProgress({
              length: json["item"]["duration_ms"],
              progress: json["progress_ms"],
            });
          });
      }
    };
    getCurrentSong();
    const interval = setInterval(getCurrentSong, 5000);

    return () => clearInterval(interval);
  }, [accessToken]);

  useEffect(() => {
    const getTab = async () => {
      if (songArtist && songTitle) {
        const getBestTab = (results) => {
          let filtered_results = results.filter((r) => !r["marketing_type"]);
          filtered_results.sort((a, b) => a["votes"] < b["votes"]);
          return filtered_results[0];
        };

        const cleanTab = (tab) => {
          return tab.replace(/\[\/?tab\]/g, "").replace(/\[\/?ch\]/g, "");
        };
        let strippedTitle = songTitle
          .replace(/\(feat.*\)/g, "")
          .replace(/[!"#$%&()*+,-./:;<=>?@[\]^_`{|}~]/g, "");

        let search = encodeURI(`${songArtist.split(", ")[0]} ${strippedTitle}`);
        let url = `https://www.ultimate-guitar.com/search.php?search_type=title&value=${search}`;
        const response = await fetch(`https://cors.bridged.cc/${url}`);
        const text = await response.text();
        const soup = new JSSoup(text);
        const results = soup.find("div", "js-store").attrs["data-content"];
        const resultsObj = JSON.parse(decodeHTML(results));
        if (resultsObj["store"]["page"]["data"]["results"].length === 0) {
          setTab("No tab, sorry :(");
          return;
        }
        const bestTab = getBestTab(
          resultsObj["store"]["page"]["data"]["results"]
        );
        const tabResponse = await fetch(
          `https://cors.bridged.cc/${bestTab["tab_url"]}`
        );
        const tabText = await tabResponse.text();
        const tabSoup = new JSSoup(tabText);
        const tabResults = tabSoup.find("div", "js-store").attrs[
          "data-content"
        ];
        const tabObj = JSON.parse(decodeHTML(tabResults));
        const tab = String(
          tabObj["store"]["page"]["data"]["tab_view"]["wiki_tab"]["content"]
        );
        const cleanedTab = cleanTab(tab);
        setTab(cleanedTab);
      }
    };
    getTab();
  }, [songArtist, songTitle]);

  useEffect(() => {
    if (songProgress && autoScroll) {
      let height = Math.max(
        document.body.scrollHeight,
        document.body.offsetHeight,
        document.documentElement.clientHeight,
        document.documentElement.scrollHeight,
        document.documentElement.offsetHeight
      );

      window.scrollTo({
        top:
          Math.max(0, songProgress["progress"] / songProgress["length"] - 0.1) *
          height,
        left: 0,
        behaviour: "smooth",
      });
    }
  }, [songProgress, autoScroll]);
  return (
    <div className="container">
      {songArtist && songTitle && songProgress && (
        <section id="song-info">
          <div className="flex">
            <section id="song">
              <h1 id="song-title">{songTitle}</h1>
              <h2 id="song-artist">{songArtist}</h2>
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
                Made with ❤ by <a href="https://www.jethro.dev">Jethro Kuan</a>
              </p>
            </section>
          </div>

          <Line
            percent={(songProgress["progress"] / songProgress["length"]) * 100}
            strokeWidth="1"
            strokeColor="#C4DD85"
            trailColor="#D3D3D3"
          />
        </section>
      )}

      <pre className="tab">{tab}</pre>
    </div>
  );
}

export default App;
