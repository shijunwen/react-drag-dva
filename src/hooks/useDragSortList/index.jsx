import { Draggable, DragDropContext, Droppable } from "react-beautiful-dnd";

const useDragSortList = ({ dataSource = [], onChange, renderItem }) => {
  const onDragEnd = (result) => {
    const source = result.source;
    const destination = result.destination;
    if (
      source.droppableId === destination.droppableId &&
      source.index !== destination.index
    ) {
      const target = dataSource[source.index];
      dataSource.splice(source.index, 1);
      dataSource.splice(destination.index, 0, target);
      dataSource.forEach((item, index) => {
        item.sort = index;
      });
      onChange([...dataSource]);
    }
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <Droppable droppableId={"dragSortList"}>
        {(provided) => (
          <div {...provided.droppableProps} ref={provided.innerRef}>
            {dataSource
              .sort((a, b) => a["sort"] - b["sort"])
              .map((item, index) => (
                <Draggable
                  key={item.id}
                  draggableId={item.id}
                  index={index}
                  shouldRespectForceTouch={false}
                >
                  {(provided) => (
                    <div
                      className="draggable_item"
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                    >
                      {renderItem ? renderItem(item) : item.name}
                    </div>
                  )}
                </Draggable>
              ))}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
};

export default useDragSortList;
