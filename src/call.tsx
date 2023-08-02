import { Component } from "preact";
import {
  RealtimePostgresInsertPayload,
  RealtimePostgresUpdatePayload,
  SupabaseClient,
} from "@supabase/supabase-js";
import Peer from "peerjs";
import "boxicons";
import "./app.css";
import { Link } from "react-router-dom";
import toast, { Toaster } from "react-hot-toast";

class Call extends Component {
  peer: any;
  uid: string;
  username: string | undefined;
  anecdote: string | undefined;
  localStream: MediaStream | null = null;
  remoteStream: MediaStream | null = null;
  remoteUserID: string | null = null;
  supabase: SupabaseClient<any, "public", any>;
  subscriptionInserts: any;
  subscriptionUpdates: any;
  counter = 60 * 6;
  remoteUsername: any;
  openSnackbar: any;
  closeSnackbar: any;
  state: {
    loading: boolean;
  };

  Loading = () => {
    const funny_sentences = [
      "Finding a partner...",
      "Looking for someone to talk to...",
      "Finding a friend...",
      "Finding a stranger...",
      "Finding a partner...",
    ];

    return (
      <div className="loading">
        <h1 id="loading-text">
          {funny_sentences[Math.floor(Math.random() * funny_sentences.length)]}
        </h1>

        <button
          onClick={() => {
            this.cancel();
          }}
        >
          <Link to="/end" id="cancel">
            Cancel
          </Link>
        </button>
      </div>
    );
  };

  cancel = () => {
    if (this.uid) {
      this.supabase.from("lobby").delete().eq("uid", this.uid);
      this.subscriptionInserts?.unsubscribe();
      this.subscriptionUpdates?.unsubscribe();
    }
    if (this.peer) this.peer.destroy();
    if (this.localStream) this.localStream.getTracks().forEach((t) => t.stop());
    if (this.remoteStream)
      this.remoteStream.getTracks().forEach((t) => t.stop());
  };

  onRealtimeUpdateOrInsert = (
    payload:
      | RealtimePostgresInsertPayload<{ [key: string]: any }>
      | RealtimePostgresUpdatePayload<{ [key: string]: any }>
  ) => {
    console.log("onRealtimeUpdateOrInsert", payload);

    if (
      payload.new.peerID !== this.peer.id && // not own id
      payload.new.uid !== this.uid && // not own uid
      payload.new.available && // available
      this.localStream && // local stream
      !this.remoteStream // not already in a call
    ) {
      // call with uid so client B can get userInfo from supabase
      const call = this.peer.call(
        payload.new.peerID,
        this.localStream as MediaStream,
        {
          metadata: {
            uid: this.uid,
          },
        }
      );
      console.log("calling", payload.new.uid);
      this.remoteUserID = payload.new.uid;

      call.on("stream", (stream: MediaStream | null) => {
        this.remoteStream = stream;
        const remoteVideo = document.getElementById(
          "remote-video"
        ) as HTMLVideoElement;
        if (remoteVideo) {
          remoteVideo.srcObject = stream;
        }
        toast.success("Found a partner!");
        this.setState({ loading: false });
        // add remoteUserID (user B) to recent_calls
        this.supabase
          .from("users")
          .select("recent_calls")
          .eq("uid", this.uid)
          .then(({ data, error }) => {
            if (!error) {
              data[0].recent_calls.push(this.remoteUserID);
              this.supabase
                .from("users")
                .update({ recent_calls: data[0].recent_calls })
                .eq("uid", this.uid);
            } else {
              console.log(error);
            }
          });
      });
    } else if (payload.new.peerID === this.peer.id) {
      console.log("received own id, passing");
    } else if (this.remoteStream) {
      console.log("already in a call, passing");
    } else if (!this.localStream) {
      console.log("no local stream, passing");
    }
  };

