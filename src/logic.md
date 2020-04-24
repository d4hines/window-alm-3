# RectangleSys

RectangleSys is a user interface system where users can move rectangles
around a a desktop (a Cartesian plane).

- Every rectangle has a fixed width and height.
- Every rectangle has X and Y coordinates that locate its top-left corner.
- The user can change the coordinates of a rectangle by clicking and dragging it. 
- Some rectangles are called "magic rectangles". Magic rectangles have a 
    color (red or blue) that changes when a rectangle's bounds are contained in special area:
        - Blue when in the special area
        - Red when not.
- One such special area is defined by a ox starting at the top-left corner of the desktop and extending 1000 pixels in both directions.
