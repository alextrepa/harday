const SHARED_TABLE_DRAG_MOUSE_TOLERANCE_PX = 4;
const SHARED_TABLE_DRAG_TOUCH_TOLERANCE_PX = 8;

export function getSharedTableDragTolerance(pointerType: string) {
  return pointerType === "touch"
    ? SHARED_TABLE_DRAG_TOUCH_TOLERANCE_PX
    : SHARED_TABLE_DRAG_MOUSE_TOLERANCE_PX;
}

type SharedTableDragMovement = {
  pointerType: string;
  originX: number;
  originY: number;
  currentX: number;
  currentY: number;
};

export function shouldStartSharedTableDrag({
  pointerType,
  originX,
  originY,
  currentX,
  currentY,
}: SharedTableDragMovement) {
  return (
    Math.hypot(currentX - originX, currentY - originY) >
    getSharedTableDragTolerance(pointerType)
  );
}
