import { Component } from "preact";
import {
  RealtimePostgresInsertPayload,
  RealtimePostgresUpdatePayload,
  SupabaseClient,
} from "@supabase/supabase-js";
import Peer from "peerjs";
import "boxicons";
import "./app.css";

class Call extends Component {
  peer: any;
  uid: string;
  profile_picture: string | undefined;
  username: string | undefined;
  socials: {} | undefined;
  anecdote: string | undefined;
  localStream: MediaStream | null = null;
  remoteStream: MediaStream | null = null;
  supabase: SupabaseClient<any, "public", any>;
  subscriptionInserts: any;
  subscriptionUpdates: any;
  counter = 60 * 6;

  onRealtimeUpdateOrInsert = (
    payload:
      | RealtimePostgresInsertPayload<{ [key: string]: any }>
      | RealtimePostgresUpdatePayload<{ [key: string]: any }>
  ) => {
    if (
      payload.new.peerID !== this.peer.id && // not own id
      payload.new.uid !== this.uid && // not own uid
      payload.new.available && // available
      this.localStream && // local stream
      !this.remoteStream // not already in a call
    ) {
      const call = this.peer.call(
        payload.new.peerID,
        this.localStream as MediaStream
      );
      console.log("calling", payload.new.uid);

      call.on("stream", (stream: MediaStream | null) => {
        this.remoteStream = stream;
        const remoteVideo = document.getElementById(
          "remote-video"
        ) as HTMLVideoElement;
        remoteVideo.srcObject = stream;
        remoteVideo.play();
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
      video: {
        width: 150,
        height: 200,
      },
      audio: true,
    });
    this.localStream = stream;
    const localVideo = document.getElementById(
      "local-video"
    ) as HTMLVideoElement;
    localVideo.srcObject = stream;
    localVideo.play();
    localVideo.style.display = "block";
  };

  constructor(props: {} | undefined) {
    super(props);
    this.supabase = new SupabaseClient(
      "https://ucjolalmoughwxjvuxkn.supabase.co",
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjam9sYWxtb3VnaHd4anZ1eGtuIiwicm9sZSI6ImFub24iLCJpYXQiOjE2ODQ4MzgzMDUsImV4cCI6MjAwMDQxNDMwNX0.qguXR5AdVqU7qBRtlirHROPSoZ7XMaY824e2b7WcuNo"
    );

    // get uid from url
    const urlParams = new URLSearchParams(window.location.search);
    this.uid = urlParams.get("uid") as string;

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
          this.profile_picture = data[0].profile_picture;
          this.socials = data[0].socials;
          this.anecdote = data[0].anecdote;
          if (this.username && this.socials) {
            this.peer = new Peer();

            this.peer.on("open", (id: any) => {
              this.gatherLocalMedia();
              if (!this.username || !this.socials) {
                console.log(this.username, this.socials);
                console.log("username or socials not set, passing");
                return;
              }

              this.supabase
                .from("lobby")
                .insert([
                  {
                    uid: this.uid,
                    peerID: id,
                    username: this.username,
                    profile_picture: this.profile_picture,
                    socials: this.socials,
                    anecdote: this.anecdote,
                  },
                ])
                .then(({ data, error }) => {
                  if (error) {
                    console.log(error);
                    return;
                  } else if (data) {
                    console.log("inserted into lobby");
                  }
                });

              this.subscriptionInserts = this.supabase
                .channel("lobby-changes")
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
                .channel("lobby-changes")
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

            this.peer.on(
              "call",
              (call: {
                answer: (arg0: MediaStream) => void;
                peerConnection: { createDataChannel: (arg0: string) => any };
                on: (arg0: string, arg1: (stream: any) => void) => void;
              }) => {
                console.log("call received");
                if (this.localStream) {
                  call.answer(this.localStream);
                  call.on("stream", (stream: MediaStream | null) => {
                    this.supabase
                      .from("lobby")
                      .update({
                        available: false,
                      })
                      .eq("uid", this.uid);

                    this.remoteStream = stream;
                    const remoteVideo = document.getElementById(
                      "remote-video"
                    ) as HTMLVideoElement;
                    remoteVideo.srcObject = stream;
                    remoteVideo.play();
                    remoteVideo.style.display = "block";
                  });
                }
              }
            );
          }
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

        <video
          muted
          id={"local-video"}
          playsInline={true}
          autoPlay={true}
          controls={false}
          preload="auto"
          type="video/mp4"
        />
        <video
          id="remote-video"
          playsInline
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
              // set as available
              this.supabase
                .from("lobby")
                .update({ available: true })
                .eq("uid", this.uid);
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
              // close peer, delete lobby entry, and navigate to /end
              this.peer.destroy();
              this.supabase.from("lobby").delete().match({ id: this.peer.id });
            }}
            class="icon-container"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="25"
              height="25"
              viewBox="0 0 24 24"
              style="fill: red;transform: ;msFilter:;"
            >
              <path d="M21 5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5zm-4.793 9.793-1.414 1.414L12 13.414l-2.793 2.793-1.414-1.414L10.586 12 7.793 9.207l1.414-1.414L12 10.586l2.793-2.793 1.414 1.414L13.414 12l2.793 2.793z"></path>
            </svg>
          </button>
        </div>
      </div>
    );
  }
}

export default Call;
