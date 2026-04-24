import { useState } from "react";
import { Card, Alert, Typography } from "antd";
import useDragSortList from "@/hooks/useDragSortList";

const { Paragraph } = Typography;

const DragSortListDemo = () => {
  const [items, setItems] = useState([
    { id: "1", name: "项目 1", sort: 0 },
    { id: "2", name: "项目 2", sort: 1 },
    { id: "3", name: "项目 3", sort: 2 },
    { id: "4", name: "项目 4", sort: 3 },
    { id: "5", name: "项目 5", sort: 4 },
  ]);

  return (
    <Card title="useDragSortList Demo" style={{ marginBottom: 16 }}>
      {useDragSortList({
        dataSource: items,
        onChange: setItems,
        renderItem: (item) => (
          <div
            style={{
              padding: "12px 16px",
              margin: "8px 0",
              background: "#fff",
              border: "1px solid #d9d9d9",
              borderRadius: 6,
              cursor: "grab",
            }}
          >
            <Paragraph style={{ margin: 0 }}>
              {item.name} (排序: {item.sort})
            </Paragraph>
          </div>
        ),
      })}

      <Alert
        type="info"
        message="说明：拖拽列表项可重新排序，排序值会自动更新"
        style={{ marginTop: 16 }}
      />
    </Card>
  );
};

export default DragSortListDemo;