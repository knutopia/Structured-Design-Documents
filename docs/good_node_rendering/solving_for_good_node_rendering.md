# Solving for Good Node Rendering

The goal is to unify and improve node rendering across our renderers.

Improvement goals:

- clean, well designed visual appearance & typography
- full CSS control over visual appearance & typography
- unified look across diagram types
- consolidating display of repeated attributes under same label
- introduction of optional decorator header for --decorators CLI option

Approach:

- Unified Node Renderer
- Composition concept: inside-out, "occupy-space, then enclose"
- Closely follow design details
- Provide CSS access to design details
- Ensure all used font weights are available in SVG
- Well-organized multiline text using <tspan>

Design-defining details that should be available via CSS or similar:

- font names
- font sizes
- font weights
- character spacing
- line spacing
- layout margins
- layout spacings
- layout levels
- edge radius
- edge thickness
- edge line placement
- font colors
- background colors for node container, header
- edge colors
- header height
- node width

# Reference Visuals

![Node Reference Visuals](<node_visual_reference/Node Master Overview.png>), showing nodes with decorator header on the left, without header on the right.

Figma Reference:
https://www.figma.com/design/XugYvQ9C0qi0Hwl88k43Wm/SDD-Node-Visuals?node-id=0-1&t=6wpXf6j3ZFTW3QKF-1



# Proposed Composition of a Node

based on a set of Figma-created Visuals

## Node Container

Container Notes

- width is fixed
- height hugs content

Content Notes

- *uses a vertical layout*
- outermost element of the node
- "node body" is always present as content
- "decorator header" is also present as content if "--decorators" CLI option is other than "none"
- layout content items vertically separated by layout spacing
- layout content items separated from container edges by layout padding
- layout item width fills container

### Node Container Layout Content

- decorator header (conditional)
- node body

### Node Container Properties

- node container background color
- node container edge line color 
- node container edge line placement
- node container edge line thickness
- node container corner radius
- node container layout padding
- node container layout spacing
    
## Decorator Header

Container Notes

- width fills container
- height is fixed (the ONLY element with fixed height)

Content Notes

- *uses a horizontal layout*
- contains 1 or 2 decorator items, based on "--decorators" CLI option
- layout content items horizontally separated by layout spacing
- layout content items separated from left container edge by layout padding
- layout content item height: fill container ("same as container")
- layout content item vertical text alignment: centered

### Decorator Header Layout Content

- node type
    notes:
        - this is a text displaying the node type
        - present for "--decorators type", "--decorators type,id"

- node ID
    notes:
        - this is a text displaying the node ID
        - present for "--decorators id", "--decorators type,id"

### Decorator Header Properties

- decorator header height
- decorator header background color
- decorator header font size
- decorator header font weight
- decorator header layout spacing
- decorator header layout padding

## Node Body

Content Notes

- *uses a vertical layout*
- shows node title followed by (if present) node attribute groups
- layout content items vertically separated by layout spacing
- layout content items separated from container edges by layout padding
- container hugs content

### Node Body Layout Content

- node title
- attibute groups (0-n)

### Node Body Properties

- node body layout padding
- node body layout spacing

## Node Title

- this is a text displaying the node title
- single-line or line-wrapped if needed

### Node Title Properties

- title font
- title font color
- title font size
- title font weight
- title line height
- title alignment (see notes below)

### 2 Cases for Note Title

**There a two cases that differ in display of the node title:**

1. Dense Node: 

when the combined height of all node content exceeds the default minimum node height. (usually the case when the node DOES contain annotations, or the node does display a decorator header, or both, or the title occupies more than a single line in the node.)

for a dense node, we treat the node title as a list item within "node body". It claims its vertical space, "node body" and "node container" will hug the content vertically and the result looks good.

2. Plain Node: 

when the combined height of all node content does NOT exceed the default minimum node height. (this can be the case the node shows ONLY the title and the title occupies only a single line.)

for a plain node, treating the title as a simple list item will display the title vertically off-center. thus the title needs to be treated as a text box that vertically fills its container, and uses explicit "align: middle" for its text.

## Attribute Group

Content Notes

- *uses a vertical layout*
- this is a label: content combination
- shows a node attribute
- (or:) shows multiple node attributes of the same type (if present) under the same label
- layout content items vertically separated by layout spacing
- layout content items separated from container edges by layout padding
- container hugs content

### Attribute Group Content

- attribute label
- attribute content (1 to N)

### Attribute Group Properties

- attribute label font
- attribute label font color
- attribute label font size
- attribute label font weight
- attribute label line height
- attribute content font
- attribute content font color
- attribute content font size
- attribute content font weight
- attribute content line height
