export const getFileExtension = (name) => {
  return name.split(".").pop().toLowerCase();
};

export const beforeUploadFileCheckType = (
  file,
  allowtypeString = "",
  fileType = "",
) => {
  let displayFlag = true;
  let uploadFlag = true;
  const suffix = getFileExtension(file.name);
  if (allowtypeString) {
    const types = allowtypeString
      .replace(/\./g, "")
      .split(",")
      .map((item) => item.toLowerCase());
    uploadFlag = types.includes(suffix);
  }
  if (fileType) {
    const fileTypes = fileType
      .replace(/\./g, "")
      .split(",")
      .map((item) => item.toLowerCase());
    displayFlag = fileTypes.includes(suffix);
  }
  return displayFlag && uploadFlag;
};
