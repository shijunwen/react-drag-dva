import { Card, Button, Space, Alert, Tag, message } from "antd";
import { AudioOutlined, AudioMutedOutlined } from "@ant-design/icons";
import useRecording from "@/hooks/useRecording";

const RecordingDemo = () => {
  const { status, loading, onChangeStatus, fileToTextLoading } = useRecording({
    onRecodingValueChange: ({ formData }) => {
      message.success("录音完成，formData 已生成");
      console.log("formData:", formData);
    },
  });

  const isRecording = status === "start";

  return (
    <Card title="useRecording Demo" style={{ marginBottom: 16 }}>
      <Space direction="vertical" style={{ width: "100%" }}>
        <Space>
          <Tag
            color={
              status === "start" ? "red" : status === "stop" ? "green" : "blue"
            }
          >
            状态: {status}
          </Tag>
          {loading && <Tag color="orange">加载中...</Tag>}
          {fileToTextLoading && <Tag color="purple">处理中...</Tag>}
        </Space>

        <Button
          type={isRecording ? "default" : "primary"}
          danger={isRecording}
          icon={isRecording ? <AudioMutedOutlined /> : <AudioOutlined />}
          loading={loading}
          onClick={() =>
            onChangeStatus(isRecording ? "stop" : "start", (result) => {
              if (result.status) {
                message.success(result.message);
              } else {
                message.error(result.message);
              }
            })
          }
        >
          {isRecording ? "停止录音" : "开始录音"}
        </Button>

        <Alert
          type="info"
          message="点击按钮开始/停止录音，需要浏览器麦克风权限"
        />
      </Space>
    </Card>
  );
};

export default RecordingDemo;
