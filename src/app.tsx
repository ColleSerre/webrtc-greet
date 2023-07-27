import "./app.css";
import { Component } from "preact";
import Router from "preact-router";
import Call from "./call";
import EndOfCall from "./EndOfCall";

class App extends Component {
  render() {
    return (
      <Router>
        <Call path="/" />
        <EndOfCall path="/end" />
      </Router>
    );
  }
}

export default App;
