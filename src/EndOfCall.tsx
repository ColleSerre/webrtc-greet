import { Component } from "preact";
import "./app.css";

class EndOfCall extends Component {
  constructor(props: any) {
    super(props);
  }
  render() {
    return (
      <div
        id="end-of-call"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <p>Call ended</p>
      </div>
    );
  }
}

export default EndOfCall;
