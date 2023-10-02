import { Component } from "preact";
import {
  RealtimePostgresInsertPayload,
  RealtimePostgresUpdatePayload,
  SupabaseClient,
} from "@supabase/supabase-js";
import Peer from "peerjs";
import "boxicons";
import "./app.css";
import toast, { Toaster } from "react-hot-toast";
import { Mic, MicOff, SkipForward, X } from "lucide-preact";

class Call extends Component {
  peer: any;
  uid: string;
  username: string | undefined;
  profile_picture: string | undefined;
  degree: string | undefined;
  blockedUsers: string[] | undefined;
  localStream: MediaStream | null = null;
  remoteStream: MediaStream | null = null;
  remoteUserID: string | null = null;
  subscriptionInserts: any;
  subscriptionUpdates: any;
  subscriptionDeletes: any;
  counter = 60 * 6;
  remoteUsername: any;
  openSnackbar: any;
  closeSnackbar: any;
  supabase: SupabaseClient<any, "public", any>;
  state: {
    loading: boolean;
    muted: boolean;
    showSnackbar: boolean;
    snackProps?: {
      callF: {
        metadata: any;
        answer: (arg0: MediaStream) => void;
        peerConnection: { createDataChannel: (arg0: string) => any };
        on: (arg0: string, arg1: (stream: any) => void) => void;
      };
      username: string;
      profilePicture: string;
      degree: string;
    };
  };
  subscription: any;

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
            window.location.href = "/end";
          }}
        >
          Cancel
        </button>
      </div>
    );
  };

  cancel = async () => {
    if (this.uid) {
      console.log("deleting from lobby");
      const { error } = await this.supabase
        .from("lobby")
        .delete()
        .eq("uid", this.uid);
      console.log(error);
      this.subscriptionInserts?.unsubscribe();
      this.subscriptionUpdates?.unsubscribe();
      this.subscriptionDeletes?.unsubscribe();
    }
    if (this.peer) this.peer.destroy();
    if (this.localStream) this.localStream.getTracks().forEach((t) => t.stop());
    if (this.remoteStream)
      this.remoteStream.getTracks().forEach((t) => t.stop());
    const remoteVideo = document.getElementById(
      "remote-video"
    ) as HTMLVideoElement;
    if (remoteVideo) {
      remoteVideo.srcObject = null;
    }
  };

  onCallEnd = () => {
    this.remoteStream = null;
    this.remoteUserID = null;
    this.remoteUsername = null;
    const remoteVideo = document.getElementById(
      "remote-video"
    ) as HTMLVideoElement;
    if (remoteVideo) {
      remoteVideo.srcObject = null;
    }
    toast.error("Call ended", {
      duration: 5000,
      position: "top-center",
      id: "call-ended",
    });
    this.setState({ loading: true });
  };

  onRealtimeUpdateOrInsert = (
    payload:
      | RealtimePostgresInsertPayload<{ [key: string]: any }>
      | RealtimePostgresUpdatePayload<{ [key: string]: any }>
  ) => {
    console.log("onRealtimeUpdateOrInsert", payload);

    if (
      payload.new.peerID !== this.peer.id && // not own peerID
      payload.new.uid !== this.uid && // not own uid
      payload.new.available && // available
      this.localStream && // local stream
      !this.remoteStream && // not already in a call
      !this.blockedUsers?.includes(payload.new.uid) // not blocked
    ) {
      // call with uid so client B can get userInfo from supabase
      const call = this.peer.call(
        payload.new.peerID,
        this.localStream as MediaStream,
        {
          metadata: {
            uid: this.uid,
            username: this.username,
            degree: this.degree,
            profilePicture: this.profile_picture,
          },
        }
      );
      console.log("calling", payload.new.uid);
      this.remoteUserID = payload.new.uid;

      call.on("error", (err: any) => {
        console.log("call error", err);
        this.remoteStream = null;
        this.remoteUserID = null;
        this.remoteUsername = null;
        const remoteVideo = document.getElementById(
          "remote-video"
        ) as HTMLVideoElement;
        if (remoteVideo) {
          remoteVideo.srcObject = null;
        }
        toast.error("Call ended", {
          duration: 5000,
          position: "top-center",

          id: "call-ended",
        });
        this.setState({ loading: true });
      });

      call.on("stream", (stream: MediaStream | null) => {
        this.remoteStream = stream;
        const remoteVideo = document.getElementById(
          "remote-video"
        ) as HTMLVideoElement;
        if (remoteVideo) {
          remoteVideo.srcObject = stream;
        }

        // tell server you're in a call with remoteUserID

        toast.success("Found a partner!", {
          duration: 5000,
          position: "top-center",
          id: "match-found",
        });

        this.supabase
          .from("lobby")
          .update({
            available: false,
          })
          .eq("uid", this.uid);

        // fetch remote userInfo
        this.supabase
          .from("users")
          .select("username, degree")
          .eq("uid", this.remoteUserID)
          .then(({ data, error }) => {
            if (error) {
              console.log(error);
              return;
            } else if (data) {
              this.remoteUsername = data[0].username; // display this now
              document.getElementById("remote-username")!.innerHTML =
                this.remoteUsername;
              if (data[0].degree) {
                document.getElementById("remote-degree")!.innerHTML =
                  data[0].degree;
              }
            }
          });
        this.subscriptionInserts?.unsubscribe();
        this.subscriptionUpdates?.unsubscribe();
        this.subscriptionDeletes?.unsubscribe();

        this.setState({ loading: false });

        // add remoteUserID (user B) to recent_calls
        this.supabase
          .from("users")
          .select("recent_calls, recent_calls_show")
          .eq("uid", this.uid)
          .then(({ data, error }) => {
            if (!error) {
              data[0].recent_calls.push(this.remoteUserID);
              this.supabase
                .from("users")
                .update({ recent_calls: data[0].recent_calls })
                .eq("uid", this.uid);

              if (!data[0].recent_calls_show) {
                data[0].recent_calls_show = [this.remoteUserID];
              } else {
                data[0].recent_calls_show.push(this.remoteUserID);
              }
            } else {
              console.log(error);
            }
          });
      });
    } else if (payload.new.uid === this.remoteUserID && payload.new.available) {
      this.onCallEnd();
    } else if (payload.new.peerID === this.peer.id) {
      console.log("received own id, passing");
    } else if (this.remoteStream) {
      console.log("already in a call, passing");
    } else if (!this.localStream) {
      console.log("no local stream, passing");
    } else if (!payload.new.available) {
      console.log("not available, passing");
    } else if (this.blockedUsers?.includes(payload.new.uid)) {
      console.log("blocked user, passing");
    }
  };

  onRealtimeDelete = (payload: any) => {
    console.log("onRealtimeDelete", payload);
    // here if the remoteUserID is deleted, we need to end the call
    if (payload.old.uid === this.remoteUserID) {
      this.onCallEnd();
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
    return stream ? true : false;
  };

  constructor(props: any) {
    super(props);

    this.state = {
      loading: true,
      muted: false,
      showSnackbar: false,
    };

    const params = new URLSearchParams(window.location.search);
    this.uid = params.get("uid") as string;

    this.supabase = new SupabaseClient(
      "https://ucjolalmoughwxjvuxkn.supabase.co",
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjam9sYWxtb3VnaHd4anZ1eGtuIiwicm9sZSI6ImFub24iLCJpYXQiOjE2ODQ4MzgzMDUsImV4cCI6MjAwMDQxNDMwNX0.qguXR5AdVqU7qBRtlirHROPSoZ7XMaY824e2b7WcuNo" // fuck you ts
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
          this.degree = data[0].degree;
          this.profile_picture = data[0].profile_picture;
          this.blockedUsers = data[0].blocked ?? [];
          if (this.username) {
            this.peer = new Peer();

            this.peer.on("error", (err: any) => {
              console.log("peer error", err);
            });

            this.peer.on("open", (id: any) => {
              this.gatherLocalMedia().then((gotStream) => {
                if (!gotStream) {
                  console.log("no stream, passing");
                  return;
                }
                console.log("got local stream");
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
              });

              this.subscriptionInserts = this.supabase
                .channel(`inserts-${this.uid}`)
                .on(
                  "postgres_changes",
                  {
                    event: "INSERT",
                    schema: "public",
                    table: "lobby",
                  },
                  (payload) => {
                    console.log("subscriptionInserts", payload);
                    this.onRealtimeUpdateOrInsert(payload);
                  }
                );

              this.subscriptionUpdates = this.supabase
                .channel(`updates-${this.uid}`)
                .on(
                  "postgres_changes",
                  {
                    event: "UPDATE",
                    schema: "public",
                    table: "lobby",
                  },
                  (payload) => {
                    console.log("update: ", payload);
                    this.onRealtimeUpdateOrInsert(payload);
                  }
                );

              this.subscriptionDeletes = this.supabase
                .channel(`deletes-${this.uid}`)
                .on(
                  "postgres_changes",
                  {
                    event: "DELETE",
                    schema: "public",
                    table: "lobby",
                  },
                  (payload) => {
                    console.log("deleted", payload);
                    this.onRealtimeDelete(payload);
                  }
                )
                .subscribe();

              this.subscription = this.supabase
                .channel(`deletes-${this.uid}`)
                .on(
                  "postgres_changes",
                  {
                    event: "*",
                    schema: "public",
                    table: "lobby",
                  },
                  (payload) => {
                    if (payload.eventType === "DELETE") {
                      this.onRealtimeDelete(payload);
                    } else if (
                      payload.eventType === "INSERT" ||
                      payload.eventType === "UPDATE"
                    ) {
                      this.onRealtimeUpdateOrInsert(payload);
                    }
                  }
                );

              this.subscription.subscribe();
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
                this.setState({
                  showSnackbar: true,
                  snackProps: {
                    username: call.metadata.username,
                    profilePicture: call.metadata.profilePicture,
                    degree: call.metadata.degree,
                    callF: call,
                  },
                });
                console.log("call received");
              }
            );
          } else console.log("username not set, passing");
        }
      });
  }

  componentWillUnmount(): void {
    this.subscriptionInserts?.unsubscribe();
    this.subscriptionUpdates?.unsubscribe();
    this.subscriptionDeletes?.unsubscribe();
    this.supabase.from("lobby").delete().eq("uid", this.uid);
    this.peer.destroy();
  }

  endCallButton = () => {
    return (
      <button
        onClick={() => {
          this.cancel();
          window.location.href = "/end";
        }}
        style={{
          backgroundColor: "white",
          borderRadius: "25px",
        }}
      >
        <X color={"red"} size={25} />
      </button>
    );
  };

  SnackBar = ({
    username,
    profilePicture,
    degree,
    onClick,
  }: {
    username: string;
    profilePicture: string;
    degree: string;
    onClick: () => void;
  }) => {
    return (
      <div
        style={{
          // position: bottom center
          position: "absolute",
          bottom: "20px",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 999999,
          backgroundColor: "white",
          borderRadius: "25px",
          padding: "10px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          minWidth: "300px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            flexDirection: "row",
            gap: "25px",
          }}
        >
          <img
            src={profilePicture}
            alt="profile picture"
            style={{
              width: "50px",
              height: "50px",
              borderRadius: "50%",
            }}
          />
          <div
            style={{
              color: "#1e1e1e",
            }}
          >
            <h3>{username}</h3>
            <h4
              style={{
                fontSize: "0.8rem",
                fontWeight: "light",
              }}
            >
              {degree}
            </h4>
          </div>
        </div>
        <button
          onClick={() => {
            this.setState({ showSnackbar: false });
          }}
          style={{
            backgroundColor: "white",
            borderRadius: "25px",
            color: "black",
          }}
        >
          Skip
        </button>
        <button onClick={onClick}>Call</button>
      </div>
    );
  };

  render() {
    const acceptCall = (call: {
      metadata: any;
      answer: (arg0: MediaStream) => void;
      peerConnection: { createDataChannel: (arg0: string) => any };
      on: (arg0: string, arg1: (stream: any) => void) => void;
    }) => {
      if (this.localStream) {
        call.answer(this.localStream);
        this.remoteUserID = call.metadata.uid;
        console.log("answered call from", call.metadata.uid);

        call.on("close", () => {
          console.log("call closed");
          this.remoteStream = null;
          this.remoteUserID = null;
          this.remoteUsername = null;
          const remoteVideo = document.getElementById(
            "remote-video"
          ) as HTMLVideoElement;
          if (remoteVideo) {
            remoteVideo.srcObject = null;
          }
          toast.error("Call ended", {
            duration: 5000,
            position: "top-center",
            id: "call-ended",
          });
          this.setState({ loading: true });
        });

        call.on("error", (err: any) => {
          console.log("call error", err);
          this.remoteStream = null;
          this.remoteUserID = null;
          this.remoteUsername = null;
          const remoteVideo = document.getElementById(
            "remote-video"
          ) as HTMLVideoElement;
          if (remoteVideo) {
            remoteVideo.srcObject = null;
          }
          toast.error("Call ended", {
            duration: 5000,
            position: "top-center",

            id: "call-ended",
          });
          this.setState({ loading: true });
        });

        call.on("stream", (stream: MediaStream | null) => {
          this.setState({ loading: false });
          toast.success("Found a match!", {
            duration: 5000,
            position: "top-center",
            id: "match-found",
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
            .select("username, degree")
            .eq("uid", this.remoteUserID)
            .then(({ data, error }) => {
              if (error) {
                console.log(error);
                return;
              } else if (data) {
                this.remoteUsername = data[0].username; // display this now
                document.getElementById("remote-username")!.innerHTML =
                  this.remoteUsername;

                if (data[0].degree) {
                  document.getElementById("remote-degree")!.innerHTML =
                    data[0].degree;
                }

                // all of this is async so we can update the recent_calls array here too
                // this is client B stuff, so we need to update client A's recent_calls too ✅
                this.supabase
                  .from("users")
                  .select("recent_calls, recent_calls_show")
                  .eq("uid", this.uid)
                  .then(({ data, error }) => {
                    if (error) {
                      console.log(error);
                      return;
                    }
                    if (data) {
                      data[0].recent_calls.push(this.remoteUserID);

                      if (!data[0].recent_calls_show) {
                        data[0].recent_calls_show = [this.remoteUserID];
                      } else {
                        data[0].recent_calls_show.push(this.remoteUserID);
                      }
                      this.supabase
                        .from("users")
                        .update({
                          recent_calls: data[0].recent_calls,
                          recent_calls_show: data[0].recent_calls_show,
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
          this.subscriptionDeletes?.unsubscribe();
        });
      }
    };

    document.body.classList.add("no-scroll");

    return (
      <div id="container">
        <Toaster />
        <style>
          {`
        no-scroll {
          overflow: hidden;
        }`}
        </style>
        {!window.location.href.endsWith("end") && (
          <>
            {this.state.loading && (
              <div
                id="loading-container"
                style={{
                  display: "flex",
                }}
              >
                <this.Loading />
                {this.state.showSnackbar &&
                  this.state.snackProps &&
                  this.SnackBar({
                    username: this.state.snackProps?.username,
                    profilePicture: this.state.snackProps?.profilePicture,
                    degree: this.state.snackProps?.degree,
                    onClick: () => {
                      this.setState({ showSnackbar: false });
                      if (this.state.snackProps?.callF) {
                        acceptCall(this.state.snackProps?.callF);
                      }
                    },
                  })}
              </div>
            )}
            {!this.state.loading && (
              <div
                id="calling-container"
                style={{
                  display: "flex",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: "0",
                    right: "0",
                    zIndex: 1,
                    padding: "20px",
                  }}
                >
                  <h3
                    style={{
                      textAlign: "right",
                      color: "#1e1e1e",
                    }}
                    id="remote-username"
                  ></h3>
                  <h3
                    style={{
                      textAlign: "right",
                      color: "#1e1e1e",
                    }}
                    id="remote-degree"
                  ></h3>
                </div>
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

                      this.setState({ muted: !this.state.muted });
                    }}
                    class="icon-container"
                  >
                    {!this.state.muted && <Mic color={"black"} size={25} />}
                    {this.state.muted && <MicOff color="black" size={25} />}
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
                            console.log("skipped user");
                            toast("Skipping user...", {
                              duration: 2000,
                              icon: "⏭",
                              id: "skip-toast",
                              style: {
                                zIndex: 999999,
                                position: "absolute",
                                bottom: "20px",
                                left: "20px",
                              },
                            });
                            this.remoteStream = null;
                            this.remoteUserID = null;
                            this.remoteUsername = null;
                            const remoteVideo = document.getElementById(
                              "remote-video"
                            ) as HTMLVideoElement;
                            if (remoteVideo) {
                              remoteVideo.srcObject = null;
                            }
                            this.setState({ loading: true });
                          }
                        });
                    }}
                    className="icon-container"
                  >
                    <SkipForward color="blue" size={25} />
                  </button>
                  <this.endCallButton />
                </div>
              </div>
            )}
          </>
        )}
      </div>
    );
  }
}

export default Call;
