import { useMemoizedFn } from "ahooks";
import { useState, useRef, useCallback } from "react";
import {
  checkMicrophoneAvailability,
  CHUNK_SIZE,
  mergeAudioChunksAndEncodeWAV,
  SAMPLE_RATE,
} from "./utils";

const useRecording = ({ onRecodingValueChange }) => {
  const [status, setStatus] = useState("init");
  const [loading, setLoading] = useState(false);
  const [fileToTextLoading, setFileToTextLoading] = useState(false);

  const audioContextRef = useRef(null);

  const cleanupAudioContext = useCallback(async (ctx) => {
    if (!ctx) return;

    if (ctx.audioProcessor) {
      ctx.audioProcessor.disconnect();
      ctx.audioProcessor = null;
    }

    if (ctx.audioSource) {
      ctx.audioSource.disconnect();
      ctx.audioSource = null;
    }

    if (ctx.audioStream) {
      ctx.audioStream.getTracks().forEach((track) => track.stop());
      ctx.audioStream = null;
    }

    ctx.isRecording = false;

    if (Array.isArray(ctx.recordingBuffer)) {
      ctx.recordingBuffer = [];
    }

    if (ctx.state !== "closed" && ctx.close) {
      try {
        await ctx.close();
      } catch {
        // 忽略关闭错误
      }
    }
  }, []);

  const stopRecognition = useMemoizedFn(async () => {
    setStatus("stop");
    setLoading(false);
    setFileToTextLoading(false);

    await cleanupAudioContext(audioContextRef.current);
    audioContextRef.current = null;
  });

  const startRecording = useMemoizedFn(async (callback) => {
    const result = await checkMicrophoneAvailability();
    if (!result.status) {
      stopRecognition();
      if (callback) {
        callback({ message: result.message, status: false });
      }
      return { message: result.message, status: false };
    }

    try {
      setStatus("start");
      setLoading(false);

      // @ts-ignore - webkitAudioContext 为 Safari 兼容属性
      const AudioContextClass =
        window.AudioContext || window.webkitAudioContext;
      const audioContext = new AudioContextClass({
        sampleRate: SAMPLE_RATE,
      });

      audioContext.recordingBuffer = [];

      audioContext.audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: SAMPLE_RATE,
          channelCount: 1,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });

      audioContext.audioSource = audioContext.createMediaStreamSource(
        audioContext.audioStream,
      );

      // 注意: createScriptProcessor 已弃用，但为兼容性暂时保留
      audioContext.audioProcessor = audioContext.createScriptProcessor(
        CHUNK_SIZE,
        1,
        1,
      );

      audioContext.audioProcessor.onaudioprocess = (event) => {
        if (!audioContext || !audioContext.isRecording) return;

        const inputData = event.inputBuffer.getChannelData(0);
        const audioChunk = new Float32Array(inputData);

        if (!Array.isArray(audioContext.recordingBuffer)) {
          audioContext.recordingBuffer = [];
        }
        audioContext.recordingBuffer.push(audioChunk);
      };

      audioContext.audioSource.connect(audioContext.audioProcessor);
      audioContext.audioProcessor.connect(audioContext.destination);

      audioContext.isRecording = true;
      audioContext.textContent = "正在监听语音...";

      audioContextRef.current = audioContext;
      if (callback) {
        callback({ message: "录音开始", status: true });
      }
      return { message: "录音开始", status: true };
    } catch (error) {
      stopRecognition();
      if (callback) {
        callback({ message: error.message || "录音启动失败", status: false });
      }
      return { message: error || "录音启动失败", status: false };
    }
  });

  const onRecordingEnds = useMemoizedFn(async () => {
    setFileToTextLoading(true);

    const ctx = audioContextRef.current;
    const { wavFile } = mergeAudioChunksAndEncodeWAV({
      recordingBuffer: ctx?.recordingBuffer || [],
      sampleRate: ctx?.sampleRate || SAMPLE_RATE,
    });

    const formData = new FormData();
    formData.append(
      "file",
      new Blob([wavFile], { type: "audio/wav" }),
      "recording.wav",
    );

    onRecodingValueChange({ formData });
    stopRecognition();
  });

  const onChangeStatus = useMemoizedFn((value, callback) => {
    if (status === "loading" || loading) return;

    if (value === "start") {
      setLoading(true);
      startRecording(callback);
      return;
    }

    onRecordingEnds();
  });

  return { status, loading, onChangeStatus, fileToTextLoading };
};

export default useRecording;
