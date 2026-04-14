import { Card, Upload, Button, Space, Alert, Tag, message, Progress } from "antd";
import { UploadOutlined, DeleteOutlined } from "@ant-design/icons";
import useUpload from "@/hooks/useUpload";

const UploadDemo = () => {
  const { loading, fileList, onChange, onUploadBefore } = useUpload({
    filesMaxNum: 3,
    attachmentSize: 10,
    attachmentType: ".jpg,.png,.pdf,.doc,.docx",
    onHandleStart: (e) => {
      console.log("开始上传:", e.file.name);
    },
    onUploadEnd: (file, list, status) => {
      if (status === "error") {
        message.error(`${file.name} 上传失败`);
      } else if (status === "done") {
        message.success(`${file.name} 上传成功`);
      }
      console.log("文件列表:", list);
    },
  });

  return (
    <Card title="useUpload Demo" style={{ marginBottom: 16 }}>
      <Space direction="vertical" style={{ width: "100%" }}>
        <Space>
          <Tag color="blue">最大数量: 3</Tag>
          <Tag color="green">大小限制: 10MB</Tag>
          <Tag color="orange">类型: jpg, png, pdf, doc, docx</Tag>
          {loading && <Tag color="red">上传中...</Tag>}
        </Space>

        <Upload
          action="/api/upload"
          beforeUpload={onUploadBefore}
          onChange={onChange}
          fileList={fileList}
          multiple
        >
          <Button icon={<UploadOutlined />} loading={loading}>
            选择文件
          </Button>
        </Upload>

        {fileList.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <strong>已上传文件:</strong>
            <ul style={{ paddingLeft: 20 }}>
              {fileList.map((file) => (
                <li key={file.uid}>
                  <Space>
                    <span>{file.name}</span>
                    {file.percent && file.percent < 100 && (
                      <Progress percent={Math.round(file.percent)} size="small" style={{ width: 100 }} />
                    )}
                    {file.url && <Tag color="green">已完成</Tag>}
                  </Space>
                </li>
              ))}
            </ul>
          </div>
        )}

        <Alert
          type="info"
          message="上传功能示例，支持数量限制、大小校验、类型过滤"
        />
      </Space>
    </Card>
  );
};

export default UploadDemo;