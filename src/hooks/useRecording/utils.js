export const SAMPLE_RATE = 16000;
export const CHUNK_SIZE = 256;

const ERROR_MESSAGES = {
  NotFoundError: "未检测到麦克风，请连接麦克风后重试",
  NotReadableError: "麦克风连接失败，请拔插 / 更换麦克风后重试",
  NotAllowedError:
    "浏览器需授权麦克风权限才能录音，请在弹窗或系统设置中点击允许麦克风权限后重试",
  AbortError: "麦克风被占用，请关闭其他应用后重试",
  NotSupportedError: "浏览器不支持录音，请更换 Chrome 浏览器后重试",
  TypeError: "浏览器不支持录音，请更换 Chrome 浏览器后重试",
};

/**
 * 检测麦克风是否可用
 * @returns {Promise<{status: boolean, message?: string}>}
 */
export const checkMicrophoneAvailability = async () => {
  const getUserMediaFunc = () => {
    if (navigator.mediaDevices?.getUserMedia) {
      return navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    }

    const legacyAPI =
      navigator.getUserMedia ||
      navigator.webkitGetUserMedia ||
      navigator.mozGetUserMedia;

    if (legacyAPI) {
      return (constraints) =>
        new Promise((resolve, reject) => {
          legacyAPI.call(navigator, constraints, resolve, reject);
        });
    }

    return null;
  };

  const getUserMedia = getUserMediaFunc();

  if (!getUserMedia) {
    return {
      status: false,
      message: "录音启动失败：浏览器不支持录音，请更换 Chrome 浏览器后重试",
    };
  }

  try {
    const stream = await getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    stream.getTracks().forEach((track) => {
      track.stop();
      track.enabled = false;
    });

    return { status: true };
  } catch (error) {
    const userMessage =
      ERROR_MESSAGES[error.name] || "请检查麦克风连接 / 权限";

    return {
      status: false,
      message: `录音启动失败：${userMessage}`,
    };
  }
};

/**
 * 将 Float32 音频数据转换为 16-bit PCM
 */
const float32ToInt16 = (floatData) => {
  const int16 = new Int16Array(floatData.length);
  for (let i = 0; i < floatData.length; i++) {
    const sample = Math.max(-1, Math.min(1, floatData[i]));
    int16[i] = sample < 0 ? sample * 32768 : sample * 32767;
  }
  return int16;
};

/**
 * 编码为 WAV 格式
 */
const encodeWAV = (samples, sampleRate = 16000, numChannels = 1) => {
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples.length * bytesPerSample;

  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset, string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  let index = 44;
  for (let i = 0; i < samples.length; i++) {
    view.setInt16(index, samples[i], true);
    index += 2;
  }

  return buffer;
};

/**
 * 合并音频片段并编码为 WAV
 */
export const mergeAudioChunksAndEncodeWAV = ({
  recordingBuffer,
  sampleRate,
}) => {
  const totalLength = recordingBuffer.reduce(
    (sum, chunk) => sum + chunk.length,
    0,
  );

  const mergedData = new Float32Array(totalLength);
  let offset = 0;
  for (const chunk of recordingBuffer) {
    mergedData.set(chunk, offset);
    offset += chunk.length;
  }

  const int16Array = float32ToInt16(mergedData);
  const wavFile = encodeWAV(int16Array, sampleRate);

  return {
    wavFile,
    audioContent: int16Array,
  };
};