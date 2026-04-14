export const HOOKS_CONFIG = [
  {
    key: "useAutoScrolled",
    label: "useAutoScrolled",
    icon: "VerticalAlignBottomOutlined",
    color: "cyan",
    description: "自动滚动 Hook，用于聊天等场景",
    api: `const { contentRef, setUserScrolled } = useAutoScrolled(changeData);

// 参数
//   changeData: any - 监听变化的数据

// 返回值
//   contentRef: RefObject - 绑定到滚动容器的 ref
//   setUserScrolled: (value: boolean) => void - 手动控制是否自动滚动`,
    codeExample: `import useAutoScrolled from '@/hooks/useAutoScrolled';

const MyComponent = () => {
  const [messages, setMessages] = useState([]);
  const { contentRef, setUserScrolled } = useAutoScrolled(messages);

  return (
    <div ref={contentRef} style={{ overflow: 'auto' }}>
      {messages.map(msg => <p key={msg.id}>{msg.text}</p>)}
    </div>
  );
};`,
  },
  {
    key: "usePreventClose",
    label: "usePreventClose",
    icon: "CloseCircleOutlined",
    color: "orange",
    description: "防止页面关闭 Hook",
    api: `usePreventClose(shouldPrevent, message);

// 参数
//   shouldPrevent: boolean - 是否阻止关闭
//   message: string - 提示消息 (可选，默认: '正在录音中，确定要离开吗？')`,
    codeExample: `import usePreventClose from '@/hooks/usePreventClose';

const MyComponent = () => {
  const [editing, setEditing] = useState(false);
  usePreventClose(editing, '正在编辑中，确定要离开吗？');

  return <div>...</div>;
};`,
  },
  {
    key: "useRecording",
    label: "useRecording",
    icon: "AudioOutlined",
    color: "red",
    description: "录音 Hook，提供录音状态管理",
    api: `const { status, loading, onChangeStatus, fileToTextLoading } = useRecording({
  onRecodingValueChange: ({ formData }) => { ... }
});

// 参数
//   onRecodingValueChange: (result: { formData }) => void - 录音结束回调

// 返回值
//   status: 'init' | 'start' | 'stop' - 当前状态
//   loading: boolean - 是否加载中
//   onChangeStatus: (value: 'start' | 'stop') => void - 状态切换
//   fileToTextLoading: boolean - 是否正在处理录音文件`,
    codeExample: `import useRecording from '@/hooks/useRecording';

const MyComponent = () => {
  const { status, onChangeStatus } = useRecording({
    onRecodingValueChange: ({ formData }) => {
      // formData 包含录音文件
      uploadAudio(formData);
    }
  });

  return (
    <Button onClick={() => onChangeStatus('start')}>
      {status === 'start' ? '停止' : '开始'}录音
    </Button>
  );
};`,
  },
  {
    key: "useLogic",
    label: "useLogic",
    icon: "ThunderboltOutlined",
    color: "purple",
    description: "快捷会议触发 Hook",
  },
  {
    key: "useUpload",
    label: "useUpload",
    icon: "UploadOutlined",
    color: "blue",
    description: "文件上传 Hook，支持数量/大小/类型限制",
    api: `const { loading, fileList, onChange, onUploadBefore } = useUpload({
  filesMaxNum: 1,
  attachmentSize: 10, // MB
  attachmentType: '.jpg,.png,.pdf',
  onUploadEnd: (file, list, status) => { ... },
  onHandleStart: (e) => { ... }
});

// 参数
//   filesMaxNum: number - 最大上传文件数量
//   attachmentSize: number - 单文件最大大小 (MB)
//   attachmentType: string - 允许的文件类型
//   onUploadEnd: function - 上传完成回调
//   onHandleStart: function - 上传开始回调

// 返回值
//   loading: boolean - 是否正在上传
//   fileList: array - 已上传文件列表
//   onChange: function - Upload.onChange 处理器
//   onUploadBefore: function - Upload.beforeUpload 处理器`,
    codeExample: `import useUpload from '@/hooks/useUpload';

const MyComponent = () => {
  const { loading, fileList, onChange, onUploadBefore } = useUpload({
    filesMaxNum: 3,
    attachmentSize: 10,
    attachmentType: '.jpg,.png,.pdf',
    onUploadEnd: (file, list) => {
      console.log('上传完成:', list);
    }
  });

  return (
    <Upload
      action="/api/upload"
      beforeUpload={onUploadBefore}
      onChange={onChange}
      fileList={fileList}
    >
      <Button loading={loading}>上传文件</Button>
    </Upload>
  );
};`,
  },
];