  gatherLocalMedia = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    this.localStream = stream;
    const localVideo = document.getElementById(
      "local-video"
    ) as HTMLVideoElement;
    if (localVideo) {
      localVideo.srcObject = stream;
    }
  };

  constructor(props: any) {
    super(props);

    this.state = {
      loading: true,
    };

    const params = new URLSearchParams(window.location.search);
    this.uid = params.get("uid") as string;
    this.supabase = new SupabaseClient(
      "https://ucjolalmoughwxjvuxkn.supabase.co",
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjam9sYWxtb3VnaHd4anZ1eGtuIiwicm9sZSI6ImFub24iLCJpYXQiOjE2ODQ4MzgzMDUsImV4cCI6MjAwMDQxNDMwNX0.qguXR5AdVqU7qBRtlirHROPSoZ7XMaY824e2b7WcuNo"
    );

    if (!this.uid) {
      console.log("uid not set, passing");
      return;
    }

    this.supabase
      .from("users")
      .select("*")
      .eq("uid", this.uid)
      .then(({ data, error }) => {
        if (error) {
          console.log(error);
          return;
        } else if (data) {
          this.username = data[0].username;
          if (this.username) {
            this.peer = new Peer();

            this.peer.on("open", (id: any) => {
              this.gatherLocalMedia();
              this.supabase
                .from("lobby")
                .insert([
                  {
                    uid: this.uid,
                    peerID: id,
                    available: true,
                  },
                ])
                .then(({ error }) => {
                  if (error) {
                    if (error.code === "23505") {
                      console.log("already in lobby, updating peerID");
                      this.supabase
                        .from("lobby")
                        .update({ peerID: id, available: true })
                        .eq("uid", this.uid)
                        .then(({ error }) => {
                          if (error) {
                            console.log(error);
                            return;
                          } else {
                            console.log("updated lobby");
                          }
                        });
                    } else console.log(error);
                    return;
                  } else {
                    console.log("inserted into lobby");
                  }
                });

              this.subscriptionInserts = this.supabase
                .channel("lobby-changes-1")
                .on(
                  "postgres_changes",
                  {
                    event: "INSERT",
                    schema: "public",
                    table: "lobby",
                  },
                  (payload) => this.onRealtimeUpdateOrInsert(payload)
                );

              this.subscriptionUpdates = this.supabase
                .channel("lobby-changes-1")
                .on(
                  "postgres_changes",
                  {
                    event: "UPDATE",
                    schema: "public",
                    table: "lobby",
                  },
                  (payload) => this.onRealtimeUpdateOrInsert(payload)
                );

              this.subscriptionInserts.subscribe();
              this.subscriptionUpdates.subscribe();
              console.log("subscriptionInserts started");
            });

            // receive metadata from client A and retrieve userInfo from supabase
            this.peer.on(
              "call",
              (call: {
                metadata: any;
                answer: (arg0: MediaStream) => void;
                peerConnection: { createDataChannel: (arg0: string) => any };
                on: (arg0: string, arg1: (stream: any) => void) => void;
              }) => {
                console.log("call received");
                if (this.localStream) {
                  call.answer(this.localStream);
                  this.remoteUserID = call.metadata.uid;
                  console.log("answered call from", call.metadata.uid);
                  call.on("stream", (stream: MediaStream | null) => {
                    this.setState({ loading: false });
                    toast.success("Found a match!", {
                      position: "top-center",
                    });
                    // just checking...
                    this.remoteUserID = call.metadata.uid;
                    this.supabase
                      .from("lobby")
                      .update({
                        available: false,
                      })
                      .eq("uid", this.uid);

                    // fetch remote userInfo
                    this.supabase
                      .from("users")
                      .select("username")
                      .eq("uid", this.remoteUserID)
                      .then(({ data, error }) => {
                        if (error) {
                          console.log(error);
                          return;
                        } else if (data) {
                          this.remoteUsername = data[0].username; // display this now
                          console.log("my username", this.username);
                          console.log("remote username", this.remoteUsername);
                          // all of this is async so we can update the recent_calls array here too
                          // this is client B stuff, so we need to update client A's recent_calls too ✅
                          this.supabase
                            .from("users")
                            .select("recent_calls")
                            .eq("uid", this.uid)
                            .then(({ data, error }) => {
                              if (error) {
                                console.log(error);
                                return;
                              }
                              if (data) {
                                data[0].recent_calls.push(this.remoteUserID);
                                this.supabase
                                  .from("users")
                                  .update({
                                    recent_calls: data[0].recent_calls,
                                  })
                                  .eq("uid", this.uid)
                                  .then(({ error }) => {
                                    if (error) {
                                      console.log(error);
                                      return;
                                    } else {
                                      console.log("updated recent_calls");
                                    }
                                  });
                              }
                            });
                        }
                      });
                    this.remoteStream = stream;
                    const remoteVideo = document.getElementById(
                      "remote-video"
                    ) as HTMLVideoElement;
                    if (remoteVideo) {
                      remoteVideo.srcObject = stream;
                    }
                    this.subscriptionInserts?.unsubscribe();
                    this.subscriptionUpdates?.unsubscribe();
                  });
                }
              }
            );
          } else console.log("username not set, passing");
        }
      });
  }

  componentWillUnmount(): void {
    this.subscriptionInserts?.unsubscribe();
    this.subscriptionUpdates?.unsubscribe();
    this.supabase.from("lobby").delete().match({ id: this.peer.id });
    this.peer.destroy();
  }

  render() {
    document.body.classList.add("no-scroll");
    return (
      <div id="container">
        <style>
          {`
        no-scroll {
          overflow: hidden;
        }`}
        </style>
        {!window.location.href.endsWith("end") && (
          <>
            <div
              id="loading-container"
              style={{
                display: this.state.loading ? "flex" : "none",
              }}
            >
              <this.Loading />
            </div>

            <div
              id="calling-container"
              style={{
                display: !this.state.loading ? "flex" : "none",
              }}
            >
              <h2
                style={{
                  position: "absolute",
                  top: "0",
                  left: "0",
                  color: "white",
                  zIndex: 1,
                }}
              >
                {this.remoteUsername}
              </h2>
              <video
                id="remote-video"
                playsInline
                autoPlay={true}
                controls={false}
                preload="auto"
                type="video/mp4"
              />
              <video
                muted
                id={"local-video"}
                playsInline={true}
                autoPlay={true}
                controls={false}
                preload="auto"
                type="video/mp4"
              />
              <div id="button-tab">
                <button
                  onClick={() => {
                    // mute local stream
                    this.localStream?.getAudioTracks().forEach((track) => {
                      track.enabled = !track.enabled;
                    });
                  }}
                  class="icon-container"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="25"
                    height="25"
                    viewBox="0 0 24 24"
                    style="fill: rgba(65, 84, 249, 1);transform: ;msFilter:;"
                  >
                    <path d="M12 16c2.206 0 4-1.794 4-4V6c0-2.217-1.785-4.021-3.979-4.021a.933.933 0 0 0-.209.025A4.006 4.006 0 0 0 8 6v6c0 2.206 1.794 4 4 4z"></path>
                    <path d="M11 19.931V22h2v-2.069c3.939-.495 7-3.858 7-7.931h-2c0 3.309-2.691 6-6 6s-6-2.691-6-6H4c0 4.072 3.061 7.436 7 7.931z"></path>
                  </svg>
                </button>
                <button
                  onClick={() => {
                    this.supabase
                      .from("lobby")
                      .update({ available: true })
                      .eq("uid", this.uid)
                      .then(({ error }) => {
                        if (error) {
                          console.log(error);
                          return;
                        } else {
                          this.remoteStream = null;
                          this.remoteUserID = null;
                          this.remoteUsername = null;
                          this.setState({ loading: true });
                          toast("Skipping user...", {
                            duration: 2000,
                            icon: "⏭",
                            style: {
                              zIndex: 999999,
                              position: "absolute",
                              bottom: "20px",
                              left: "20px",
                            },
                          });
                        }
                      });
                  }}
                  className="icon-container"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="25"
                    height="25"
                    viewBox="0 0 24 24"
                    style="fill: rgba(65, 84, 249, 1);transform: ;msFilter:;"
                  >
                    <path d="M12 2C6.486 2 2 6.486 2 12s4.486 10 10 10 10-4.486 10-10S17.514 2 12 2zm0 18c-4.411 0-8-3.589-8-8s3.589-8 8-8 8 3.589 8 8-3.589 8-8 8z"></path>
                    <path d="m8 16 5-4-5-4zm5-4v4h2V8h-2z"></path>
                  </svg>
                </button>
                <button
                  onClick={() => {
                    toast("Call ended", {
                      position: "top-center",
                      duration: 2000,
                      icon: "👋",
                    });
                    this.cancel();
                  }}
                  class="icon-container"
                >
                  <Link to="/end">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="25"
                      height="25"
                      viewBox="0 0 24 24"
                      style="fill: red;transform: ;msFilter:;"
                    >
                      <path d="M21 5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5zm-4.793 9.793-1.414 1.414L12 13.414l-2.793 2.793-1.414-1.414L10.586 12 7.793 9.207l1.414-1.414L12 10.586l2.793-2.793 1.414 1.414L13.414 12l2.793 2.793z"></path>
                    </svg>
                  </Link>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }
}

export default Call;
