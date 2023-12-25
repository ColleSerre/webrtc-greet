import "./app.css";
import { Component } from "preact";
import EndOfCall from "./EndOfCall";

import { BrowserRouter, Routes, Route } from "react-router-dom";
import Call from "./call";
import Icebreaker from "./Icebreakers";

class App extends Component {
  render() {
    return (
      <BrowserRouter>
        <Routes>
          <Route index element={<Call />} />
          <Route path="/end" element={<EndOfCall />} />
          <Route
            path="/test"
            element={
              <Icebreaker
                onTimerComplete={() => {
                  console.log("Show video now");
                }}
                duration={10000}
                header="F**k Marry Kill"
                options={["Zendaya", "Jennifer Lawrence", "Margot Robbie"]}
                selectedAnswerCallback={(answer) => {
                  console.log("Selected answer", answer);
                }}
              />
            }
          />
        </Routes>
      </BrowserRouter>
    );
  }
}

export default App;
