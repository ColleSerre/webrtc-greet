import "./app.css";
import { Component } from "preact";
import EndOfCall from "./EndOfCall";

import { BrowserRouter, Routes, Route } from "react-router-dom";
import Call from "./call";

class App extends Component {
  render() {
    return (
      <BrowserRouter>
        <Routes>
          <Route index element={<Call />} />
          <Route path="/end" element={<EndOfCall />} />
        </Routes>
      </BrowserRouter>
    );
  }
}

export default App;
