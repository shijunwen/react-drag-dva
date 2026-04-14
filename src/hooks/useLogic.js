import { useMemoizedFn } from "ahooks";

import eventActionDefinitions from "../eventActionDefinitions";

const useLogic = ({ useRegisterComponent, triggerEvent }) => {
  // 注册事件动作定义（当前无额外 actions）
  useRegisterComponent({
    actions: {},
    eventActionDefinitions,
  });

  const handleQuickMeeting = useMemoizedFn(() => {
    triggerEvent("quickMeeting", {});
  });

  return { handleQuickMeeting };
};

export default useLogic;