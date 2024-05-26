import { useState, useRef } from "react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
// import { toBlobURL, fetchFile } from "@ffmpeg/util";
import VideoPlayer from "./VideoPlayer";

function App() {
  const [loaded, setLoaded] = useState(false);
  const ffmpegRef = useRef(new FFmpeg());
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const messageRef = useRef<HTMLParagraphElement | null>(null)

  // const load = async () => {
  //   const baseURL = "https://unpkg.com/@ffmpeg/core-mt@0.12.6/dist/esm";
  //   const ffmpeg = ffmpegRef.current;
  //   ffmpeg.on("log", ({ message }) => {
  //     if (messageRef.current) messageRef.current.innerHTML = message;
  //   });
  //   // toBlobURL is used to bypass CORS issue, urls with the same
  //   // domain can be used directly.
  //   await ffmpeg.load({
  //     coreURL: await toBlobURL(`/plugin/ffmpeg-core.js`, "text/javascript"),
  //     wasmURL: await toBlobURL(
  //       `/plugin/ffmpeg-core.wasm`,
  //       "application/wasm"
  //     ),
  //     workerURL: await toBlobURL(
  //       `${baseURL}/ffmpeg-core.worker.js`,
  //       "text/javascript"
  //     ),
  //   });
  //   setLoaded(true);
  // };

  // const transcode = async () => {
  //   const videoURL = "/merge.mp4";
  //   const ffmpeg = ffmpegRef.current;
  //   await ffmpeg.writeFile("input.mp4", await fetchFile(videoURL));
  //   await ffmpeg.exec(["-i", "input.mp4", "-filter:v",`setpts=0.5*PTS`, "output.mp4"]);
  //   const fileData = await ffmpeg.readFile('output.mp4');
  //   const data = new Uint8Array(fileData as ArrayBuffer);
  //   if (videoRef.current) {
	// 		console.log('成功')
  //     videoRef.current.src = URL.createObjectURL(
  //       new Blob([data.buffer], { type: 'video/mp4' })
  //     )
  //   }
	// 	console.log('成功')
  // };

  return <> <VideoPlayer/></>
}

export default App;
