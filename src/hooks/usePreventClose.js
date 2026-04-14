import { useEffect, useCallback } from "react";

const usePreventClose = (
  shouldPrevent,
  message = "正在录音中，确定要离开吗？",
) => {
  const handleBeforeUnload = useCallback(
    (e) => {
      if (shouldPrevent) {
        e.preventDefault();
        e.returnValue = "";
        return message;
      }
    },
    [shouldPrevent, message],
  );

  useEffect(() => {
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [handleBeforeUnload]);
};

export default usePreventClose;