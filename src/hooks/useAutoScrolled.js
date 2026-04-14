import { useEffect, useRef, useState, useLayoutEffect } from "react";

const useAutoScrolled = (changeData) => {
  const [userScrolled, setUserScrolled] = useState(false);
  const contentRef = useRef(null);

  const handleScroll = () => {
    if (contentRef.current) {
      // 判断用户是否手动向上滚动（当前视口不在底部）
      const isAtBottom =
        contentRef.current.scrollHeight - contentRef.current.scrollTop <=
        contentRef.current.clientHeight + 10; // 加10像素的容差
      setUserScrolled(!isAtBottom);
    }
  };

  // 监听用户滚动事件
  useLayoutEffect(() => {
    const currentRef = contentRef.current;
    if (!currentRef) return;

    const timer = setTimeout(() => {
      currentRef.addEventListener("scroll", handleScroll);
    }, 600);

    return () => {
      clearTimeout(timer);
      currentRef.removeEventListener("scroll", handleScroll);
    };
  }, []);

  // 自动滚动逻辑
  useEffect(() => {
    if (contentRef.current && !userScrolled) {
      // 只有当用户没有手动滚动时才自动滚动到底部
      contentRef.current.scrollTop = contentRef.current.scrollHeight + 12;
    }
  }, [changeData, userScrolled]);

  return { setUserScrolled, contentRef };
};

export default useAutoScrolled;