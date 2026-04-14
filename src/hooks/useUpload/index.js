import { beforeUploadFileCheckType } from "./utils";
import { message, Upload } from "antd";
import { useState, useMemo } from "react";

const useUpload = ({
  filesMaxNum = 1,
  attachmentSize,
  attachmentType,
  onUploadEnd,
  onHandleStart,
}) => {
  const [fileList, setFileList] = useState([]);

  const onUploadBefore = (file, selectedFiles = []) => {
    // 剩余可上传数量
    if (filesMaxNum) {
      const remaining = filesMaxNum - fileList.length;
      if (remaining <= 0) {
        message.error(`最多只能上传 ${filesMaxNum} 个文件`);
        return Upload.LIST_IGNORE;
      }

      // selectedFiles 表示本次选择的文件数组，按顺序判断是否属于可上传范围
      const idx = selectedFiles.findIndex(
        (f) =>
          f.uid === file.uid || (f.name === file.name && f.size === file.size),
      );

      // 如果找到了索引，且当前文件的索引超出可上传范围，则忽略
      if (idx >= 0 && idx >= remaining) {
        message.error(
          `超过最大上传数，已自动忽略多余文件（最多 ${filesMaxNum} 个）`,
        );
        return Upload.LIST_IGNORE;
      }

      // 如果 selectedFiles 没有传入（兼容场景），则使用单个判断：若添加该文件会超出限制则拒绝
      if (idx === -1 && fileList.length + 1 > filesMaxNum) {
        message.error(`最多只能上传 ${filesMaxNum} 个文件`);
        return Upload.LIST_IGNORE;
      }
    }

    const isAllowedType = attachmentType
      ? beforeUploadFileCheckType(file, attachmentType)
      : true;

    const isAllowedSize = attachmentSize
      ? file.size / 1024 / 1024 < attachmentSize
      : true;

    if (!isAllowedType) {
      message.error(`仅支持 ${attachmentType} 格式`);
      return Upload.LIST_IGNORE;
    }
    if (!isAllowedSize) {
      message.error(`单个文件大小不能超过 ${attachmentSize} MB`);
      return Upload.LIST_IGNORE;
    }
    return true;
  };

  const onChange = async (e) => {
    const { file } = e;
    const { status, response, name, uid } = file;
    if (onHandleStart) {
      onHandleStart(e);
    }
    if (status === "uploading") {
      const percent = file.percent || 1;
      setFileList((prevState) => {
        const _file = prevState.find((x) => x.uid === uid);
        if (_file) {
          _file.percent = percent;
          const list = [...prevState];
          return list;
        } else {
          const list = [...prevState, { name, uid, percent: percent }];
          return list;
        }
      });
    } else if (status === "done") {
      const { result = [] } = response;
      const currentResult = Array.isArray(result) ? result[0] : result;
      const { previewUrl, url, fileId, time } = currentResult || {};
      setFileList((prevState) => {
        const _file = prevState.find((x) => x.uid === uid);
        delete _file.percent;
        _file.url = url;
        _file.previewUrl = previewUrl;
        _file.fileId = fileId;
        _file.time = time;
        _file.type = 2;
        const fileInformation = [];
        prevState.forEach((i) => {
          const obj = {};
          obj.url = i.url;
          obj.name = i.name;
          obj.preview_url = i.previewUrl;
          obj.fileId = i.fileId;
          obj.time = time;
          fileInformation.push(obj);
        });
        const list = [...prevState];
        if (onUploadEnd) {
          onUploadEnd(_file, list);
        }
        return list;
      });
    } else if (status === "error") {
      setFileList((prevState) => {
        const newFileList = prevState.filter((x) => x.uid !== uid);
        onUploadEnd(file, newFileList, status);
        return [...newFileList];
      });
    } else {
      setFileList((prevState) => {
        const list = [...prevState];
        onUploadEnd(file, list, status);
        return list;
      });
    }
  };

  const loading = useMemo(() => fileList.some((v) => !v.time), [fileList]);

  return { loading, fileList, onChange, onUploadBefore };
};

export default useUpload;
